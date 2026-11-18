import type { Event, EventStatus, EventWithDetails } from '../models';

export interface EventSearchCriteria {
  statuses: EventStatus[];
  category?: string;
  dateFrom?: Date;
  dateTo?: Date;
  priceType?: 'free' | 'paid';
  accessibleOnly?: boolean;
  search?: string;
  organizerId?: string;
}

export interface CreateTierData {
  name: string;
  description?: string | null;
  priceKes: number;
  totalQuantity: number;
}

export interface CreateEventData {
  organizerId: string;
  venueId: string;
  title: string;
  category: string;
  audience: string;
  description: string;
  date: Date;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  status: EventStatus;
  coverImageUrl?: string | null;
  tiers: CreateTierData[];
}

export type UpdateEventData = Partial<
  Pick<
    CreateEventData,
    | 'venueId'
    | 'title'
    | 'category'
    | 'audience'
    | 'description'
    | 'date'
    | 'startTime'
    | 'endTime'
    | 'maxCapacity'
    | 'coverImageUrl'
    | 'status'
  >
>;

/** Read side used by public listing, booking and check-in flows. */
export interface IEventReader {
  findById(id: string): Promise<EventWithDetails | null>;
}

export interface IEventRepository extends IEventReader {
  search(criteria: EventSearchCriteria): Promise<EventWithDetails[]>;
  findByOrganizer(organizerId: string): Promise<EventWithDetails[]>;
  /** Non-cancelled events booked at a venue on a given calendar day. */
  findActiveAtVenueOnDate(venueId: string, date: Date, excludeEventId?: string): Promise<Event[]>;
  create(data: CreateEventData): Promise<EventWithDetails>;
  update(id: string, data: UpdateEventData): Promise<EventWithDetails>;
  updateStatus(id: string, status: EventStatus): Promise<Event>;
  countByStatus(): Promise<Record<EventStatus, number>>;
}
