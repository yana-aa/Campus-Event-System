import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  VenueCapacityExceededError,
  VenueClashError,
} from '../errors/AppError';
import type {
  CreateEventInput,
  CreateTierData,
  EventListQuery,
  IEventRepository,
  IEventService,
  IVenueRepository,
  TokenPayload,
  UpdateEventData,
  UpdateEventInput,
} from '../interfaces';
import { EventStatus, Role, type EventWithDetails, type Venue } from '../models';
import { dateWindow, startOfUtcDay, timeRangesOverlap, timeToMinutes, toCalendarDay } from '../utils/dates';

const PUBLIC_STATUSES: EventStatus[] = [EventStatus.PUBLISHED];
const VISIBLE_TO_ALL: EventStatus[] = [EventStatus.PUBLISHED, EventStatus.COMPLETED];
const LOCKED_STATUSES: EventStatus[] = [EventStatus.CANCELLED, EventStatus.COMPLETED];

interface Schedule {
  venueId: string;
  date: Date;
  startTime: string;
  endTime: string;
}

export class EventService implements IEventService {
  constructor(
    private readonly events: IEventRepository,
    private readonly venues: IVenueRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  listPublished(query: EventListQuery, now: Date = this.clock()): Promise<EventWithDetails[]> {
    const window = query.dateRange ? dateWindow(query.dateRange, now) : undefined;
    return this.events.search({
      statuses: PUBLIC_STATUSES,
      category: query.category,
      dateFrom: window?.from,
      dateTo: window?.to,
      priceType: query.priceType,
      accessibleOnly: query.accessibleOnly,
      search: query.search,
    });
  }

  async getById(eventId: string, viewer?: TokenPayload): Promise<EventWithDetails> {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundError('Event');
    if (VISIBLE_TO_ALL.includes(event.status) || (viewer && this.canManage(viewer, event))) {
      return event;
    }
    throw new NotFoundError('Event');
  }

  async listForOrganizer(organizerId: string): Promise<EventWithDetails[]> {
    return this.events.findByOrganizer(organizerId);
  }

  async create(organizerId: string, input: CreateEventInput): Promise<EventWithDetails> {
    const date = toCalendarDay(input.date);
    this.assertTimes(input.startTime, input.endTime);
    if (date < startOfUtcDay(this.clock())) {
      throw new ValidationError('Event date cannot be in the past');
    }
    this.assertTiers(input.tiers, input.maxCapacity);

    const venue = await this.requireVenue(input.venueId);
    this.assertVenueCapacity(input.maxCapacity, venue);
    await this.assertNoClash({ venueId: venue.id, date, startTime: input.startTime, endTime: input.endTime });

    return this.events.create({
      organizerId,
      venueId: venue.id,
      title: input.title.trim(),
      category: input.category.trim(),
      audience: input.audience.trim(),
      description: input.description.trim(),
      date,
      startTime: input.startTime,
      endTime: input.endTime,
      maxCapacity: input.maxCapacity,
      coverImageUrl: input.coverImageUrl ?? null,
      status: input.submitForApproval === false ? EventStatus.DRAFT : EventStatus.PENDING_APPROVAL,
      tiers: input.tiers,
    });
  }

  async update(actor: TokenPayload, eventId: string, input: UpdateEventInput): Promise<EventWithDetails> {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundError('Event');
    if (!this.canManage(actor, event)) throw new ForbiddenError('Only the event organizer can edit this event');
    if (LOCKED_STATUSES.includes(event.status)) {
      throw new BusinessRuleError(`A ${event.status.toLowerCase()} event can no longer be edited`, 'EVENT_LOCKED');
    }

    const next: Schedule & { maxCapacity: number } = {
      venueId: input.venueId ?? event.venueId,
      date: input.date ? toCalendarDay(input.date) : event.date,
      startTime: input.startTime ?? event.startTime,
      endTime: input.endTime ?? event.endTime,
      maxCapacity: input.maxCapacity ?? event.maxCapacity,
    };
    this.assertTimes(next.startTime, next.endTime);
    if (input.date && next.date < startOfUtcDay(this.clock())) {
      throw new ValidationError('Event date cannot be in the past');
    }

    const venue = next.venueId === event.venueId ? event.venue : await this.requireVenue(next.venueId);
    this.assertVenueCapacity(next.maxCapacity, venue);

    const allocated = event.tiers.reduce((sum, t) => sum + t.totalQuantity, 0);
    if (next.maxCapacity < allocated) {
      throw new BusinessRuleError(
        `Event capacity (${next.maxCapacity}) cannot be lower than tickets allocated across tiers (${allocated})`,
        'CAPACITY_BELOW_ALLOCATION',
      );
    }

    const scheduleChanged =
      next.venueId !== event.venueId ||
      next.date.getTime() !== event.date.getTime() ||
      next.startTime !== event.startTime ||
      next.endTime !== event.endTime;
    if (scheduleChanged) await this.assertNoClash(next, event.id);

    const data: UpdateEventData = {
      venueId: next.venueId,
      date: next.date,
      startTime: next.startTime,
      endTime: next.endTime,
      maxCapacity: next.maxCapacity,
    };
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.category !== undefined) data.category = input.category.trim();
    if (input.audience !== undefined) data.audience = input.audience.trim();
    if (input.description !== undefined) data.description = input.description.trim();
    if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl;
    if (input.submitForApproval && event.status === EventStatus.DRAFT) {
      data.status = EventStatus.PENDING_APPROVAL;
    }

    return this.events.update(event.id, data);
  }

  private canManage(actor: TokenPayload, event: EventWithDetails): boolean {
    return actor.role === Role.ADMIN || (actor.role === Role.ORGANIZER && actor.userId === event.organizerId);
  }

  private async requireVenue(venueId: string): Promise<Venue> {
    const venue = await this.venues.findById(venueId);
    if (!venue) throw new NotFoundError('Venue');
    return venue;
  }

  private assertTimes(startTime: string, endTime: string): void {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new ValidationError('startTime must be before endTime');
    }
  }

  private assertVenueCapacity(maxCapacity: number, venue: Venue): void {
    if (maxCapacity > venue.maxCapacity) throw new VenueCapacityExceededError(maxCapacity, venue.maxCapacity);
  }

  private assertTiers(tiers: CreateTierData[], maxCapacity: number): void {
    if (tiers.length === 0) throw new ValidationError('At least one ticket tier is required');
    const names = new Set(tiers.map((t) => t.name.trim().toLowerCase()));
    if (names.size !== tiers.length) throw new ValidationError('Ticket tier names must be unique');
    const allocated = tiers.reduce((sum, t) => sum + t.totalQuantity, 0);
    if (allocated > maxCapacity) {
      throw new BusinessRuleError(
        `Tickets allocated across tiers (${allocated}) exceed event capacity (${maxCapacity})`,
        'TIER_ALLOCATION_EXCEEDS_CAPACITY',
      );
    }
  }

  private async assertNoClash(schedule: Schedule, excludeEventId?: string): Promise<void> {
    const sameDay = await this.events.findActiveAtVenueOnDate(schedule.venueId, schedule.date, excludeEventId);
    const clashes = sameDay.filter((e) =>
      timeRangesOverlap(schedule.startTime, schedule.endTime, e.startTime, e.endTime),
    );
    if (clashes.length > 0) throw new VenueClashError(clashes.map((e) => e.id));
  }
}
