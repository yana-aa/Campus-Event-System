import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, errorMessage } from '../api/client';
import { bookingsApi, eventsApi } from '../api/endpoints';
import type { CampusEvent, TicketTier } from '../api/types';
import { Alert, Badge, Button, Card, Checkbox, EmptyState, QuantityStepper, Spinner } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { isTierSoldOut, seatInfo, tierRemaining } from '../lib/events';
import { formatEventDate, formatKes, formatKesAlways, formatTime } from '../lib/format';

export const MAX_TICKETS_PER_STUDENT = 2;
const ACTIVE = new Set(['CONFIRMED', 'WAITLISTED', 'PAYMENT_DUE', 'CHECKED_IN']);

export function BookEventPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useAsync(
    () => Promise.all([eventsApi.get(id), bookingsApi.mine()]).then(([e, b]) => ({ event: e.event, bookings: b.bookings })),
    [id],
  );

  if (loading) return <Spinner label="Loading tickets" fullPage />;
  if (error || !data) {
    return (
      <EmptyState
        icon="🎟"
        title="Couldn't load this event"
        description={errorMessage(error)}
        action={<Link className="btn btn--primary" to="/events">Browse events</Link>}
      />
    );
  }

  const alreadyHeld = data.bookings
    .filter((b) => b.eventId === data.event.id && ACTIVE.has(b.status))
    .reduce((sum, b) => sum + b.quantity, 0);

  return <BookingForm event={data.event} alreadyHeld={alreadyHeld} />;
}

export function BookingForm({ event, alreadyHeld }: { event: CampusEvent; alreadyHeld: number }) {
  const navigate = useNavigate();
  const allowance = Math.max(MAX_TICKETS_PER_STUDENT - alreadyHeld, 0);
  const firstAvailable = event.tiers.find((t) => !isTierSoldOut(t)) ?? event.tiers[0];
  const [tierId, setTierId] = useState<string | undefined>(firstAvailable?.id);
  const [quantity, setQuantity] = useState(1);
  const [needsAccessibility, setNeedsAccessibility] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier: TicketTier | undefined = event.tiers.find((t) => t.id === tierId);
  const seats = seatInfo(event);
  const waitlist = Boolean(tier && (isTierSoldOut(tier) || seats.soldOut));
  const maxQty = Math.max(1, Math.min(allowance, tier && !waitlist ? tierRemaining(tier) : allowance));
  const total = useMemo(() => (tier ? tier.priceKes * quantity : 0), [tier, quantity]);

  useEffect(() => {
    setQuantity((q) => Math.min(Math.max(q, 1), maxQty));
  }, [maxQty]);

  if (event.status !== 'PUBLISHED') {
    return (
      <EmptyState
        icon="⏳"
        title="Booking isn't open yet"
        description="This event is waiting for approval from the campus events office."
        action={<Link className="btn btn--secondary" to={`/events/${event.id}`}>Back to event</Link>}
      />
    );
  }

  const submit = async () => {
    if (!tier) return;
    setSubmitting(true);
    setError(null);
    try {
      const { booking } = await bookingsApi.create({ eventId: event.id, tierId: tier.id, quantity, needsAccessibility });
      navigate(`/bookings/${booking.id}/confirmation`, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'TICKET_LIMIT_EXCEEDED'
          ? `You can hold at most ${MAX_TICKETS_PER_STUDENT} tickets for this event.`
          : errorMessage(err),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Link to={`/events/${event.id}`} className="back-link">
        ← Back to event
      </Link>
      <div className="two-col">
        <div className="stack-lg">
          <header>
            <h1>Choose your tickets</h1>
            <p className="text-muted">
              {event.title} · {formatEventDate(event.date, 'short')} · {formatTime(event.startTime)} · {event.venue.name}
            </p>
          </header>

          {allowance === 0 && (
            <Alert tone="warning" title="Ticket limit reached">
              You already hold {alreadyHeld} tickets for this event (max {MAX_TICKETS_PER_STUDENT} per student).{' '}
              <Link to="/my-tickets">View my tickets</Link>
            </Alert>
          )}

          <fieldset className="tier-list" disabled={allowance === 0}>
            <legend className="sr-only">Ticket tier</legend>
            {event.tiers.map((t) => {
              const soldOut = isTierSoldOut(t);
              const selected = t.id === tierId;
              return (
                <label
                  key={t.id}
                  className={['tier-option', selected && 'tier-option--selected', soldOut && 'tier-option--soldout'].filter(Boolean).join(' ')}
                >
                  <input type="radio" name="tier" value={t.id} checked={selected} onChange={() => setTierId(t.id)} />
                  <span className="tier-option__body">
                    <span className="tier-option__head">
                      <span className="tier-option__name">{t.name}</span>
                      <span className="tier-option__price">{formatKes(t.priceKes)}</span>
                    </span>
                    {t.description && <span className="tier-option__desc">{t.description}</span>}
                    <span className="tier-option__stock">
                      {soldOut ? (
                        <Badge tone="danger">Sold out · join waitlist</Badge>
                      ) : (
                        <span className={tierRemaining(t) <= 10 ? 'text-warning' : 'text-muted'}>{tierRemaining(t)} left</span>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <Card>
            <div className="qty-row">
              <div>
                <p className="qty-row__title">Quantity</p>
                <p className="text-muted text-small">Max {MAX_TICKETS_PER_STUDENT} tickets per student</p>
              </div>
              <QuantityStepper value={quantity} max={maxQty} onChange={setQuantity} disabled={allowance === 0} />
            </div>
            <hr className="divider" />
            <Checkbox
              label="I need accessibility support"
              description={
                event.venue.isAccessible
                  ? 'The organizers will reserve accessible seating and assistance for you.'
                  : 'This venue is not verified as step-free. The organizers will contact you to arrange support.'
              }
              checked={needsAccessibility}
              onChange={(e) => setNeedsAccessibility(e.target.checked)}
            />
          </Card>
        </div>

        <aside className="sticky-col">
          <Card title="Order summary" className="summary">
            {tier ? (
              <>
                <div className="summary__row">
                  <span>
                    {quantity} × {tier.name}
                  </span>
                  <span>{formatKes(tier.priceKes * quantity)}</span>
                </div>
                <div className="summary__row summary__total">
                  <span>Total</span>
                  <span data-testid="booking-total">{formatKesAlways(total)}</span>
                </div>
                {waitlist && (
                  <Alert tone="warning" title="You'll join the waitlist">
                    This tier is full. You'll be confirmed automatically, oldest request first, if a seat frees up.
                  </Alert>
                )}
                {error && <Alert tone="danger">{error}</Alert>}
                <Button block size="lg" onClick={submit} loading={submitting} disabled={allowance === 0}>
                  {waitlist ? 'Join waitlist' : total > 0 ? `Pay ${formatKesAlways(total)} & book` : 'Get free tickets'}
                </Button>
                <p className="text-muted text-small">Your booking is reserved instantly and your QR pass is ready right away.</p>
              </>
            ) : (
              <p className="text-muted">Select a ticket tier.</p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
