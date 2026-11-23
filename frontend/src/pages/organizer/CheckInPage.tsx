import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, errorMessage } from '../../api/client';
import { organizerApi, ticketsApi } from '../../api/endpoints';
import type { CampusEvent, TicketValidationResult } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { QrScanner } from '../../components/tickets/QrScanner';
import { Alert, Button, Card, EmptyState, SelectField, Spinner, TextField } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { isPastEvent } from '../../lib/events';
import { formatEventDate, formatTimestamp } from '../../lib/format';

export const MANUAL_CODE_PATTERN = /^CP-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Normalise free typing into CP-XXXX-XXXX as the organizer types. */
export function formatBookingCodeInput(raw: string): string {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Let the prefix be typed (or deleted) one character at a time.
  if (chars === '' || chars === 'C' || chars === 'CP') return chars;
  const body = (chars.startsWith('CP') ? chars.slice(2) : chars).slice(0, 8);
  const a = body.slice(0, 4);
  const b = body.slice(4);
  return b ? `CP-${a}-${b}` : `CP-${a}`;
}

export type CheckInOutcome =
  | { kind: 'success'; ticket: TicketValidationResult; via: 'qr' | 'code' }
  | { kind: 'duplicate'; checkedInAt: string | null; reference: string }
  | { kind: 'invalid'; message: string; reference: string };

export function CheckInResultCard({ outcome, onNext }: { outcome: CheckInOutcome; onNext(): void }) {
  if (outcome.kind === 'success') {
    return (
      <div className="checkin-result checkin-result--success" role="alert" aria-live="assertive">
        <span className="checkin-result__icon" aria-hidden="true">✓</span>
        <h2 className="checkin-result__title">Valid entry — Checked in</h2>
        <p className="checkin-result__code mono">{outcome.ticket.bookingCode}</p>
        <p>
          Admit <strong>{outcome.ticket.quantity}</strong> {outcome.ticket.quantity === 1 ? 'person' : 'people'} · {formatTimestamp(outcome.ticket.checkedInAt)}
        </p>
        <Button variant="secondary" onClick={onNext}>Scan next ticket</Button>
      </div>
    );
  }
  if (outcome.kind === 'duplicate') {
    return (
      <div className="checkin-result checkin-result--danger" role="alert" aria-live="assertive">
        <span className="checkin-result__icon" aria-hidden="true">✕</span>
        <h2 className="checkin-result__title">Already scanned — Do not admit</h2>
        <p className="checkin-result__badge">409 Duplicate</p>
        <p className="checkin-result__code mono">{outcome.reference}</p>
        <p>
          Originally checked in at <strong>{outcome.checkedInAt ? formatTimestamp(outcome.checkedInAt) : 'an earlier scan'}</strong>
        </p>
        <Button variant="secondary" onClick={onNext}>Scan next ticket</Button>
      </div>
    );
  }
  return (
    <div className="checkin-result checkin-result--danger" role="alert" aria-live="assertive">
      <span className="checkin-result__icon" aria-hidden="true">!</span>
      <h2 className="checkin-result__title">Invalid ticket — Do not admit</h2>
      <p>{outcome.message}</p>
      {outcome.reference && <p className="checkin-result__code mono">{outcome.reference}</p>}
      <Button variant="secondary" onClick={onNext}>Try again</Button>
    </div>
  );
}

export function CheckInPage() {
  const { user } = useAuth();
  const { data, loading, error } = useAsync(() => organizerApi.events(), []);
  if (loading) return <Spinner label="Loading your events" fullPage />;
  if (error || !data) return <Alert tone="danger" title="Couldn't load events">{errorMessage(error)}</Alert>;
  const scannable = data.events.filter((e) => e.status === 'PUBLISHED' && (user?.role === 'ADMIN' || e.organizerId === user?.id));
  return <CheckInConsole events={scannable} />;
}

