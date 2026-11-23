/** Wire types mirroring the CampusPass backend JSON (dates arrive as ISO strings). */
export type Role = 'STUDENT' | 'ORGANIZER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type EventStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED';
export type BookingStatus = 'CONFIRMED' | 'WAITLISTED' | 'PAYMENT_DUE' | 'CANCELLED' | 'CHECKED_IN';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Venue {
  id: string;
  name: string;
  maxCapacity: number;
  isAccessible: boolean;
}

export interface TicketTier {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  priceKes: number;
  totalQuantity: number;
  soldQuantity: number;
}

export interface CampusEvent {
  id: string;
  organizerId: string;
  venueId: string;
  title: string;
  category: string;
  audience: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  status: EventStatus;
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  venue: Venue;
  tiers: TicketTier[];
  organizer: { id: string; fullName: string; email: string };
}

export interface ClashSummary {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

export interface EventForReview extends CampusEvent {
  clashes: ClashSummary[];
}

export interface Booking {
  id: string;
  bookingCode: string;
  userId: string;
  eventId: string;
  tierId: string;
  quantity: number;
  totalAmountKes: number;
  qrPayload: string | null;
  status: BookingStatus;
  needsAccessibility: boolean;
  checkedInAt: string | null;
  createdAt: string;
}

export interface BookingWithDetails extends Booking {
  event: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    status: EventStatus;
    venue: { id: string; name: string };
  };
  tier: { id: string; name: string; priceKes: number };
}

export interface CreateBookingResponse {
  booking: Booking;
  message: string;
}

export interface CancelBookingResponse {
  booking: Booking;
  promotedBookingIds: string[];
}

export interface TicketValidationResult {
  bookingId: string;
  bookingCode: string;
  eventId: string;
  quantity: number;
  status: 'CHECKED_IN';
  checkedInAt: string;
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
  date: string;
  maxCapacity: number;
  occupancyPercent: number;
}

export interface MonthlyBookingCount {
  month: string;
  bookings: number;
  tickets: number;
}

export interface OrganizerDashboard {
  summary: KpiSummary & { totalEvents: number; upcomingEvents: number };
  events: OrganizerEventKpi[];
  monthlyBookings: MonthlyBookingCount[];
}

export interface AdminOverview {
  kpis: KpiSummary;
  usersByRole: Record<Role, number>;
  eventsByStatus: Record<EventStatus, number>;
  openReports: number;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string; role: Role } | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TierInput {
  name: string;
  description?: string | null;
  priceKes: number;
  totalQuantity: number;
}

export interface CreateEventPayload {
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
  submitForApproval: boolean;
  tiers: TierInput[];
}

export interface EventFilters {
  category?: string;
  dateRange?: 'today' | 'week' | 'month';
  priceType?: 'free' | 'paid';
  accessibleOnly?: boolean;
  search?: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
