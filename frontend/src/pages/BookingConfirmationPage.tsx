import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { bookingsApi } from '../api/endpoints';
import { TicketCard } from '../components/tickets/TicketCard';
import { Alert, Button, EmptyState, Spinner } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { startsInLabel } from '../lib/format';
import { downloadIcs } from '../lib/ics';

export function BookingConfirmationPage() {
  const { bookingId = '' } = useParams();
  const { data, loading, error } = useAsync(() => bookingsApi.mine(), [bookingId]);
  const booking = data?.bookings.find((b) => b.id === bookingId);

  if (loading) return <Spinner label="Loading your ticket" fullPage />;
  if (error || !booking) {
    return (
      <EmptyState
        icon="🎟"
        title="Booking not found"
        description={error ? errorMessage(error) : 'We could not find this booking on your account.'}
        action={<Link className="btn btn--primary" to="/my-tickets">My tickets</Link>}
      />
    );
  }

  const waitlisted = booking.status === 'WAITLISTED';

  return (
    <div className={['celebration', waitlisted && 'celebration--waitlist'].filter(Boolean).join(' ')}>
      <div className="celebration__confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 0.35}s` }} />
        ))}
      </div>
      <div className="celebration__content">
        <h1 className="celebration__title">{waitlisted ? "You're on the waitlist" : "You're in! 🎉"}</h1>
        <p className="celebration__subtitle">
          {waitlisted
            ? "We'll confirm you automatically if a seat frees up, and your QR pass will appear in My tickets."
            : `${startsInLabel(booking.event.date)}. Show this QR pass at the door.`}
        </p>
        <TicketCard booking={booking} qrSize={196} />
        {booking.needsAccessibility && (
          <Alert tone="info">Accessibility support requested. The organizers have been notified.</Alert>
        )}
        <div className="celebration__actions">
          <Button
            variant="secondary"
            size="lg"
            icon={<span aria-hidden="true">📅</span>}
            onClick={() =>
              downloadIcs({
                uid: booking.bookingCode,
                title: booking.event.title,
                description: `CampusPass booking ${booking.bookingCode} · ${booking.quantity} × ${booking.tier.name}`,
                location: booking.event.venue.name,
                date: booking.event.date,
                startTime: booking.event.startTime,
                endTime: booking.event.endTime,
              })
            }
          >
            Add to calendar
          </Button>
          <Link className="btn btn--primary btn--lg" to="/my-tickets">
            My tickets →
          </Link>
        </div>
      </div>
    </div>
  );
}
