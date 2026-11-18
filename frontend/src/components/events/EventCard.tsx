import { Link } from 'react-router-dom';
import type { CampusEvent } from '../../api/types';
import { priceLabel, seatInfo } from '../../lib/events';
import { formatDateParts, formatEventDate, formatTime } from '../../lib/format';
import { Badge, ProgressBar } from '../ui';

export function EventCover({ event, className }: { event: Pick<CampusEvent, 'coverImageUrl' | 'category' | 'title'>; className?: string }) {
  return (
    <div
      className={['event-cover', `event-cover--${event.category.toLowerCase().replace(/[^a-z]/g, '')}`, className]
        .filter(Boolean)
        .join(' ')}
      style={event.coverImageUrl ? { backgroundImage: `url("${event.coverImageUrl}")` } : undefined}
      role="img"
      aria-label={event.coverImageUrl ? `Cover image for ${event.title}` : `${event.category} event`}
    >
      {!event.coverImageUrl && <span className="event-cover__glyph">{event.category.charAt(0)}</span>}
    </div>
  );
}

interface EventCardProps {
  event: CampusEvent;
  /** Preview mode renders without a link (used by the create-event wizard). */
  preview?: boolean;
}

export function EventCard({ event, preview = false }: EventCardProps) {
  const seats = seatInfo(event);
  const { day, month } = formatDateParts(event.date);
  const body = (
    <>
      <div className="event-card__media">
        <EventCover event={event} />
        <span className="event-card__date" aria-hidden="true">
          <span className="event-card__date-day">{day}</span>
          <span className="event-card__date-month">{month}</span>
        </span>
        {event.venue.isAccessible && (
          <span className="event-card__a11y" title="Accessible venue">
            ♿ Accessible
          </span>
        )}
      </div>
      <div className="event-card__body">
        <div className="event-card__meta">
          <Badge tone="brand">{event.category}</Badge>
          <span className="event-card__price">{priceLabel(event)}</span>
        </div>
        <h3 className="event-card__title">{event.title || 'Untitled event'}</h3>
        <p className="event-card__info">
          {formatEventDate(event.date, 'short')} · {formatTime(event.startTime)}
        </p>
        <p className="event-card__info">📍 {event.venue.name || 'Venue to be confirmed'}</p>
        <p className="event-card__host">Hosted by {event.organizer.fullName}</p>
        <div className="event-card__seats">
          <ProgressBar
            value={seats.booked}
            max={seats.capacity}
            label="Seats booked"
            tone={seats.soldOut ? 'danger' : seats.urgent ? 'warning' : 'brand'}
          />
          <span className={seats.urgent || seats.soldOut ? 'text-warning' : 'text-muted'}>
            {seats.soldOut ? 'Sold out · waitlist open' : `${seats.remaining} spots left`}
          </span>
        </div>
      </div>
    </>
  );

  if (preview) return <article className="event-card event-card--preview">{body}</article>;
  return (
    <article className="event-card">
      <Link to={`/events/${event.id}`} className="event-card__link" aria-label={`${event.title}, ${formatEventDate(event.date)}`}>
        {body}
      </Link>
    </article>
  );
}
