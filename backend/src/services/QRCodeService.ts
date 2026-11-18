import { ForbiddenError, InvalidTicketError, NotFoundError, TicketAlreadyUsedError } from '../errors/AppError';
import type {
  IBookingCheckInRepository,
  IEventReader,
  IQRCodeGenerator,
  IQRCodeService,
  TicketValidationResult,
  TokenPayload,
} from '../interfaces';
import { BookingStatus, EventStatus, Role } from '../models';

/** Issues signed ticket payloads and performs anti-fraud door check-in. */
export class QRCodeService implements IQRCodeService {
  constructor(
    private readonly generator: IQRCodeGenerator,
    private readonly bookings: IBookingCheckInRepository,
    private readonly events: IEventReader,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  issue(bookingCode: string, eventId: string, userId: string): string {
    return this.generator.generate({ bookingCode, eventId, userId });
  }

  async validateAtDoor(
    actor: TokenPayload,
    eventId: string,
    qrPayload: string,
    now: Date = this.clock(),
  ): Promise<TicketValidationResult> {
    const event = await this.events.findById(eventId);
    if (!event) throw new NotFoundError('Event');
    if (actor.role !== Role.ADMIN && event.organizerId !== actor.userId) {
      throw new ForbiddenError('Only the organizer of this event can check in tickets');
    }
    if (event.status !== EventStatus.PUBLISHED) {
      throw new InvalidTicketError('This event is not open for check-in');
    }

    const claims = this.generator.verify(qrPayload);
    if (!claims) throw new InvalidTicketError('Ticket signature is invalid');
    if (claims.eventId !== eventId) throw new InvalidTicketError('Ticket belongs to a different event');

    const booking = await this.bookings.findByCode(claims.bookingCode);
    if (!booking || booking.eventId !== eventId || booking.userId !== claims.userId) {
      throw new InvalidTicketError('Ticket does not match any booking');
    }

    switch (booking.status) {
      case BookingStatus.CHECKED_IN:
        throw new TicketAlreadyUsedError(booking.checkedInAt);
      case BookingStatus.CANCELLED:
        throw new InvalidTicketError('Booking has been cancelled');
      case BookingStatus.WAITLISTED:
      case BookingStatus.PAYMENT_DUE:
        throw new InvalidTicketError('Booking is not confirmed');
      case BookingStatus.CONFIRMED:
        break;
      default:
        throw new InvalidTicketError('Booking is not valid for entry');
    }
    // A re-issued payload (e.g. after waitlist promotion) supersedes older ones.
    if (booking.qrPayload !== qrPayload) throw new InvalidTicketError('Ticket has been superseded');

    const checkedIn = await this.bookings.markCheckedIn(booking.id, now);
    if (!checkedIn) {
      // Lost a race with a concurrent scan of the same ticket.
      const latest = await this.bookings.findByCode(booking.bookingCode);
      throw new TicketAlreadyUsedError(latest?.checkedInAt ?? null);
    }

    return {
      bookingId: checkedIn.id,
      bookingCode: checkedIn.bookingCode,
      eventId: checkedIn.eventId,
      quantity: checkedIn.quantity,
      status: 'CHECKED_IN',
      checkedInAt: checkedIn.checkedInAt ?? now,
    };
  }
}
