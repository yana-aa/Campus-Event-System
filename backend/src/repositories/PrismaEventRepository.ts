import type { Prisma } from '@prisma/client';
import type {
  CreateEventData,
  EventSearchCriteria,
  IEventRepository,
  UpdateEventData,
} from '../interfaces';
import type { PrismaExecutor } from '../lib/prisma';
import { EventStatus, type Event, type EventWithDetails } from '../models';

const DETAILS_INCLUDE = {
  venue: true,
  tiers: { orderBy: { priceKes: 'asc' } },
  organizer: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.EventInclude;

export class PrismaEventRepository implements IEventRepository {
  constructor(private readonly db: PrismaExecutor) {}

  findById(id: string): Promise<EventWithDetails | null> {
    return this.db.event.findUnique({ where: { id }, include: DETAILS_INCLUDE });
  }

  search(criteria: EventSearchCriteria): Promise<EventWithDetails[]> {
    const and: Prisma.EventWhereInput[] = [{ status: { in: criteria.statuses } }];

    if (criteria.category) and.push({ category: criteria.category });
    if (criteria.organizerId) and.push({ organizerId: criteria.organizerId });
    if (criteria.dateFrom || criteria.dateTo) {
      and.push({ date: { gte: criteria.dateFrom, lte: criteria.dateTo } });
    }
    if (criteria.accessibleOnly) and.push({ venue: { isAccessible: true } });
    if (criteria.priceType === 'free') {
      and.push({ tiers: { some: {} } }, { tiers: { every: { priceKes: 0 } } });
    } else if (criteria.priceType === 'paid') {
      and.push({ tiers: { some: { priceKes: { gt: 0 } } } });
    }
    if (criteria.search) {
      and.push({
        OR: [{ title: { contains: criteria.search } }, { description: { contains: criteria.search } }],
      });
    }

    return this.db.event.findMany({
      where: { AND: and },
      include: DETAILS_INCLUDE,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  findByOrganizer(organizerId: string): Promise<EventWithDetails[]> {
    return this.db.event.findMany({
      where: { organizerId },
      include: DETAILS_INCLUDE,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  findActiveAtVenueOnDate(venueId: string, date: Date, excludeEventId?: string): Promise<Event[]> {
    return this.db.event.findMany({
      where: {
        venueId,
        date,
        status: { not: EventStatus.CANCELLED },
        ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      },
    });
  }

  create(data: CreateEventData): Promise<EventWithDetails> {
    const { tiers, ...event } = data;
    return this.db.event.create({
      data: {
        ...event,
        tiers: {
          create: tiers.map((t) => ({
            name: t.name,
            description: t.description ?? null,
            priceKes: t.priceKes,
            totalQuantity: t.totalQuantity,
          })),
        },
      },
      include: DETAILS_INCLUDE,
    });
  }

  update(id: string, data: UpdateEventData): Promise<EventWithDetails> {
    return this.db.event.update({ where: { id }, data, include: DETAILS_INCLUDE });
  }

  updateStatus(id: string, status: EventStatus): Promise<Event> {
    return this.db.event.update({ where: { id }, data: { status } });
  }

  async countByStatus(): Promise<Record<EventStatus, number>> {
    const rows = await this.db.event.groupBy({ by: ['status'], _count: { _all: true } });
    const result = Object.fromEntries(Object.values(EventStatus).map((s) => [s, 0])) as Record<EventStatus, number>;
    for (const row of rows) result[row.status] = row._count._all;
    return result;
  }
}
