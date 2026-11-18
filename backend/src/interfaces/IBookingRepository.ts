import type { Booking, BookingStatus, BookingWithDetails } from '../models';

export interface CreateBookingData {
  bookingCode: string;
  userId: string;
  eventId: string;
  tierId: string;
  quantity: number;
  totalAmountKes: number;
  qrPayload: string | null;
  status: BookingStatus;
  needsAccessibility: boolean;
}

export interface BookingStats {
  totalBookings: number;
  ticketsSold: number;
  checkedInTickets: number;
  revenueKes: number;
  waitlisted: number;
}

/** Writes + lookups needed by the booking lifecycle. */
export interface IBookingCommandRepository {
  create(data: CreateBookingData): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  existsByCode(bookingCode: string): Promise<boolean>;
  /** Sum of tickets a user holds for an event in active statuses. */
  sumActiveQuantityForUser(userId: string, eventId: string): Promise<number>;
  /** Sum of seats taken for an event (confirmed / payment due / checked in). */
  sumSeatedQuantityForEvent(eventId: string): Promise<number>;
  findWaitlistedByTier(tierId: string): Promise<Booking[]>;
  cancel(id: string): Promise<Booking>;
  promoteFromWaitlist(id: string, qrPayload: string): Promise<Booking>;
  /** Cancels every non-terminal booking of an event; returns how many changed. */
  cancelActiveForEvent(eventId: string): Promise<number>;
}

/** Read models for the student's "My tickets" view. */
export interface IBookingQueryRepository {
  findByUser(userId: string): Promise<BookingWithDetails[]>;
}

/** Narrow contract for door check-in. */
export interface IBookingCheckInRepository {
  findByCode(bookingCode: string): Promise<Booking | null>;
  /** Atomically flips CONFIRMED -> CHECKED_IN. Returns null if it was not CONFIRMED. */
  markCheckedIn(id: string, at: Date): Promise<Booking | null>;
}

/** Aggregations for dashboards. */
export interface IBookingStatsRepository {
  getStats(eventIds?: string[]): Promise<BookingStats>;
  getStatsByEvent(eventIds: string[]): Promise<Map<string, BookingStats>>;
}

export interface IBookingRepository
  extends IBookingCommandRepository,
    IBookingQueryRepository,
    IBookingCheckInRepository,
    IBookingStatsRepository {}
