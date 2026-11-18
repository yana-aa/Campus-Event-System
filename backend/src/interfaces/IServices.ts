import type {
  AuditLog,
  Booking,
  BookingStats,
  BookingWithDetails,
  EventStatus,
  EventWithDetails,
  PublicUser,
  Role,
  UserStatus,
} from './serviceTypes';
import type { AuditLogQuery, Paginated } from './IAuditLogRepository';
import type { CreateTierData } from './IEventRepository';
import type { TokenPayload } from './ISecurity';

export type { BookingStats };

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
  role?: Role;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface IAuthService {
  register(input: RegisterInput): Promise<AuthResult>;
  login(email: string, password: string): Promise<AuthResult>;
  getProfile(userId: string): Promise<PublicUser>;
}

export type DateRangeFilter = 'today' | 'week' | 'month';

export interface EventListQuery {
  category?: string;
  dateRange?: DateRangeFilter;
  priceType?: 'free' | 'paid';
  accessibleOnly?: boolean;
  search?: string;
}

export interface CreateEventInput {
  venueId: string;
  title: string;
  category: string;
  audience: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  coverImageUrl?: string | null;
  submitForApproval?: boolean;
  tiers: CreateTierData[];
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'tiers'>>;

export interface IEventService {
  listPublished(query: EventListQuery, now?: Date): Promise<EventWithDetails[]>;
  getById(eventId: string, viewer?: TokenPayload): Promise<EventWithDetails>;
  create(organizerId: string, input: CreateEventInput): Promise<EventWithDetails>;
  update(actor: TokenPayload, eventId: string, input: UpdateEventInput): Promise<EventWithDetails>;
}

export interface CreateBookingInput {
  eventId: string;
  tierId: string;
  quantity: number;
  needsAccessibility?: boolean;
}

export interface CancelBookingResult {
  booking: Booking;
  promotedBookingIds: string[];
}

export interface IBookingService {
  book(userId: string, input: CreateBookingInput): Promise<Booking>;
  listForUser(userId: string): Promise<BookingWithDetails[]>;
  cancel(actor: TokenPayload, bookingId: string): Promise<CancelBookingResult>;
}

export interface TicketValidationResult {
  bookingId: string;
  bookingCode: string;
  eventId: string;
  quantity: number;
  status: 'CHECKED_IN';
  checkedInAt: Date;
}

export interface IQRCodeService {
  issue(bookingCode: string, eventId: string, userId: string): string;
  validateAtDoor(actor: TokenPayload, eventId: string, qrPayload: string, now?: Date): Promise<TicketValidationResult>;
}

export interface KpiSummary {
  totalBookings: number;
  ticketsSold: number;
  checkedInTickets: number;
  checkInRatePercent: number;
  revenueKes: number;
  waitlisted: number;
}

export interface OrganizerEventKpi extends KpiSummary {
  eventId: string;
  title: string;
  status: EventStatus;
  date: Date;
  maxCapacity: number;
  occupancyPercent: number;
}

export interface OrganizerDashboard {
  summary: KpiSummary & { totalEvents: number };
  events: OrganizerEventKpi[];
}

export interface AdminOverview {
  kpis: KpiSummary;
  usersByRole: Record<Role, number>;
  eventsByStatus: Record<EventStatus, number>;
}

export interface IAdminAnalyticsService {
  getOrganizerDashboard(organizerId: string): Promise<OrganizerDashboard>;
  getAdminOverview(): Promise<AdminOverview>;
}

export interface IAdminGovernanceService {
  changeEventStatus(adminId: string, eventId: string, status: EventStatus, reason?: string): Promise<EventWithDetails>;
  changeUserStatus(adminId: string, userId: string, status: UserStatus, reason?: string): Promise<PublicUser>;
  listAuditLogs(query: AuditLogQuery): Promise<Paginated<AuditLog>>;
}
