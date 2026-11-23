const kes = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

export function formatKes(amount: number): string {
  return amount === 0 ? 'Free' : `KES ${kes.format(amount)}`;
}

export function formatKesAlways(amount: number): string {
  return `KES ${kes.format(amount)}`;
}

/** Event dates are calendar days stored at 00:00 UTC; always render them in UTC. */
export function formatEventDate(iso: string, style: 'long' | 'short' = 'long'): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    year: style === 'long' ? 'numeric' : undefined,
  });
}

export function formatDateParts(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: '2-digit' }),
    month: d.toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short' }).toUpperCase(),
  };
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatMonthLabel(yyyyMm: string): string {
  return new Date(`${yyyyMm}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
}

export function todayUtcIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Whole days from today (UTC) until the event day; negative when past. */
export function daysUntil(eventIso: string, now: Date = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const event = new Date(eventIso);
  const eventDay = Date.UTC(event.getUTCFullYear(), event.getUTCMonth(), event.getUTCDate());
  return Math.round((eventDay - today) / 86_400_000);
}

export function startsInLabel(eventIso: string, now: Date = new Date()): string {
  const days = daysUntil(eventIso, now);
  if (days < 0) return 'Already happened';
  if (days === 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  return `Starts in ${days} days`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
