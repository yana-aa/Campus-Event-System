import type { CampusEvent, TicketTier } from '../api/types';
import { daysUntil } from './format';

export interface SeatInfo {
  booked: number;
  capacity: number;
  remaining: number;
  percent: number;
  soldOut: boolean;
  /** Fewer than 30% (or 10) seats remain. */
  urgent: boolean;
}

export function seatInfo(event: Pick<CampusEvent, 'tiers' | 'maxCapacity'>): SeatInfo {
  const booked = Math.min(
    event.tiers.reduce((sum, t) => sum + t.soldQuantity, 0),
    event.maxCapacity,
  );
  const remaining = Math.max(event.maxCapacity - booked, 0);
  const percent = event.maxCapacity > 0 ? Math.round((booked / event.maxCapacity) * 100) : 0;
  return {
    booked,
    capacity: event.maxCapacity,
    remaining,
    percent,
    soldOut: remaining === 0,
    urgent: remaining > 0 && remaining <= Math.max(10, Math.round(event.maxCapacity * 0.3)),
  };
}

export function tierRemaining(tier: TicketTier): number {
  return Math.max(tier.totalQuantity - tier.soldQuantity, 0);
}

export function isTierSoldOut(tier: TicketTier): boolean {
  return tierRemaining(tier) === 0;
}

export function priceLabel(event: Pick<CampusEvent, 'tiers'>): string {
  if (event.tiers.length === 0) return 'Free';
  const paid = event.tiers.filter((t) => t.priceKes > 0).map((t) => t.priceKes);
  if (paid.length === 0) return 'Free';
  const min = Math.min(...paid);
  const hasFree = event.tiers.some((t) => t.priceKes === 0);
  return `${hasFree ? 'Free – ' : 'From '}KES ${min.toLocaleString('en-KE')}`;
}

export function isPastEvent(event: Pick<CampusEvent, 'date' | 'status'>, now: Date = new Date()): boolean {
  return event.status === 'COMPLETED' || daysUntil(event.date, now) < 0;
}

function shift(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(Math.max(h * 60 + m + minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface ScheduleItem {
  time: string;
  title: string;
  description: string;
}

/** Event-day timeline derived from the event's start and end times. */
export function buildSchedule(event: Pick<CampusEvent, 'startTime' | 'endTime' | 'venue'>): ScheduleItem[] {
  const [sh, sm] = event.startTime.split(':').map(Number);
  const [eh, em] = event.endTime.split(':').map(Number);
  const duration = eh * 60 + em - (sh * 60 + sm);
  const items: ScheduleItem[] = [
    {
      time: shift(event.startTime, -30),
      title: 'Doors open & check-in',
      description: `Have your QR pass ready at the ${event.venue.name} entrance.`,
    },
    { time: event.startTime, title: 'Kick-off', description: 'Welcome and introductions from the host club.' },
  ];
  if (duration >= 120) {
    items.push({
      time: shift(event.startTime, Math.round(duration / 2 / 15) * 15),
      title: 'Break',
      description: 'Refreshments and networking.',
    });
  }
  if (duration >= 60) {
    items.push({ time: shift(event.endTime, -15), title: 'Wrap-up', description: 'Closing remarks and next steps.' });
  }
  items.push({ time: event.endTime, title: 'Event ends', description: 'Thanks for coming!' });
  return items;
}

export const EVENT_CATEGORIES = ['Technology', 'Workshop', 'Music', 'Sports', 'Career', 'Culture', 'Wellness'] as const;
