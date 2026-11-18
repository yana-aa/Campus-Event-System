import type { Prisma } from '@prisma/client';
import type { BookingStats, CreateBookingData, IBookingRepository } from '../interfaces';
import type { PrismaExecutor } from '../lib/prisma';
import {
  ACTIVE_BOOKING_STATUSES,
  BookingStatus,
  REVENUE_BOOKING_STATUSES,
  SEATED_BOOKING_STATUSES,
  type Booking,
  type BookingWithDetails,
} from '../models';

const emptyStats = (): BookingStats => ({
  totalBookings: 0,
  ticketsSold: 0,
  checkedInTickets: 0,
  revenueKes: 0,
  waitlisted: 0,
});

export class PrismaBookingRepository implements IBookingRepository {
  constructor(private readonly db: PrismaExecutor) {}

  create(data: CreateBookingData): Promise<Booking> {
    return this.db.booking.create({ data });
  }

  findById(id: string): Promise<Booking | null> {
    return this.db.booking.findUnique({ where: { id } });
  }

  findByCode(bookingCode: string): Promise<Booking | null> {
    return this.db.booking.findUnique({ where: { bookingCode } });
  }

  async existsByCode(bookingCode: string): Promise<boolean> {
    const count = await this.db.booking.count({ where: { bookingCode } });
    return count > 0;
  }

  async sumActiveQuantityForUser(userId: string, eventId: string): Promise<number> {
    const agg = await this.db.booking.aggregate({
      where: { userId, eventId, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  }

  async sumSeatedQuantityForEvent(eventId: string): Promise<number> {
    const agg = await this.db.booking.aggregate({
      where: { eventId, status: { in: [...SEATED_BOOKING_STATUSES] } },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ?? 0;
  }

  findWaitlistedByTier(tierId: string): Promise<Booking[]> {
    return this.db.booking.findMany({
      where: { tierId, status: BookingStatus.WAITLISTED },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  cancel(id: string): Promise<Booking> {
    return this.db.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED, qrPayload: null },
    });
  }

  promoteFromWaitlist(id: string, qrPayload: string): Promise<Booking> {
    return this.db.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED, qrPayload },
    });
  }

  async cancelActiveForEvent(eventId: string): Promise<number> {
    const result = await this.db.booking.updateMany({
      where: { eventId, status: { in: [...ACTIVE_BOOKING_STATUSES] } },
      data: { status: BookingStatus.CANCELLED, qrPayload: null },
    });
    return result.count;
  }

  findByUser(userId: string): Promise<BookingWithDetails[]> {
    return this.db.booking.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true,
            venue: { select: { id: true, name: true } },
          },
        },
        tier: { select: { id: true, name: true, priceKes: true } },
      },
    });
  }

  async markCheckedIn(id: string, at: Date): Promise<Booking | null> {
    const result = await this.db.booking.updateMany({
      where: { id, status: BookingStatus.CONFIRMED },
      data: { status: BookingStatus.CHECKED_IN, checkedInAt: at },
    });
    if (result.count !== 1) return null;
    return this.db.booking.findUnique({ where: { id } });
  }

  async getStats(eventIds?: string[]): Promise<BookingStats> {
    if (eventIds && eventIds.length === 0) return emptyStats();
    const map = await this.aggregate(eventIds ? { eventId: { in: eventIds } } : {}, false);
    return map.get('*') ?? emptyStats();
  }

  async getStatsByEvent(eventIds: string[]): Promise<Map<string, BookingStats>> {
    if (eventIds.length === 0) return new Map();
    return this.aggregate({ eventId: { in: eventIds } }, true);
  }

  private async aggregate(where: Prisma.BookingWhereInput, perEvent: boolean): Promise<Map<string, BookingStats>> {
    const rows = await this.db.booking.groupBy({
      by: ['eventId', 'status'],
      where,
      _count: { _all: true },
      _sum: { quantity: true, totalAmountKes: true },
    });

    const result = new Map<string, BookingStats>();
    for (const row of rows) {
      const key = perEvent ? row.eventId : '*';
      const stats = result.get(key) ?? emptyStats();
      const qty = row._sum.quantity ?? 0;

      if (row.status !== BookingStatus.CANCELLED) stats.totalBookings += row._count._all;
      if (SEATED_BOOKING_STATUSES.includes(row.status)) stats.ticketsSold += qty;
      if (row.status === BookingStatus.CHECKED_IN) stats.checkedInTickets += qty;
      if (row.status === BookingStatus.WAITLISTED) stats.waitlisted += qty;
      if (REVENUE_BOOKING_STATUSES.includes(row.status)) stats.revenueKes += row._sum.totalAmountKes ?? 0;

      result.set(key, stats);
    }
    return result;
  }
}