export function CheckInConsole({ events }: { events: CampusEvent[] }) {
  const sorted = [...events].sort((a, b) => Number(isPastEvent(a)) - Number(isPastEvent(b)) || a.date.localeCompare(b.date));
  const [eventId, setEventId] = useState(sorted[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CheckInOutcome | null>(null);
  const [log, setLog] = useState<Array<{ id: number; outcome: CheckInOutcome }>>([]);

  useEffect(() => {
    setOutcome(null);
  }, [eventId]);

  const validate = useCallback(
    async (input: { qrPayload?: string; bookingCode?: string }) => {
      if (!eventId || busy) return;
      setBusy(true);
      const reference = input.bookingCode ?? 'Scanned QR';
      let result: CheckInOutcome;
      try {
        const { ticket } = await ticketsApi.validate({ eventId, ...input });
        result = { kind: 'success', ticket, via: input.qrPayload ? 'qr' : 'code' };
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const details = (err.details ?? {}) as { checkedInAt?: string | null };
          result = { kind: 'duplicate', checkedInAt: details.checkedInAt ?? null, reference };
        } else {
          result = { kind: 'invalid', message: errorMessage(err), reference: input.bookingCode ?? '' };
        }
      }
      setOutcome(result);
      setLog((l) => [{ id: Date.now() + Math.random(), outcome: result }, ...l].slice(0, 8));
      setBusy(false);
    },
    [eventId, busy],
  );

  const onManual = (e: FormEvent) => {
    e.preventDefault();
    if (!MANUAL_CODE_PATTERN.test(code)) {
      setCodeError('Booking codes look like CP-XXXX-XXXX');
      return;
    }
    setCodeError(null);
    void validate({ bookingCode: code }).then(() => setCode(''));
  };

  if (events.length === 0) {
    return (
      <EmptyState
        icon="📷"
        title="No published events to check in"
        description="Door check-in opens once one of your events is approved."
        action={<Link className="btn btn--primary" to="/organizer/dashboard">Back to dashboard</Link>}
      />
    );
  }

  const current = events.find((e) => e.id === eventId);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Door check-in</h1>
          <p className="text-muted">Scan QR passes or type booking codes. Every ticket can be used once.</p>
        </div>
      </header>

      <SelectField label="Event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
        {sorted.map((e) => (
          <option key={e.id} value={e.id}>
            {e.title} · {formatEventDate(e.date, 'short')}
          </option>
        ))}
      </SelectField>

      <div className="two-col">
        <div className="stack-lg">
          <Card title="Scan QR code">
            <QrScanner onScan={(value) => void validate({ qrPayload: value })} paused={busy || outcome !== null} />
          </Card>
          <Card title="Manual entry">
            <form className="manual-entry" onSubmit={onManual} noValidate>
              <TextField
                label="Booking code"
                placeholder="CP-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(formatBookingCodeInput(e.target.value))}
                error={codeError}
                autoComplete="off"
                spellCheck={false}
                className="mono"
                maxLength={12}
              />
              <Button type="submit" loading={busy} disabled={!code}>
                Check in
              </Button>
            </form>
          </Card>
        </div>

        <aside className="sticky-col stack">
          {outcome ? (
            <CheckInResultCard outcome={outcome} onNext={() => setOutcome(null)} />
          ) : (
            <div className="checkin-result checkin-result--idle">
              <span className="checkin-result__icon" aria-hidden="true">⌁</span>
              <h2 className="checkin-result__title">Ready to scan</h2>
              <p className="text-muted">{current?.title}</p>
            </div>
          )}
          {log.length > 0 && (
            <Card title="Recent scans">
              <ul className="scan-log">
                {log.map(({ id, outcome: o }) => (
                  <li key={id} className={`scan-log__item scan-log__item--${o.kind}`}>
                    <span className="mono">{o.kind === 'success' ? o.ticket.bookingCode : o.reference || 'QR'}</span>
                    <span>{o.kind === 'success' ? 'Checked in' : o.kind === 'duplicate' ? 'Duplicate' : 'Invalid'}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
