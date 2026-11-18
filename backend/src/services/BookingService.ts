import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TicketLimitExceededError,
  ValidationError,
} from '../errors/AppError';
import type {
  CancelBookingResult,
  CreateBookingInput,
  IBookingCodeGenerator,
  IBookingQueryRepository,
  IBookingService,
  IPricingStrategyResolver,
  IQRCodeGenerator,
  ITransactionManager,
  TokenPayload,
  TransactionContext,
} from '../interfaces';
import {
  BookingStatus,
  EventStatus,
  MAX_TICKETS_PER_STUDENT_PER_EVENT,
  Role,
  SEATED_BOOKING_STATUSES,
  type Booking,
  type BookingWithDetails,
  type EventWithDetails,
} from '../models';

const MAX_CODE_ATTEMPTS = 10;

export interface BookingServiceOptions {
  maxTicketsPerStudent?: number;
}

/**
 * Owns the booking lifecycle. Pricing is delegated to strategies (OCP) and
 * every capacity decision happens inside a single transaction (atomicity).
 */
export class BookingService implements IBookingService {
  private readonly maxTicketsPerStudent: number;

  constructor(
    private readonly tx: ITransactionManager,
    private readonly bookingQueries: IBookingQueryRepository,
    private readonly pricing: IPricingStrategyResolver,
    private readonly qr: IQRCodeGenerator,
    private readonly codes: IBookingCodeGenerator,
    options: BookingServiceOptions = {},
  ) {
    this.maxTicketsPerStudent = options.maxTicketsPerStudent ?? MAX_TICKETS_PER_STUDENT_PER_EVENT;
  }

  async book(userId: string, input: CreateBookingInput): Promise<Booking> {
    const { quantity } = input;
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new ValidationError('quantity must be a positive integer');
    }
    if (quantity > this.maxTicketsPerStudent) {
      throw new TicketLimitExceededError(this.maxTicketsPerStudent, 0);
    }

    return this.tx.run(async (ctx) => {
      const event = await ctx.events.findById(input.eventId);
      if (!event) throw new NotFoundError('Event');
      if (event.status !== EventStatus.PUBLISHED) {
        throw new BusinessRuleError('This event is not open for booking', 'EVENT_NOT_BOOKABLE');
      }
      const tier = event.tiers.find((t) => t.id === input.tierId);
      if (!tier) throw new NotFoundError('Ticket tier');

      const alreadyHeld = await ctx.bookings.sumActiveQuantityForUser(userId, event.id);
      if (alreadyHeld + quantity > this.maxTicketsPerStudent) {
        throw new TicketLimitExceededError(this.maxTicketsPerStudent, alreadyHeld);
      }

      const totalAmountKes = this.pricing.resolve(tier).calculateTotal(tier, quantity);
      const bookingCode = await this.uniqueCode(ctx);
      const seated = await this.tryReserveSeats(ctx, event, tier.id, quantity);

      return ctx.bookings.create({
        bookingCode,
        userId,
        eventId: event.id,
        tierId: tier.id,
        quantity,
        totalAmountKes,
        qrPayload: seated ? this.qr.generate({ bookingCode, eventId: event.id, userId }) : null,
        status: seated ? BookingStatus.CONFIRMED : BookingStatus.WAITLISTED,
        needsAccessibility: input.needsAccessibility ?? false,
      });
    });
  }

  listForUser(userId: string): Promise<BookingWithDetails[]> {
    return this.bookingQueries.findByUser(userId);
  }

  async cancel(actor: TokenPayload, bookingId: string): Promise<CancelBookingResult> {
    return this.tx.run(async (ctx) => {
      const booking = await ctx.bookings.findById(bookingId);
      if (!booking) throw new NotFoundError('Booking');
      if (booking.userId !== actor.userId && actor.role !== Role.ADMIN) {
        throw new ForbiddenError('You can only cancel your own bookings');
      }
      if (booking.status === BookingStatus.CANCELLED) {
        throw new ConflictError('Booking is already cancelled', 'BOOKING_ALREADY_CANCELLED');
      }
      if (booking.status === BookingStatus.CHECKED_IN) {
        throw new BusinessRuleError('A checked-in booking cannot be cancelled', 'BOOKING_CHECKED_IN');
      }

      const heldSeats = SEATED_BOOKING_STATUSES.includes(booking.status);
      const cancelled = await ctx.bookings.cancel(booking.id);

      const promotedBookingIds: string[] = [];
      if (heldSeats) {
        await ctx.tiers.release(booking.tierId, booking.quantity);
        const event = await ctx.events.findById(booking.eventId);
        if (event && event.status === EventStatus.PUBLISHED) {
          promotedBookingIds.push(...(await this.promoteWaitlist(ctx, event, booking.tierId)));
        }
      }
      return { booking: cancelled, promotedBookingIds };
    });
  }

  /** Promote waitlisted bookings strictly first-in-first-out while seats remain. */
  private async promoteWaitlist(ctx: TransactionContext, event: EventWithDetails, tierId: string): Promise<string[]> {
    const promoted: string[] = [];
    const waitlist = await ctx.bookings.findWaitlistedByTier(tierId);
    for (const candidate of waitlist) {
      const reserved = await this.tryReserveSeats(ctx, event, tierId, candidate.quantity);
      if (!reserved) break;
      const qrPayload = this.qr.generate({
        bookingCode: candidate.bookingCode,
        eventId: candidate.eventId,
        userId: candidate.userId,
      });
      await ctx.bookings.promoteFromWaitlist(candidate.id, qrPayload);
      promoted.push(candidate.id);
    }
    return promoted;
  }

  /** Checks event-wide capacity, then compare-and-swaps the tier's sold count. */
  private async tryReserveSeats(
    ctx: TransactionContext,
    event: EventWithDetails,
    tierId: string,
    quantity: number,
  ): Promise<boolean> {
    const seatedForEvent = await ctx.bookings.sumSeatedQuantityForEvent(event.id);
    if (seatedForEvent + quantity > event.maxCapacity) return false;

    const tier = await ctx.tiers.findById(tierId);
    if (!tier || tier.soldQuantity + quantity > tier.totalQuantity) return false;
    return ctx.tiers.tryReserve(tierId, tier.soldQuantity, quantity);
  }

  private async uniqueCode(ctx: TransactionContext): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
      const code = this.codes.generate();
      if (!(await ctx.bookings.existsByCode(code))) return code;
    }
    throw new ConflictError('Could not allocate a unique booking code, please retry', 'BOOKING_CODE_EXHAUSTED');
  }
}
