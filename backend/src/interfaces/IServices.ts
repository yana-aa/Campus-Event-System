import type {
  AuditLogView,
  Booking,
  BookingStats,
  BookingWithDetails,
  EventForReview,
  EventStatus,
  EventWithDetails,
  MonthlyBookingCount,
  Report,
  PublicUser,
  Role,
  UserStatus,
} from './serviceTypes';
import type { AuditLogQuery, Paginated } from './IAuditLogRepository';
import type { CreateTierData } from './IEventRepository';
import type { TokenPayload } from './ISecurity';
import type { CreateReportData } from './IReportRepository';
import type { UserListQuery } from './IUserRepository';

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
  listForOrganizer(organizerId: string): Promise<EventWithDetails[]>;
  /** Events in a status (e.g. PENDING_APPROVAL) annotated with venue clashes. */
  listForReview(status: EventStatus): Promise<EventForReview[]>;
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
  /** Manual fallback when a QR cannot be scanned: the organizer types the booking code. */
  validateByCode(actor: TokenPayload, eventId: string, bookingCode: string, now?: Date): Promise<TicketValidationResult>;
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
  summary: KpiSummary & { totalEvents: number; upcomingEvents: number };
  events: OrganizerEventKpi[];
  /** Last 6 months, oldest first, zero-filled. */
  monthlyBookings: MonthlyBookingCount[];
}

export interface AdminOverview {
  kpis: KpiSummary;
  usersByRole: Record<Role, number>;
  eventsByStatus: Record<EventStatus, number>;
  openReports: number;
}

export interface IAdminAnalyticsService {
  getOrganizerDashboard(organizerId: string): Promise<OrganizerDashboard>;
  getAdminOverview(): Promise<AdminOverview>;
}

export interface IAdminGovernanceService {
  changeEventStatus(adminId: string, eventId: string, status: EventStatus, reason?: string): Promise<EventWithDetails>;
  changeUserStatus(adminId: string, userId: string, status: UserStatus, reason?: string): Promise<PublicUser>;
  listAuditLogs(query: AuditLogQuery): Promise<Paginated<AuditLogView>>;
  listUsers(query: UserListQuery): Promise<Paginated<PublicUser>>;
}

export type CreateReportInput = Omit<CreateReportData, 'reporterId'>;

export interface IReportService {
  create(reporterId: string, input: CreateReportInput): Promise<Report>;
}
