import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { organizerApi } from '../../api/endpoints';
import type { CampusEvent, OrganizerEventKpi } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Alert, BarChart, Button, Card, EmptyState, KpiCard, ProgressBar, Spinner, StatusChip, Tabs } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { isPastEvent, seatInfo } from '../../lib/events';
import { formatDateParts, formatEventDate, formatKesAlways, formatMonthLabel, formatTime, startsInLabel } from '../../lib/format';

type Filter = 'all' | 'published' | 'drafts' | 'past';

export function filterOrganizerEvents(events: CampusEvent[], filter: Filter, now: Date = new Date()): CampusEvent[] {
  switch (filter) {
    case 'published':
      return events.filter((e) => e.status === 'PUBLISHED' && !isPastEvent(e, now));
    case 'drafts':
      return events.filter((e) => e.status === 'DRAFT' || e.status === 'PENDING_APPROVAL');
    case 'past':
      return events.filter((e) => isPastEvent(e, now) || e.status === 'CANCELLED');
    default:
      return events;
  }
}

export function OrganizerDashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([organizerApi.dashboard(), organizerApi.events()]).then(([dashboard, ev]) => ({ dashboard, events: ev.events })),
    [],
  );
  const [filter, setFilter] = useState<Filter>('all');

  const kpiById = useMemo(() => new Map<string, OrganizerEventKpi>((data?.dashboard.events ?? []).map((e) => [e.eventId, e])), [data]);
  const nextUp = useMemo(
    () => (data?.events ?? []).filter((e) => e.status === 'PUBLISHED' && !isPastEvent(e)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3),
    [data],
  );

  if (loading && !data) return <Spinner label="Loading dashboard" fullPage />;
  if (error || !data) {
    return (
      <Alert tone="danger" title="Couldn't load your dashboard" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
        {errorMessage(error)}
      </Alert>
    );
  }

  const { summary, monthlyBookings } = data.dashboard;
  const rows = filterOrganizerEvents(data.events, filter);
  const counts = {
    all: data.events.length,
    published: filterOrganizerEvents(data.events, 'published').length,
    drafts: filterOrganizerEvents(data.events, 'drafts').length,
    past: filterOrganizerEvents(data.events, 'past').length,
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Organizer dashboard</h1>
          <p className="text-muted">Welcome back, {user?.fullName}. Here's how your events are doing.</p>
        </div>
        <div className="page-header__actions">
          <Link className="btn btn--secondary" to="/organizer/check-in">
            📷 Door check-in
          </Link>
          <Link className="btn btn--primary" to="/organizer/events/new">
            + Create event
          </Link>
        </div>
      </header>

      <div className="kpi-grid">
        <KpiCard label="Total bookings" value={summary.totalBookings.toLocaleString()} hint={`${summary.ticketsSold} tickets issued`} icon="🎟" />
        <KpiCard label="Upcoming events" value={summary.upcomingEvents} hint={`${summary.totalEvents} events in total`} icon="📅" tone="info" />
        <KpiCard
          label="Check-in rate"
          value={`${summary.checkInRatePercent}%`}
          hint={`${summary.checkedInTickets} of ${summary.ticketsSold} attendees`}
          icon="✅"
          tone="success"
        />
        <KpiCard label="Ticket revenue" value={formatKesAlways(summary.revenueKes)} hint="Confirmed and checked-in" icon="💰" tone="warning" />
      </div>

      <div className="two-col two-col--wide-left">
        <Card title="Monthly bookings" actions={<span className="text-muted text-small">Last 6 months</span>}>
          <BarChart title="Bookings per month" data={monthlyBookings.map((m) => ({ label: formatMonthLabel(m.month), value: m.bookings }))} />
        </Card>
        <Card title="Next up">
          {nextUp.length === 0 ? (
            <p className="text-muted">No upcoming published events. <Link to="/organizer/events/new">Create one</Link>.</p>
          ) : (
            <ul className="next-up">
              {nextUp.map((e) => {
                const { day, month } = formatDateParts(e.date);
                const seats = seatInfo(e);
                return (
                  <li key={e.id} className="next-up__item">
                    <span className="date-tile" aria-hidden="true">
                      <span className="date-tile__day">{day}</span>
                      <span className="date-tile__month">{month}</span>
                    </span>
                    <div className="next-up__info">
                      <Link to={`/events/${e.id}`} className="next-up__title">{e.title}</Link>
                      <span className="text-muted text-small">
                        {startsInLabel(e.date)} · {formatTime(e.startTime)} · {seats.booked}/{seats.capacity} seats
                      </span>
                      <ProgressBar value={seats.booked} max={seats.capacity} label={`${e.title} seats booked`} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="My events" padded={false}>
        <div className="card__toolbar">
          <Tabs<Filter>
            label="Filter events"
            variant="pill"
            active={filter}
            onChange={setFilter}
            items={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'published', label: 'Published', count: counts.published },
              { key: 'drafts', label: 'Drafts', count: counts.drafts },
              { key: 'past', label: 'Past', count: counts.past },
            ]}
          />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="🗂" title="No events in this view" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Seats</th>
                  <th scope="col">Check-in</th>
                  <th scope="col" className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const kpi = kpiById.get(e.id);
                  const seats = seatInfo(e);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link to={`/events/${e.id}`} className="table__primary">{e.title}</Link>
                        <span className="table__secondary">{e.venue.name}</span>
                      </td>
                      <td>{formatEventDate(e.date, 'short')}</td>
                      <td><StatusChip status={e.status} /></td>
                      <td>
                        {seats.booked}/{seats.capacity}
                      </td>
                      <td>{kpi ? `${kpi.checkInRatePercent}%` : '—'}</td>
                      <td className="num">{formatKesAlways(kpi?.revenueKes ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
