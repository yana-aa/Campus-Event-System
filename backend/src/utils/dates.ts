import { ValidationError } from '../errors/AppError';
import type { DateRangeFilter } from '../interfaces';

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse "YYYY-MM-DD" (or an ISO string) to that calendar day at 00:00 UTC. */
export function toCalendarDay(input: string | Date): Date {
  if (input instanceof Date) return startOfUtcDay(input);
  const datePart = input.slice(0, 10);
  if (!DATE_RE.test(datePart)) throw new ValidationError(`Invalid date "${input}", expected YYYY-MM-DD`);
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== datePart) {
    throw new ValidationError(`Invalid date "${input}"`);
  }
  return parsed;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** "HH:mm" -> minutes since midnight. */
export function timeToMinutes(time: string): number {
  const match = TIME_RE.exec(time);
  if (!match) throw new ValidationError(`Invalid time "${time}", expected HH:mm (24h)`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd). */
export function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

/** Inclusive calendar-day window for the public date filter. */
export function dateWindow(range: DateRangeFilter, now: Date): { from: Date; to: Date } {
  const today = startOfUtcDay(now);
  switch (range) {
    case 'today':
      return { from: today, to: today };
    case 'week':
      return { from: today, to: addDays(today, 6) };
    case 'month':
      return { from: today, to: addDays(today, 29) };
    default:
      throw new ValidationError(`Unsupported date range "${String(range)}"`);
  }
}
