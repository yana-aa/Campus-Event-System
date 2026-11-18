import {
  BusinessRuleError,
  ForbiddenError,
  InvalidTicketError,
  NotFoundError,
  TicketAlreadyUsedError,
  TicketLimitExceededError,
  ValidationError,
  VenueCapacityExceededError,
  VenueClashError,
  AccountSuspendedError,
} from '../../src/errors/AppError';
import type {
  IBookingCheckInRepository,
  IBookingCodeGenerator,
  IBookingQueryRepository,
  IEventRepository,
  IPasswordHasher,
  IQRCodeGenerator,
  ITicketPricingStrategy,
  ITokenService,
  ITransactionManager,
  IUserRepository,
  IVenueRepository,
  PricedTier,
  TransactionContext,
} from '../../src/interfaces';
import { HmacQRCodeGenerator } from '../../src/lib/HmacQRCodeGenerator';
import { RandomBookingCodeGenerator } from '../../src/lib/RandomBookingCodeGenerator';
import { BookingStatus, EventStatus, Role, UserStatus, type User } from '../../src/models';
import { AuthService } from '../../src/services/AuthService';
import { BookingService } from '../../src/services/BookingService';
import { EventService } from '../../src/services/EventService';
import { QRCodeService } from '../../src/services/QRCodeService';
import { FreeTicketStrategy } from '../../src/strategies/FreeTicketStrategy';
import { PaidTicketStrategy } from '../../src/strategies/PaidTicketStrategy';
import { PricingStrategyResolver } from '../../src/strategies/PricingStrategyResolver';
import {
  createMockContext,
  makeBooking,
  makeEvent,
  makeTier,
  makeVenue,
  type MockTransactionContext,
} from '../helpers/fixtures';

const SECRET = 'unit-test-hmac-secret-0123456789';

function mockTx(ctx: MockTransactionContext): ITransactionManager {
  return { run: jest.fn((work) => work(ctx as unknown as TransactionContext)) } as ITransactionManager;
}

function fixedCodes(...codes: string[]): IBookingCodeGenerator {
  const queue = [...codes];
  return { generate: jest.fn(() => queue.shift() ?? 'CP-ZZZZ-9999') };
}

const noQueries: IBookingQueryRepository = { findByUser: jest.fn().mockResolvedValue([]) };

