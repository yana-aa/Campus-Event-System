import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { bookingsApi } from '../api/endpoints';
import type { BookingWithDetails } from '../api/types';
import { TicketCard } from '../components/tickets/TicketCard';
import { Alert, Button, EmptyState, Modal, Spinner, StatusChip, Tabs } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { daysUntil, formatDateParts, formatEventDate, formatKes, formatTime, startsInLabel } from '../lib/format';

type TabKey = 'upcoming' | 'past' | 'waitlist';

export function groupBookings(bookings: BookingWithDetails[], now: Date = new Date()) {
  const upcoming: BookingWithDetails[] = [];
  const past: BookingWithDetails[] = [];
  const waitlist: BookingWithDetails[] = [];
  for (const b of bookings) {
    const isPast = daysUntil(b.event.date, now) < 0 || b.event.status === 'COMPLETED';
    if (!isPast && b.status === 'WAITLISTED') waitlist.push(b);
    else if (!isPast && b.status !== 'CANCELLED' && b.event.status !== 'CANCELLED') upcoming.push(b);
    else past.push(b);
  }
  const byDate = (a: BookingWithDetails, b: BookingWithDetails) => a.event.date.localeCompare(b.event.date);
  upcoming.sort(byDate);
  waitlist.sort(byDate);
  past.sort((a, b) => -byDate(a, b));
  return { upcoming, past, waitlist };
}

export function MyTicketsPage() {
  const { data, loading, error, reload } = useAsync(() => bookingsApi.mine(), []);
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [passFor, setPassFor] = useState<BookingWithDetails | null>(null);
  const [cancelFor, setCancelFor] = useState<BookingWithDetails | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const groups = useMemo(() => groupBookings(data?.bookings ?? []), [data]);
  const next = groups.upcoming.find((b) => b.status === 'CONFIRMED' || b.status === 'PAYMENT_DUE');
  const list = groups[tab];

  const confirmCancel = async () => {
    if (!cancelFor) return;
    setCancelling(true);
    try {
      await bookingsApi.cancel(cancelFor.id);
      setNotice({ tone: 'success', text: `Booking ${cancelFor.bookingCode} cancelled. Your seat has been released.` });
      setCancelFor(null);
      reload();
    } catch (err) {
      setNotice({ tone: 'danger', text: errorMessage(err) });
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !data) return <Spinner label="Loading your tickets" fullPage />;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>My tickets</h1>
          <p className="text-muted">Your passes, waitlist spots and past events.</p>
        </div>
        <Link className="btn btn--secondary" to="/events">
          Find events
        </Link>
      </header>

      {Boolean(error) && (
        <Alert tone="danger" title="Couldn't load tickets" action={<Button size="sm" variant="secondary" onClick={reload}>Retry</Button>}>
          {errorMessage(error)}
        </Alert>
      )}
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

      {next && (
        <div className="reminder" role="status">
          <span className="reminder__icon" aria-hidden="true">⏰</span>
          <div className="reminder__text">
            <strong>
              {startsInLabel(next.event.date)}: {next.event.title}
            </strong>
            <span>
              {formatEventDate(next.event.date, 'short')} at {formatTime(next.event.startTime)} · {next.event.venue.name}
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setPassFor(next)}>
            Show QR pass
          </Button>
        </div>
      )}

      <Tabs<TabKey>
        label="Ticket groups"
        active={tab}
        onChange={setTab}
        items={[
          { key: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
          { key: 'past', label: 'Past', count: groups.past.length },
          { key: 'waitlist', label: 'Waitlist', count: groups.waitlist.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={tab === 'waitlist' ? '🕒' : tab === 'past' ? '📜' : '🎟'}
          title={tab === 'upcoming' ? 'No upcoming tickets' : tab === 'past' ? 'No past events yet' : "You're not on any waitlists"}
          action={tab === 'upcoming' ? <Link className="btn btn--primary" to="/events">Explore events</Link> : undefined}
        />
      ) : (
        <ul className="ticket-list">
          {list.map((b) => {
            const { day, month } = formatDateParts(b.event.date);
            const cancellable = tab !== 'past' && (b.status === 'CONFIRMED' || b.status === 'WAITLISTED' || b.status === 'PAYMENT_DUE');
            return (
              <li key={b.id} className="ticket-row">
                <span className="date-tile" aria-hidden="true">
                  <span className="date-tile__day">{day}</span>
                  <span className="date-tile__month">{month}</span>
                </span>
                <div className="ticket-row__info">
                  <div className="ticket-row__head">
                    <Link to={`/events/${b.event.id}`} className="ticket-row__title">
                      {b.event.title}
                    </Link>
                    <StatusChip status={b.status} />
                  </div>
                  <p className="text-muted">
                    {formatTime(b.event.startTime)} · {b.event.venue.name} · {b.quantity} × {b.tier.name} · {formatKes(b.totalAmountKes)}
                  </p>
                  <p className="text-small mono">{b.bookingCode}</p>
                </div>
                <div className="ticket-row__actions">
                  {b.qrPayload && b.status !== 'CANCELLED' && (
                    <Button size="sm" onClick={() => setPassFor(b)}>
                      View QR pass
                    </Button>
                  )}
                  {cancellable && (
                    <Button size="sm" variant="ghost" onClick={() => setCancelFor(b)}>
                      Cancel booking
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={Boolean(passFor)} onClose={() => setPassFor(null)} title="Your QR pass">
        {passFor && (
          <div className="stack">
            <TicketCard booking={passFor} qrSize={240} />
            <p className="text-muted text-center text-small">Turn up your screen brightness for a faster scan at the door.</p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(cancelFor)}
        onClose={() => setCancelFor(null)}
        title="Cancel this booking?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelFor(null)}>
              Keep ticket
            </Button>
            <Button variant="danger" loading={cancelling} onClick={confirmCancel}>
              Yes, cancel booking
            </Button>
          </>
        }
      >
        {cancelFor && (
          <p>
            Your {cancelFor.quantity} × {cancelFor.tier.name} ticket for <strong>{cancelFor.event.title}</strong> ({cancelFor.bookingCode}) will be
            released to the next student on the waitlist. This can't be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}
