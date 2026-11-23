import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, errorMessage } from '../api/client';
import { eventsApi, reportsApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';
import { EventCover } from '../components/events/EventCard';
import { Alert, Badge, Button, Card, EmptyState, Modal, ProgressBar, Spinner, StatusChip, TextArea } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { buildSchedule, isPastEvent, isTierSoldOut, priceLabel, seatInfo } from '../lib/events';
import { useFollowClub } from '../lib/follow';
import { formatEventDate, formatKes, formatTime, initials, startsInLabel } from '../lib/format';

export function EventDetailsPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => eventsApi.get(id), [id]);
  const event = data?.event;
  const [following, toggleFollow] = useFollowClub(event?.organizerId ?? '');
  const [reportOpen, setReportOpen] = useState(false);

  if (loading) return <Spinner label="Loading event" fullPage />;
  if (error || !event) {
    return (
      <EmptyState
        icon="🔎"
        title={error instanceof ApiError && error.status === 404 ? 'Event not found' : "Couldn't load this event"}
        description={error instanceof ApiError && error.status === 404 ? 'It may have been removed or is not published yet.' : errorMessage(error)}
        action={<Link className="btn btn--primary" to="/events">Browse events</Link>}
      />
    );
  }

  const seats = seatInfo(event);
  const past = isPastEvent(event);
  const bookable = event.status === 'PUBLISHED' && !past;
  const canBook = !user || user.role === 'STUDENT';
  const bookHref = user ? `/events/${event.id}/book` : `/login?next=${encodeURIComponent(`/events/${event.id}/book`)}`;

  return (
    <div className="page event-details">
      <section className="event-hero">
        <EventCover event={event} className="event-hero__cover" />
        <div className="event-hero__overlay">
          <div className="event-hero__badges">
            <Badge tone="brand">{event.category}</Badge>
            <Badge tone="neutral">{event.audience}</Badge>
            {event.status !== 'PUBLISHED' && <StatusChip status={event.status} />}
          </div>
          <h1 className="event-hero__title">{event.title}</h1>
          <p className="event-hero__meta">
            📅 {formatEventDate(event.date)} · 🕘 {formatTime(event.startTime)} – {formatTime(event.endTime)} · 📍 {event.venue.name}
          </p>
          {!past && <p className="event-hero__countdown">{startsInLabel(event.date)}</p>}
        </div>
      </section>

      <div className="two-col">
        <div className="stack-lg">
          <Card>
            <div className="host">
              <span className="avatar avatar--lg" aria-hidden="true">
                {initials(event.organizer.fullName)}
              </span>
              <div className="host__text">
                <span className="text-muted">Hosted by</span>
                <span className="host__name">
                  {event.organizer.fullName} <Badge tone="info" icon="✓">Verified club</Badge>
                </span>
              </div>
              <Button
                variant={following ? 'secondary' : 'primary'}
                size="sm"
                aria-pressed={following}
                onClick={toggleFollow}
              >
                {following ? '✓ Following' : '+ Follow'}
              </Button>
            </div>
          </Card>

          <Card title="About this event">
            <p className="prose">{event.description}</p>
          </Card>

          <Card title="Schedule">
            <ol className="timeline">
              {buildSchedule(event).map((item) => (
                <li key={`${item.time}-${item.title}`} className="timeline__item">
                  <span className="timeline__time">{formatTime(item.time)}</span>
                  <div>
                    <p className="timeline__title">{item.title}</p>
                    <p className="text-muted">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Accessibility" className={event.venue.isAccessible ? 'a11y-box a11y-box--ok' : 'a11y-box'}>
            <div className="a11y-box__row">
              <span className="a11y-box__icon" aria-hidden="true">♿</span>
              <div>
                <p className="a11y-box__title">
                  {event.venue.isAccessible ? `${event.venue.name} is wheelchair accessible` : `${event.venue.name} has not been verified as step-free`}
                </p>
                <p className="text-muted">
                  {event.venue.isAccessible
                    ? 'The venue has step-free entry. Tick "I need accessibility support" when booking and the organizers will reserve accessible seating and assistance for you.'
                    : 'If you need step-free access, seating or other support, tick "I need accessibility support" when booking and the organizers will contact you to arrange it.'}
                </p>
              </div>
            </div>
          </Card>

          {user && (
            <p>
              <button type="button" className="link-btn" onClick={() => setReportOpen(true)}>
                ⚑ Report this event
              </button>
            </p>
          )}
        </div>

        <aside className="sticky-col">
          <Card className="booking-panel">
            <p className="booking-panel__price">{priceLabel(event)}</p>
            <div className="seat-meter">
              <div className="seat-meter__row">
                <span>
                  <strong>{seats.booked}</strong> / {seats.capacity} seats booked
                </span>
                <span className="text-muted">{seats.percent}%</span>
              </div>
              <ProgressBar value={seats.booked} max={seats.capacity} label="Seats booked" tone={seats.soldOut ? 'danger' : seats.urgent ? 'warning' : 'brand'} />
              {seats.soldOut ? (
                <span className="pill pill--danger">Sold out · join the waitlist</span>
              ) : (
                seats.urgent && <span className="pill pill--warning">🔥 Only {seats.remaining} spots left, book soon</span>
              )}
            </div>
            <ul className="tier-summary">
              {event.tiers.map((tier) => (
                <li key={tier.id}>
                  <span>{tier.name}</span>
                  <span>{isTierSoldOut(tier) ? <Badge tone="neutral">Sold out</Badge> : formatKes(tier.priceKes)}</span>
                </li>
              ))}
            </ul>
            {bookable && canBook ? (
              <Link className="btn btn--primary btn--lg btn--block" to={bookHref}>
                {seats.soldOut ? 'Join waitlist' : 'Book tickets'}
              </Link>
            ) : bookable ? (
              <Alert tone="info">Only student accounts can book tickets.</Alert>
            ) : (
              <Alert tone="info">{past ? 'This event has ended.' : 'Booking opens once this event is approved.'}</Alert>
            )}
            <p className="text-muted text-small">Max 2 tickets per student. Free cancellation until the event starts.</p>
          </Card>
        </aside>
      </div>

      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} eventId={event.id} />
    </div>
  );
}

function ReportModal({ open, onClose, eventId }: { open: boolean; onClose(): void; eventId: string }) {
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    onClose();
    setTimeout(() => {
      setReason('');
      setState('idle');
      setError(null);
    }, 0);
  };

  const submit = async () => {
    setState('sending');
    setError(null);
    try {
      await reportsApi.create({ targetType: 'EVENT', targetId: eventId, reason });
      setState('sent');
    } catch (err) {
      setError(errorMessage(err));
      setState('idle');
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Report this event"
      size="sm"
      footer={
        state === 'sent' ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="danger" onClick={submit} loading={state === 'sending'} disabled={reason.trim().length < 5}>
              Send report
            </Button>
          </>
        )
      }
    >
      {state === 'sent' ? (
        <Alert tone="success" title="Thanks, report received">The campus events office will review it.</Alert>
      ) : (
        <>
          {error && <Alert tone="danger">{error}</Alert>}
          <TextArea
            label="What's wrong?"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            hint="e.g. ticket resale, misleading details, safety concerns"
          />
        </>
      )}
    </Modal>
  );
}
