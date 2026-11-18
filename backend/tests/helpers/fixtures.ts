import type { TransactionContext } from '../../src/interfaces';
import {
  BookingStatus,
  EventStatus,
  type Booking,
  type EventWithDetails,
  type TicketTier,
  type Venue,
} from '../../src/models';

export function makeVenue(overrides: Partial<Venue> = {}): Venue {
  return { id: 'venue-1', name: 'Innovation Lab, Block B', maxCapacity: 200, isAccessible: true, ...overrides };
}

export function makeTier(overrides: Partial<TicketTier> = {}): TicketTier {
  return {
    id: 'tier-regular',
    eventId: 'event-1',
    name: 'Regular',
    description: null,
    priceKes: 500,
    totalQuantity: 150,
    soldQuantity: 0,
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<EventWithDetails> = {}): EventWithDetails {
  const venue = overrides.venue ?? makeVenue();
  return {
    id: 'event-1',
    organizerId: 'organizer-1',
    venueId: venue.id,
    title: 'Nairobi Tech Hackathon 2026',
    category: 'Technology',
    audience: 'All students',
    description: 'Build sprint',
    date: new Date('2026-12-05T00:00:00.000Z'),
    startTime: '09:00',
    endTime: '18:00',
    maxCapacity: 200,
    status: EventStatus.PUBLISHED,
    coverImageUrl: null,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    venue,
    tiers: [makeTier()],
    organizer: { id: 'organizer-1', fullName: 'Computer Science Club', email: 'cs.club@campus.ac.ke' },
    ...overrides,
  };
}

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    bookingCode: 'CP-8H2K-4471',
    userId: 'student-1',
    eventId: 'event-1',
    tierId: 'tier-regular',
    quantity: 1,
    totalAmountKes: 500,
    qrPayload: null,
    status: BookingStatus.CONFIRMED,
    needsAccessibility: false,
    checkedInAt: null,
    createdAt: new Date('2026-11-10T08:00:00.000Z'),
    updatedAt: new Date('2026-11-10T08:00:00.000Z'),
    ...overrides,
  };
}

export type MockTransactionContext = {
  [K in keyof TransactionContext]: { [M in keyof TransactionContext[K]]: jest.Mock };
};

/** A fully mocked transaction context: every repository method is a jest.fn(). */
export function createMockContext(): MockTransactionContext {
  return {
    bookings: {
      create: jest.fn(),
      findById: jest.fn(),
      existsByCode: jest.fn().mockResolvedValue(false),
      sumActiveQuantityForUser: jest.fn().mockResolvedValue(0),
      sumSeatedQuantityForEvent: jest.fn().mockResolvedValue(0),
      findWaitlistedByTier: jest.fn().mockResolvedValue([]),
      cancel: jest.fn(),
      promoteFromWaitlist: jest.fn(),
      cancelActiveForEvent: jest.fn().mockResolvedValue(0),
    },
    tiers: {
      findById: jest.fn(),
      tryReserve: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    },
    events: {
      findById: jest.fn(),
      search: jest.fn(),
      findByOrganizer: jest.fn(),
      findActiveAtVenueOnDate: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      countByStatus: jest.fn(),
    },
    users: {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      updateStatus: jest.fn(),
      countByRole: jest.fn(),
    },
    auditLogs: {
      append: jest.fn(),
      list: jest.fn(),
    },
  };
}
