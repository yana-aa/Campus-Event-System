import type {
  AdminOverview,
  BookingStats,
  IAdminAnalyticsService,
  IBookingStatsRepository,
  IEventRepository,
  IReportRepository,
  MonthlyBookingCount,
  IUserRepository,
  KpiSummary,
  OrganizerDashboard,
} from '../interfaces';
import { EventStatus, ReportStatus } from '../models';
import { startOfUtcDay } from '../utils/dates';

const MONTHS_IN_CHART = 6;

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
    private readonly reports: IReportRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Zero-filled list of the last `count` UTC months ending with the current one. */
  static lastMonths(now: Date, count: number): string[] {
    const months: string[] = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push(d.toISOString().slice(0, 7));
    }
    return months;
  }

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
    const now = this.clock();
    const months = AdminAnalyticsService.lastMonths(now, MONTHS_IN_CHART);
    const since = new Date(`${months[0]}-01T00:00:00.000Z`);
    const [summary, perEvent, monthly] = await Promise.all([
      this.bookingStats.getStats(ids),
      this.bookingStats.getStatsByEvent(ids),
      this.bookingStats.getMonthlyBookings(ids, since),
    ]);
    const byMonth = new Map(monthly.map((m) => [m.month, m]));
    const monthlyBookings: MonthlyBookingCount[] = months.map(
      (month) => byMonth.get(month) ?? { month, bookings: 0, tickets: 0 },
    );
    const today = startOfUtcDay(now);
    const upcomingEvents = events.filter((e) => e.status === EventStatus.PUBLISHED && e.date >= today).length;

    return {
      monthlyBookings,
      summary: { ...AdminAnalyticsService.toKpi(summary), totalEvents: events.length, upcomingEvents },
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
    const [stats, usersByRole, eventsByStatus, openReports] = await Promise.all([
      this.bookingStats.getStats(),
      this.users.countByRole(),
      this.events.countByStatus(),
      this.reports.countByStatus(ReportStatus.OPEN),
    ]);
    return { kpis: AdminAnalyticsService.toKpi(stats), usersByRole, eventsByStatus, openReports };
  }
}
