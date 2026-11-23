import { apiRequest } from './client';
import type {
  AdminOverview,
  AuditLog,
  AuthResponse,
  BookingWithDetails,
  CampusEvent,
  CancelBookingResponse,
  CreateBookingResponse,
  CreateEventPayload,
  EventFilters,
  EventForReview,
  EventStatus,
  OrganizerDashboard,
  Paginated,
  Role,
  TicketValidationResult,
  User,
  UserStatus,
  Venue,
} from './types';

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (input: { fullName: string; email: string; password: string; role: Role }) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input }),
  me: () => apiRequest<{ user: User }>('/auth/me'),
};

export const eventsApi = {
  list: (filters: EventFilters = {}, signal?: AbortSignal) =>
    apiRequest<{ count: number; events: CampusEvent[] }>('/events', { query: { ...filters }, signal }),
  get: (id: string) => apiRequest<{ event: CampusEvent }>(`/events/${encodeURIComponent(id)}`),
  create: (payload: CreateEventPayload) => apiRequest<{ event: CampusEvent }>('/events', { method: 'POST', body: payload }),
  venues: () => apiRequest<{ venues: Venue[] }>('/venues'),
};

export const bookingsApi = {
  create: (input: { eventId: string; tierId: string; quantity: number; needsAccessibility: boolean }) =>
    apiRequest<CreateBookingResponse>('/bookings', { method: 'POST', body: input }),
  mine: () => apiRequest<{ count: number; bookings: BookingWithDetails[] }>('/bookings/me'),
  cancel: (id: string) => apiRequest<CancelBookingResponse>(`/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export const ticketsApi = {
  validate: (input: { eventId: string; qrPayload?: string; bookingCode?: string }) =>
    apiRequest<{ valid: true; ticket: TicketValidationResult }>('/tickets/validate', { method: 'POST', body: input }),
};

export const organizerApi = {
  dashboard: () => apiRequest<OrganizerDashboard>('/organizer/dashboard'),
  events: () => apiRequest<{ count: number; events: CampusEvent[] }>('/organizer/events'),
};

export const reportsApi = {
  create: (input: { targetType: 'EVENT' | 'USER'; targetId: string; reason: string }) =>
    apiRequest<{ report: { id: string } }>('/reports', { method: 'POST', body: input }),
};

export const adminApi = {
  overview: () => apiRequest<AdminOverview>('/admin/overview'),
  reviewQueue: (status: EventStatus = 'PENDING_APPROVAL') =>
    apiRequest<{ count: number; events: EventForReview[] }>('/admin/events', { query: { status } }),
  setEventStatus: (id: string, status: EventStatus, reason?: string) =>
    apiRequest<{ event: CampusEvent }>(`/admin/events/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, reason },
    }),
  users: (query: { search?: string; role?: Role; page?: number; pageSize?: number } = {}) =>
    apiRequest<Paginated<User>>('/admin/users', { query }),
  setUserStatus: (id: string, status: UserStatus, reason?: string) =>
    apiRequest<{ user: User }>(`/admin/users/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { status, reason },
    }),
  auditLogs: (query: { page?: number; pageSize?: number; action?: string } = {}) =>
    apiRequest<Paginated<AuditLog>>('/admin/audit-logs', { query }),
};
