import type {
  AdminOverview,
  BookingStats,
  IAdminAnalyticsService,
  IBookingStatsRepository,
  IEventRepository,
  IUserRepository,
  KpiSummary,
  OrganizerDashboard,
} from '../interfaces';

const EMPTY: BookingStats = { totalBookings: 0, ticketsSold: 0, checkedInTickets: 0, revenueKes: 0, waitlisted: 0 };

function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Read-only KPI aggregation for organizers and administrators. */
export class AdminAnalyticsService implements IAdminAnalyticsService {
  constructor(
    private readonly events: IEventRepository,
    private readonly bookingStats: IBookingStatsRepository,
    private readonly users: IUserRepository,
  ) {}

  static toKpi(stats: BookingStats): KpiSummary {
    return {
      totalBookings: stats.totalBookings,
      ticketsSold: stats.ticketsSold,
      checkedInTickets: stats.checkedInTickets,
      checkInRatePercent: percent(stats.checkedInTickets, stats.ticketsSold),
      revenueKes: stats.revenueKes,
      waitlisted: stats.waitlisted,
    };
  }

  async getOrganizerDashboard(organizerId: string): Promise<OrganizerDashboard> {
    const events = await this.events.findByOrganizer(organizerId);
    const ids = events.map((e) => e.id);
    const [summary, perEvent] = await Promise.all([
      this.bookingStats.getStats(ids),
      this.bookingStats.getStatsByEvent(ids),
    ]);

    return {
      summary: { ...AdminAnalyticsService.toKpi(summary), totalEvents: events.length },
      events: events.map((event) => {
        const stats = perEvent.get(event.id) ?? EMPTY;
        return {
          eventId: event.id,
          title: event.title,
          status: event.status,
          date: event.date,
          maxCapacity: event.maxCapacity,
          occupancyPercent: percent(stats.ticketsSold, event.maxCapacity),
          ...AdminAnalyticsService.toKpi(stats),
        };
      }),
    };
  }

  async getAdminOverview(): Promise<AdminOverview> {
    const [stats, usersByRole, eventsByStatus] = await Promise.all([
      this.bookingStats.getStats(),
      this.users.countByRole(),
      this.events.countByStatus(),
    ]);
    return { kpis: AdminAnalyticsService.toKpi(stats), usersByRole, eventsByStatus };
  }
}