// ---------------------------------------------------------------------------
// Pricing strategies (OCP)
// ---------------------------------------------------------------------------
describe('Ticket pricing strategies', () => {
  const free: PricedTier = { id: 't-free', name: 'Free', priceKes: 0 };
  const regular: PricedTier = { id: 't-reg', name: 'Regular', priceKes: 500 };
  const vip: PricedTier = { id: 't-vip', name: 'VIP', priceKes: 1500 };

  it('FreeTicketStrategy always totals KES 0 and only supports zero-priced tiers', () => {
    const strategy = new FreeTicketStrategy();
    expect(strategy.supports(free)).toBe(true);
    expect(strategy.supports(regular)).toBe(false);
    expect(strategy.calculateTotal(free, 2)).toBe(0);
  });

  it('PaidTicketStrategy multiplies tier price by quantity', () => {
    const strategy = new PaidTicketStrategy();
    expect(strategy.supports(vip)).toBe(true);
    expect(strategy.supports(free)).toBe(false);
    expect(strategy.calculateTotal(regular, 2)).toBe(1000);
    expect(strategy.calculateTotal(vip, 1)).toBe(1500);
    expect(() => strategy.calculateTotal(vip, 0)).toThrow(RangeError);
  });

  it('PricingStrategyResolver picks the first strategy that supports the tier', () => {
    const resolver = new PricingStrategyResolver([new FreeTicketStrategy(), new PaidTicketStrategy()]);
    expect(resolver.resolve(free).name).toBe('FREE');
    expect(resolver.resolve(vip).name).toBe('PAID');
  });

  it('accepts a brand-new pricing tier without modifying BookingService (Open/Closed)', async () => {
    class EarlyBirdStrategy implements ITicketPricingStrategy {
      readonly name = 'EARLY_BIRD';
      supports(tier: PricedTier): boolean {
        return tier.name.startsWith('Early Bird');
      }
      calculateTotal(tier: PricedTier, quantity: number): number {
        return Math.round(tier.priceKes * quantity * 0.8);
      }
    }

    const earlyTier = makeTier({ id: 'tier-early', name: 'Early Bird Regular', priceKes: 500 });
    const ctx = createMockContext();
    ctx.events.findById.mockResolvedValue(makeEvent({ tiers: [earlyTier] }));
    ctx.tiers.findById.mockResolvedValue(earlyTier);
    ctx.bookings.create.mockImplementation(async (data) => makeBooking(data));

    const service = new BookingService(
      mockTx(ctx),
      noQueries,
      new PricingStrategyResolver([new EarlyBirdStrategy(), new FreeTicketStrategy(), new PaidTicketStrategy()]),
      new HmacQRCodeGenerator(SECRET),
      fixedCodes('CP-EARL-0001'),
    );

    const booking = await service.book('student-1', { eventId: 'event-1', tierId: 'tier-early', quantity: 2 });
    expect(booking.totalAmountKes).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// BookingService (DIP - every dependency is a mock)
// ---------------------------------------------------------------------------
describe('BookingService', () => {
  let ctx: MockTransactionContext;
  let tx: ITransactionManager;
  let qr: IQRCodeGenerator;
  let pricingStrategy: ITicketPricingStrategy;

  const build = (codes: IBookingCodeGenerator = fixedCodes('CP-AAAA-0001')) =>
    new BookingService(tx, noQueries, { resolve: () => pricingStrategy }, qr, codes);

  beforeEach(() => {
    ctx = createMockContext();
    tx = mockTx(ctx);
    qr = new HmacQRCodeGenerator(SECRET);
    pricingStrategy = { name: 'MOCK', supports: () => true, calculateTotal: jest.fn(() => 1000) };
    ctx.events.findById.mockResolvedValue(makeEvent());
    ctx.tiers.findById.mockResolvedValue(makeTier({ soldQuantity: 10 }));
    ctx.bookings.create.mockImplementation(async (data) => makeBooking(data));
  });

  it('confirms a booking inside a transaction, priced by the injected strategy, with a signed QR', async () => {
    const booking = await build().book('student-1', { eventId: 'event-1', tierId: 'tier-regular', quantity: 2 });

    expect(tx.run).toHaveBeenCalledTimes(1);
    expect(pricingStrategy.calculateTotal).toHaveBeenCalledWith(expect.objectContaining({ id: 'tier-regular' }), 2);
    expect(ctx.tiers.tryReserve).toHaveBeenCalledWith('tier-regular', 10, 2);
    expect(booking.status).toBe(BookingStatus.CONFIRMED);
    expect(booking.totalAmountKes).toBe(1000);
    expect(booking.bookingCode).toBe('CP-AAAA-0001');
    expect(qr.verify(booking.qrPayload as string)).toEqual({
      bookingCode: 'CP-AAAA-0001',
      eventId: 'event-1',
      userId: 'student-1',
    });
  });

  it('auto-assigns WAITLISTED (no QR, no stock taken) when the tier is sold out', async () => {
    ctx.tiers.findById.mockResolvedValue(makeTier({ totalQuantity: 150, soldQuantity: 150 }));

    const booking = await build().book('student-1', { eventId: 'event-1', tierId: 'tier-regular', quantity: 1 });

    expect(booking.status).toBe(BookingStatus.WAITLISTED);
    expect(booking.qrPayload).toBeNull();
    expect(ctx.tiers.tryReserve).not.toHaveBeenCalled();
  });

  it('auto-assigns WAITLISTED when the event-wide capacity is reached even if the tier has stock', async () => {
    ctx.events.findById.mockResolvedValue(makeEvent({ maxCapacity: 50 }));
    ctx.bookings.sumSeatedQuantityForEvent.mockResolvedValue(50);

    const booking = await build().book('student-1', { eventId: 'event-1', tierId: 'tier-regular', quantity: 1 });

    expect(booking.status).toBe(BookingStatus.WAITLISTED);
    expect(ctx.tiers.tryReserve).not.toHaveBeenCalled();
  });

  it('falls back to WAITLISTED when a concurrent writer wins the compare-and-swap', async () => {
    ctx.tiers.tryReserve.mockResolvedValue(false);
    const booking = await build().book('student-1', { eventId: 'event-1', tierId: 'tier-regular', quantity: 1 });
    expect(booking.status).toBe(BookingStatus.WAITLISTED);
  });

  it('enforces the 2-tickets-per-student limit including existing bookings', async () => {
    ctx.bookings.sumActiveQuantityForUser.mockResolvedValue(1);
    await expect(
      build().book('student-1', { eventId: 'event-1', tierId: 'tier-regular', quantity: 2 }),
    ).rejects.toBeInstanceOf(TicketLimitExceededError);
    expect(ctx.bookings.create).not.toHaveBeenCalled();
  });

  it('rejects a single request for more than 2 tickets before touching the database', async () => {
    await expect(
      build().book('student-1', { eventId: 'event-1', tierId: 'tier-regular', quantity: 3 }),
    ).rejects.toBeInstanceOf(TicketLimitExceededError);
    expect(tx.run).not.toHaveBeenCalled();
  });

  it('rejects invalid quantities', async () => {
    await expect(
      build().book('student-1', { eventId: 'event-1', tierId: 'tier-regular', quantity: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('refuses bookings for events that are not published', async () => {
    ctx.events.findById.mockResolvedValue(makeEvent({ status: EventStatus.PENDING_APPROVAL }));
    await expect(
      build().book('student-1', { eventId: 'event-1', tierId: 'tier-regular', quantity: 1 }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('returns 404-style errors for unknown events or tiers', async () => {
    await expect(
      build().book('student-1', { eventId: 'event-1', tierId: 'no-such-tier', quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    ctx.events.findById.mockResolvedValue(null);
    await expect(
      build().book('student-1', { eventId: 'missing', tierId: 'tier-regular', quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('regenerates the booking code until it is unique', async () => {
    ctx.bookings.existsByCode.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const booking = await build(fixedCodes('CP-DUPE-0001', 'CP-UNIQ-0002')).book('student-1', {
      eventId: 'event-1',
      tierId: 'tier-regular',
      quantity: 1,
    });
    expect(booking.bookingCode).toBe('CP-UNIQ-0002');
  });

  it('cancellation releases stock and promotes the oldest waitlisted booking (FIFO)', async () => {
    const cancelled = makeBooking({ id: 'b-confirmed', quantity: 1, status: BookingStatus.CONFIRMED });
    const oldest = makeBooking({
      id: 'b-wait-1',
      bookingCode: 'CP-WAIT-0001',
      userId: 'student-2',
      status: BookingStatus.WAITLISTED,
      createdAt: new Date('2026-11-11T08:00:00Z'),
    });
    const newer = makeBooking({
      id: 'b-wait-2',
      bookingCode: 'CP-WAIT-0002',
      userId: 'student-3',
      status: BookingStatus.WAITLISTED,
      createdAt: new Date('2026-11-12T08:00:00Z'),
    });

    ctx.bookings.findById.mockResolvedValue(cancelled);
    ctx.bookings.cancel.mockResolvedValue({ ...cancelled, status: BookingStatus.CANCELLED });
    ctx.bookings.findWaitlistedByTier.mockResolvedValue([oldest, newer]);
    // After release: 149/150 sold -> exactly one seat for the oldest; then full.
    ctx.tiers.findById
      .mockResolvedValueOnce(makeTier({ soldQuantity: 149 }))
      .mockResolvedValueOnce(makeTier({ soldQuantity: 150 }));

    const result = await build().cancel({ userId: 'student-1', role: Role.STUDENT }, 'b-confirmed');

    expect(ctx.tiers.release).toHaveBeenCalledWith('tier-regular', 1);
    expect(result.promotedBookingIds).toEqual(['b-wait-1']);
    expect(ctx.bookings.promoteFromWaitlist).toHaveBeenCalledTimes(1);
    const [promotedId, payload] = ctx.bookings.promoteFromWaitlist.mock.calls[0];
    expect(promotedId).toBe('b-wait-1');
    expect(qr.verify(payload)).toEqual({ bookingCode: 'CP-WAIT-0001', eventId: 'event-1', userId: 'student-2' });
  });

  it('cancelling a waitlisted booking does not release stock or promote anyone', async () => {
    const waitlisted = makeBooking({ status: BookingStatus.WAITLISTED });
    ctx.bookings.findById.mockResolvedValue(waitlisted);
    ctx.bookings.cancel.mockResolvedValue({ ...waitlisted, status: BookingStatus.CANCELLED });

    const result = await build().cancel({ userId: 'student-1', role: Role.STUDENT }, 'booking-1');

    expect(ctx.tiers.release).not.toHaveBeenCalled();
    expect(result.promotedBookingIds).toEqual([]);
  });

  it("forbids cancelling another student's booking and checked-in bookings", async () => {
    ctx.bookings.findById.mockResolvedValue(makeBooking({ userId: 'someone-else' }));
    await expect(build().cancel({ userId: 'student-1', role: Role.STUDENT }, 'booking-1')).rejects.toBeInstanceOf(
      ForbiddenError,
    );

    ctx.bookings.findById.mockResolvedValue(makeBooking({ status: BookingStatus.CHECKED_IN }));
    await expect(build().cancel({ userId: 'student-1', role: Role.STUDENT }, 'booking-1')).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
  });
});

// ---------------------------------------------------------------------------
// QR signing + anti-fraud door check-in
// ---------------------------------------------------------------------------
describe('HmacQRCodeGenerator', () => {
  const generator = new HmacQRCodeGenerator(SECRET);
  const claims = { bookingCode: 'CP-8H2K-4471', eventId: 'event-1', userId: 'student-1' };

  it('round-trips signed claims', () => {
    expect(generator.verify(generator.generate(claims))).toEqual(claims);
  });

  it('rejects tampered bodies, forged signatures and foreign keys', () => {
    const payload = generator.generate(claims);
    const [version, , signature] = payload.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ b: 'CP-FAKE-0000', e: 'event-1', u: 'student-1' })).toString(
      'base64url',
    );
    expect(generator.verify(`${version}.${forgedBody}.${signature}`)).toBeNull();
    expect(generator.verify(`${payload}x`)).toBeNull();
    expect(generator.verify('garbage')).toBeNull();
    expect(new HmacQRCodeGenerator('another-secret-entirely-123').verify(payload)).toBeNull();
  });

  it('generates booking codes in the CP-XXXX-NNNN format', () => {
    const code = new RandomBookingCodeGenerator().generate();
    expect(code).toMatch(/^CP-[A-Z2-9]{4}-\d{4}$/);
  });
});

describe('QRCodeService.validateAtDoor', () => {
  const generator = new HmacQRCodeGenerator(SECRET);
  const organizer = { userId: 'organizer-1', role: Role.ORGANIZER };
  const payload = generator.generate({ bookingCode: 'CP-8H2K-4471', eventId: 'event-1', userId: 'student-1' });
  const now = new Date('2026-12-05T08:45:00Z');

  let bookings: { [K in keyof IBookingCheckInRepository]: jest.Mock };
  let events: { findById: jest.Mock };
  let service: QRCodeService;

  beforeEach(() => {
    bookings = { findByCode: jest.fn(), markCheckedIn: jest.fn() };
    events = { findById: jest.fn().mockResolvedValue(makeEvent()) };
    service = new QRCodeService(generator, bookings, events, () => now);
  });

  it('checks in a valid, confirmed ticket and stamps the time', async () => {
    const booking = makeBooking({ qrPayload: payload });
    bookings.findByCode.mockResolvedValue(booking);
    bookings.markCheckedIn.mockResolvedValue({ ...booking, status: BookingStatus.CHECKED_IN, checkedInAt: now });

    const result = await service.validateAtDoor(organizer, 'event-1', payload);

    expect(bookings.markCheckedIn).toHaveBeenCalledWith('booking-1', now);
    expect(result).toMatchObject({ bookingCode: 'CP-8H2K-4471', status: 'CHECKED_IN', checkedInAt: now });
  });

  it('rejects a duplicate scan with TicketAlreadyUsedError (HTTP 409)', async () => {
    bookings.findByCode.mockResolvedValue(
      makeBooking({ qrPayload: payload, status: BookingStatus.CHECKED_IN, checkedInAt: now }),
    );

    const error = await service.validateAtDoor(organizer, 'event-1', payload).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TicketAlreadyUsedError);
    expect((error as TicketAlreadyUsedError).statusCode).toBe(409);
    expect(bookings.markCheckedIn).not.toHaveBeenCalled();
  });

  it('rejects the loser of two simultaneous scans with TicketAlreadyUsedError', async () => {
    bookings.findByCode
      .mockResolvedValueOnce(makeBooking({ qrPayload: payload }))
      .mockResolvedValueOnce(makeBooking({ status: BookingStatus.CHECKED_IN, checkedInAt: now }));
    bookings.markCheckedIn.mockResolvedValue(null);

    await expect(service.validateAtDoor(organizer, 'event-1', payload)).rejects.toBeInstanceOf(TicketAlreadyUsedError);
  });

  it('rejects tickets with a bad signature or issued for another event', async () => {
    await expect(service.validateAtDoor(organizer, 'event-1', `${payload}tampered`)).rejects.toBeInstanceOf(
      InvalidTicketError,
    );

    const otherEvent = generator.generate({ bookingCode: 'CP-8H2K-4471', eventId: 'event-2', userId: 'student-1' });
    await expect(service.validateAtDoor(organizer, 'event-1', otherEvent)).rejects.toBeInstanceOf(InvalidTicketError);
  });

  it('rejects cancelled and waitlisted bookings', async () => {
    bookings.findByCode.mockResolvedValue(makeBooking({ qrPayload: null, status: BookingStatus.CANCELLED }));
    await expect(service.validateAtDoor(organizer, 'event-1', payload)).rejects.toThrow('cancelled');

    bookings.findByCode.mockResolvedValue(makeBooking({ status: BookingStatus.WAITLISTED }));
    await expect(service.validateAtDoor(organizer, 'event-1', payload)).rejects.toThrow('not confirmed');
  });

  it('supports manual booking-code entry with the same duplicate protection', async () => {
    const booking = makeBooking({ qrPayload: payload });
    bookings.findByCode.mockResolvedValue(booking);
    bookings.markCheckedIn.mockResolvedValue({ ...booking, status: BookingStatus.CHECKED_IN, checkedInAt: now });

    const result = await service.validateByCode(organizer, 'event-1', 'cp-8h2k-4471');
    expect(bookings.findByCode).toHaveBeenCalledWith('CP-8H2K-4471');
    expect(result.status).toBe('CHECKED_IN');

    bookings.findByCode.mockResolvedValue({ ...booking, status: BookingStatus.CHECKED_IN, checkedInAt: now });
    await expect(service.validateByCode(organizer, 'event-1', 'CP-8H2K-4471')).rejects.toBeInstanceOf(
      TicketAlreadyUsedError,
    );

    bookings.findByCode.mockResolvedValue(null);
    await expect(service.validateByCode(organizer, 'event-1', 'CP-NONE-0000')).rejects.toBeInstanceOf(
      InvalidTicketError,
    );
  });

  it('only lets the owning organizer (or an admin) scan tickets', async () => {
    await expect(
      service.validateAtDoor({ userId: 'other-organizer', role: Role.ORGANIZER }, 'event-1', payload),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ---------------------------------------------------------------------------
// EventService: venue capacity + clash detection
// ---------------------------------------------------------------------------
describe('EventService venue rules', () => {
  const clock = () => new Date('2026-11-18T10:00:00Z');
  let events: { [K in keyof IEventRepository]: jest.Mock };
  let venues: { [K in keyof IVenueRepository]: jest.Mock };
  let service: EventService;

  const input = {
    venueId: 'venue-lab4',
    title: 'Intro to Flutter Bootcamp',
    category: 'Workshop',
    audience: 'Beginners',
    description: 'Hands-on Flutter introduction',
    date: '2026-12-12',
    startTime: '14:00',
    endTime: '17:00',
    maxCapacity: 120,
    tiers: [{ name: 'Free', priceKes: 0, totalQuantity: 120 }],
  };

  beforeEach(() => {
    events = createMockContext().events;
    venues = {
      findById: jest.fn().mockResolvedValue(makeVenue({ id: 'venue-lab4', name: 'Lab 4, Science Block', maxCapacity: 120 })),
      findAll: jest.fn(),
    };
    events.create.mockImplementation(async (data) => makeEvent(data));
    service = new EventService(events, venues, clock);
  });

  it('rejects events whose capacity exceeds the venue capacity', async () => {
    await expect(service.create('organizer-1', { ...input, maxCapacity: 121 })).rejects.toBeInstanceOf(
      VenueCapacityExceededError,
    );
    expect(events.create).not.toHaveBeenCalled();
  });

  it('accepts an event exactly at venue capacity and defaults to PENDING_APPROVAL', async () => {
    await service.create('organizer-1', input);
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({ maxCapacity: 120, status: EventStatus.PENDING_APPROVAL }),
    );
  });

  it('detects overlapping bookings of the same venue on the same day', async () => {
    events.findActiveAtVenueOnDate.mockResolvedValue([makeEvent({ id: 'clash-1', startTime: '16:00', endTime: '19:00' })]);
    await expect(service.create('organizer-1', input)).rejects.toBeInstanceOf(VenueClashError);
  });

  it('allows back-to-back events that do not overlap', async () => {
    events.findActiveAtVenueOnDate.mockResolvedValue([makeEvent({ id: 'morning', startTime: '09:00', endTime: '14:00' })]);
    await expect(service.create('organizer-1', input)).resolves.toBeDefined();
  });

  it('rejects tier allocations larger than event capacity', async () => {
    await expect(
      service.create('organizer-1', { ...input, tiers: [{ name: 'Free', priceKes: 0, totalQuantity: 121 }] }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it('enforces venue capacity on edits too', async () => {
    events.findById.mockResolvedValue(
      makeEvent({ venue: makeVenue({ maxCapacity: 120 }), maxCapacity: 100, tiers: [makeTier({ totalQuantity: 100 })] }),
    );
    await expect(
      service.update({ userId: 'organizer-1', role: Role.ORGANIZER }, 'event-1', { maxCapacity: 150 }),
    ).rejects.toBeInstanceOf(VenueCapacityExceededError);
  });
});

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------
describe('AuthService', () => {
  const hasher: IPasswordHasher = {
    hash: jest.fn(async (p: string) => `hashed:${p}`),
    compare: jest.fn(async (p: string, h: string) => h === `hashed:${p}`),
  };
  const tokens: ITokenService = { sign: jest.fn(() => 'jwt-token'), verify: jest.fn() };
  let users: { [K in keyof IUserRepository]: jest.Mock };

  const user = (overrides: Partial<User> = {}): User => ({
    id: 'u-1',
    fullName: 'Amani Wanjiku',
    email: 'amani.w@students.ac.ke',
    passwordHash: 'hashed:Secret123',
    role: Role.STUDENT,
    status: UserStatus.ACTIVE,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    users = createMockContext().users;
    users.findByEmail.mockResolvedValue(null);
    users.create.mockImplementation(async (data) => user(data));
  });

  it('only accepts university email domains', async () => {
    const service = new AuthService(users, hasher, tokens);
    await expect(
      service.register({ fullName: 'Jane', email: 'jane@gmail.com', password: 'Secret123' }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.register({ fullName: 'Amani', email: 'amani.w@students.ac.ke', password: 'Secret123' }),
    ).resolves.toMatchObject({ token: 'jwt-token', user: { role: Role.STUDENT } });
  });

  it('never returns the password hash and blocks suspended accounts at login', async () => {
    const service = new AuthService(users, hasher, tokens);
    users.findByEmail.mockResolvedValue(user());
    const ok = await service.login('amani.w@students.ac.ke', 'Secret123');
    expect(ok.user).not.toHaveProperty('passwordHash');

    users.findByEmail.mockResolvedValue(user({ status: UserStatus.SUSPENDED }));
    await expect(service.login('amani.w@students.ac.ke', 'Secret123')).rejects.toBeInstanceOf(AccountSuspendedError);
  });
});
