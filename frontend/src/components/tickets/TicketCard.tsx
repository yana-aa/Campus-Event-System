import { QRCodeSVG } from 'qrcode.react';
import type { BookingWithDetails } from '../../api/types';
import { formatEventDate, formatKes, formatTime } from '../../lib/format';
import { StatusChip } from '../ui';

interface TicketCardProps {
  booking: BookingWithDetails;
  qrSize?: number;
}

/** Perforated digital ticket. The QR encodes the signed payload checked at the door. */
export function TicketCard({ booking, qrSize = 176 }: TicketCardProps) {
  const { event, tier } = booking;
  return (
    <article className="ticket" aria-label={`Ticket ${booking.bookingCode}`}>
      <div className="ticket__main">
        <div className="ticket__top">
          <span className="ticket__brand">CampusPass</span>
          <StatusChip status={booking.status} />
        </div>
        <h3 className="ticket__title">{event.title}</h3>
        <dl className="ticket__details">
          <div>
            <dt>Date</dt>
            <dd>{formatEventDate(event.date, 'short')}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>
              {formatTime(event.startTime)} – {formatTime(event.endTime)}
            </dd>
          </div>
          <div>
            <dt>Venue</dt>
            <dd>{event.venue.name}</dd>
          </div>
          <div>
            <dt>Ticket</dt>
            <dd>
              {booking.quantity} × {tier.name}
            </dd>
          </div>
          <div>
            <dt>Paid</dt>
            <dd>{formatKes(booking.totalAmountKes)}</dd>
          </div>
          {booking.needsAccessibility && (
            <div>
              <dt>Support</dt>
              <dd>♿ Accessibility requested</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="ticket__perforation" aria-hidden="true" />
      <div className="ticket__stub">
        {booking.qrPayload ? (
          <div className="ticket__qr" data-testid="ticket-qr">
            <QRCodeSVG value={booking.qrPayload} size={qrSize} level="M" marginSize={1} title={`QR code for ${booking.bookingCode}`} />
          </div>
        ) : (
          <div className="ticket__qr ticket__qr--pending">
            <span aria-hidden="true">⏳</span>
            <p>
              {booking.status === 'WAITLISTED'
                ? 'Your QR pass appears here as soon as a seat frees up.'
                : booking.status === 'CANCELLED'
                  ? 'This ticket was cancelled.'
                  : 'QR pass unavailable.'}
            </p>
          </div>
        )}
        <p className="ticket__code-label">Booking code</p>
        <p className="ticket__code">{booking.bookingCode}</p>
      </div>
    </article>
  );
}
