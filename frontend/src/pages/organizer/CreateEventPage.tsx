import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, errorMessage } from '../../api/client';
import { eventsApi } from '../../api/endpoints';
import type { CampusEvent, TierInput, Venue } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { EventCard } from '../../components/events/EventCard';
import { Alert, Button, Card, EmptyState, SelectField, Spinner, TextArea, TextField, WizardSteps } from '../../components/ui';
import { useAsync } from '../../hooks/useAsync';
import { EVENT_CATEGORIES } from '../../lib/events';
import { formatEventDate, formatKes, formatTime, todayUtcIso } from '../../lib/format';

export const WIZARD_STEPS = ['Basics', 'Date & venue', 'Tickets', 'Review'];

export interface EventDraft {
  title: string;
  category: string;
  audience: string;
  description: string;
  coverImageUrl: string;
  date: string;
  startTime: string;
  endTime: string;
  venueId: string;
  maxCapacity: number;
  tiers: TierInput[];
}

export const EMPTY_DRAFT: EventDraft = {
  title: '',
  category: EVENT_CATEGORIES[0],
  audience: 'All students',
  description: '',
  coverImageUrl: '',
  date: '',
  startTime: '09:00',
  endTime: '12:00',
  venueId: '',
  maxCapacity: 100,
  tiers: [{ name: 'Regular', priceKes: 0, totalQuantity: 100 }],
};

type Errors = Partial<Record<string, string>>;

/** Pure validation shared by the stepper, checklist and tests. */
export function validateDraft(draft: EventDraft, venues: Venue[], today = todayUtcIso()) {
  const venue = venues.find((v) => v.id === draft.venueId);
  const basics: Errors = {};
  if (draft.title.trim().length < 3) basics.title = 'Give your event a title (3+ characters)';
  if (draft.description.trim().length < 10) basics.description = 'Describe the event in at least 10 characters';
  if (draft.audience.trim().length < 2) basics.audience = 'Who is this for?';
  if (draft.coverImageUrl && !/^https?:\/\/\S+$/i.test(draft.coverImageUrl)) basics.coverImageUrl = 'Use a full image URL (https://…)';

  const schedule: Errors = {};
  if (!draft.date) schedule.date = 'Pick a date';
  else if (draft.date < today) schedule.date = 'The date cannot be in the past';
  if (!draft.startTime || !draft.endTime) schedule.time = 'Set start and end times';
  else if (draft.startTime >= draft.endTime) schedule.time = 'End time must be after the start time';
  if (!venue) schedule.venueId = 'Select a venue';
  if (!Number.isInteger(draft.maxCapacity) || draft.maxCapacity < 1) schedule.maxCapacity = 'Capacity must be at least 1';
  else if (venue && draft.maxCapacity > venue.maxCapacity) {
    schedule.maxCapacity = `${venue.name} holds ${venue.maxCapacity} people. Lower the capacity or choose a bigger venue.`;
  }

  const tickets: Errors = {};
  const allocated = draft.tiers.reduce((sum, t) => sum + (Number.isFinite(t.totalQuantity) ? t.totalQuantity : 0), 0);
  if (draft.tiers.length === 0) tickets.tiers = 'Add at least one ticket tier';
  draft.tiers.forEach((t, i) => {
    if (!t.name.trim()) tickets[`tier-${i}-name`] = 'Name required';
    if (!Number.isInteger(t.priceKes) || t.priceKes < 0) tickets[`tier-${i}-price`] = 'Whole KES, 0 for free';
    if (!Number.isInteger(t.totalQuantity) || t.totalQuantity < 1) tickets[`tier-${i}-qty`] = 'At least 1';
  });
  const names = draft.tiers.map((t) => t.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) tickets.tiers = 'Tier names must be unique';
  else if (allocated > draft.maxCapacity) tickets.tiers = `Tiers allocate ${allocated} tickets but capacity is ${draft.maxCapacity}`;

  const checklist = [
    { label: 'Title and description', done: !basics.title && !basics.description },
    { label: 'Date and time', done: !schedule.date && !schedule.time },
    { label: 'Venue selected', done: Boolean(venue) && !schedule.maxCapacity },
    { label: 'Cover image added', done: Boolean(draft.coverImageUrl) && !basics.coverImageUrl },
  ];
  const stepErrors = [basics, schedule, tickets, {}];
  const complete = stepErrors.every((e) => Object.keys(e).length === 0);
  return { venue, allocated, stepErrors, checklist, complete };
}

export function CreateEventPage() {
  const venuesState = useAsync(() => eventsApi.venues(), []);
  if (venuesState.loading) return <Spinner label="Loading venues" fullPage />;
  if (venuesState.error || !venuesState.data) {
    return <Alert tone="danger" title="Couldn't load venues">{errorMessage(venuesState.error)}</Alert>;
  }
  return <CreateEventWizard venues={venuesState.data.venues} />;
}

export function CreateEventWizard({ venues }: { venues: Venue[] }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState<null | 'draft' | 'submit'>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [created, setCreated] = useState<CampusEvent | null>(null);

  const v = validateDraft(draft, venues);
  const errors = showErrors ? v.stepErrors[step] : {};
  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setTier = (index: number, patch: Partial<TierInput>) =>
    setDraft((d) => ({ ...d, tiers: d.tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)) }));

  const previewEvent: CampusEvent = useMemo(
    () => ({
      id: 'preview',
      organizerId: user?.id ?? '',
      venueId: draft.venueId,
      title: draft.title,
      category: draft.category,
      audience: draft.audience,
      description: draft.description,
      date: draft.date ? `${draft.date}T00:00:00.000Z` : `${todayUtcIso()}T00:00:00.000Z`,
      startTime: draft.startTime || '09:00',
      endTime: draft.endTime || '10:00',
      maxCapacity: Math.max(draft.maxCapacity || 0, 1),
      status: 'DRAFT',
      coverImageUrl: draft.coverImageUrl && !v.stepErrors[0].coverImageUrl ? draft.coverImageUrl : null,
      createdAt: '',
      updatedAt: '',
      venue: v.venue ?? { id: '', name: '', maxCapacity: 0, isAccessible: false },
      tiers: draft.tiers.map((t, i) => ({ id: `t${i}`, eventId: 'preview', description: t.description ?? null, soldQuantity: 0, ...t })),
      organizer: { id: user?.id ?? '', fullName: user?.fullName ?? 'Your club', email: user?.email ?? '' },
    }),
    [draft, user, v.venue, v.stepErrors],
  );

  const next = () => {
    if (Object.keys(v.stepErrors[step]).length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  };

  const save = async (submitForApproval: boolean) => {
    if (!v.complete) {
      setShowErrors(true);
      setStep(v.stepErrors.findIndex((e) => Object.keys(e).length > 0));
      return;
    }
    setSaving(submitForApproval ? 'submit' : 'draft');
    setApiError(null);
    try {
      const { event } = await eventsApi.create({
        venueId: draft.venueId,
        title: draft.title.trim(),
        category: draft.category,
        audience: draft.audience.trim(),
        description: draft.description.trim(),
        date: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
        maxCapacity: draft.maxCapacity,
        coverImageUrl: draft.coverImageUrl || null,
        submitForApproval,
        tiers: draft.tiers.map((t) => ({ name: t.name.trim(), description: t.description?.trim() || null, priceKes: t.priceKes, totalQuantity: t.totalQuantity })),
      });
      setCreated(event);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VENUE_CLASH') {
        setApiError('That venue is already booked at an overlapping time on this date. Pick another time or venue.');
        setStep(1);
      } else if (err instanceof ApiError && err.code === 'VENUE_CAPACITY_EXCEEDED') {
        setApiError(err.message);
        setStep(1);
      } else {
        setApiError(errorMessage(err));
      }
    } finally {
      setSaving(null);
    }
  };

  if (created) {
    const pending = created.status === 'PENDING_APPROVAL';
    return (
      <EmptyState
        icon={pending ? '📨' : '💾'}
        title={pending ? 'Submitted for approval' : 'Draft saved'}
        description={
          pending
            ? `"${created.title}" is with the campus events office. Students can book as soon as it's approved.`
            : `"${created.title}" is saved as a draft. Only you can see it.`
        }
        action={
          <div className="row">
            <Link className="btn btn--primary" to="/organizer/dashboard">Back to dashboard</Link>
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setDraft(EMPTY_DRAFT);
                setStep(0);
              }}
            >
              Create another
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Create an event</h1>
          <p className="text-muted">Events are reviewed by the campus events office before students can book.</p>
        </div>
        <Button variant="secondary" onClick={() => save(false)} loading={saving === 'draft'} disabled={saving !== null}>
          Save draft
        </Button>
      </header>

      <WizardSteps steps={WIZARD_STEPS} current={step} onSelect={(i) => i <= step && setStep(i)} />
      {apiError && <Alert tone="danger" title="Couldn't save the event">{apiError}</Alert>}

      <div className="two-col two-col--wide-left">
        <Card>
          <form
            className="stack"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step < WIZARD_STEPS.length - 1) next();
              else void save(true);
            }}
          >
            {step === 0 && (
              <>
                <TextField label="Event title" value={draft.title} onChange={(e) => set('title', e.target.value)} error={errors.title} placeholder="e.g. Intro to Flutter Bootcamp" />
                <div className="grid-2">
                  <SelectField label="Category" value={draft.category} onChange={(e) => set('category', e.target.value)}>
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </SelectField>
                  <TextField label="Audience" value={draft.audience} onChange={(e) => set('audience', e.target.value)} error={errors.audience} />
                </div>
                <TextArea label="Description" rows={5} value={draft.description} onChange={(e) => set('description', e.target.value)} error={errors.description} hint="What will students do, learn or win?" />
                <TextField label="Cover image URL" type="url" value={draft.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)} error={errors.coverImageUrl} hint="Optional, but events with a cover get more bookings" placeholder="https://…" />
              </>
            )}

            {step === 1 && (
              <>
                <div className="grid-3">
                  <TextField label="Date" type="date" min={todayUtcIso()} value={draft.date} onChange={(e) => set('date', e.target.value)} error={errors.date} />
                  <TextField label="Start time" type="time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} error={errors.time} />
                  <TextField label="End time" type="time" value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} />
                </div>
                <SelectField label="Venue" value={draft.venueId} onChange={(e) => set('venueId', e.target.value)} error={errors.venueId}>
                  <option value="">Select a venue…</option>
                  {venues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} · {venue.maxCapacity} seats{venue.isAccessible ? ' · ♿' : ''}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Event capacity"
                  type="number"
                  min={1}
                  value={Number.isNaN(draft.maxCapacity) ? '' : draft.maxCapacity}
                  onChange={(e) => set('maxCapacity', e.target.valueAsNumber)}
                  error={v.stepErrors[1].maxCapacity}
                  hint={v.venue ? `Venue limit: ${v.venue.maxCapacity} seats` : 'Must not exceed the venue capacity'}
                />
              </>
            )}

            {step === 2 && (
              <>
                <div className="tier-editor">
                  {draft.tiers.map((tier, index) => (
                    <div className="tier-editor__row" key={index}>
                      <TextField label="Tier name" value={tier.name} onChange={(e) => setTier(index, { name: e.target.value })} error={errors[`tier-${index}-name`]} />
                      <TextField label="Price (KES)" type="number" min={0} value={Number.isNaN(tier.priceKes) ? '' : tier.priceKes} onChange={(e) => setTier(index, { priceKes: e.target.valueAsNumber })} error={errors[`tier-${index}-price`]} hint={tier.priceKes === 0 ? 'Free' : undefined} />
                      <TextField label="Quantity" type="number" min={1} value={Number.isNaN(tier.totalQuantity) ? '' : tier.totalQuantity} onChange={(e) => setTier(index, { totalQuantity: e.target.valueAsNumber })} error={errors[`tier-${index}-qty`]} />
                      <button
                        type="button"
                        className="icon-btn tier-editor__remove"
                        aria-label={`Remove ${tier.name || 'tier'}`}
                        disabled={draft.tiers.length === 1}
                        onClick={() => setDraft((d) => ({ ...d, tiers: d.tiers.filter((_, i) => i !== index) }))}
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
                <div className="row row--between">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={draft.tiers.length >= 10}
                    onClick={() => setDraft((d) => ({ ...d, tiers: [...d.tiers, { name: d.tiers.some((t) => t.name === 'VIP') ? '' : 'VIP', priceKes: 0, totalQuantity: 10 }] }))}
                  >
                    + Add tier
                  </Button>
                  <span className={v.allocated > draft.maxCapacity ? 'text-danger' : 'text-muted'}>
                    {v.allocated} / {draft.maxCapacity} tickets allocated
                  </span>
                </div>
                {(showErrors || v.allocated > draft.maxCapacity) && v.stepErrors[2].tiers && <Alert tone="danger">{v.stepErrors[2].tiers}</Alert>}
              </>
            )}

            {step === 3 && (
              <dl className="review">
                <div><dt>Title</dt><dd>{draft.title}</dd></div>
                <div><dt>Category</dt><dd>{draft.category} · {draft.audience}</dd></div>
                <div><dt>When</dt><dd>{draft.date ? formatEventDate(`${draft.date}T00:00:00Z`) : '—'} · {formatTime(draft.startTime)} – {formatTime(draft.endTime)}</dd></div>
                <div><dt>Venue</dt><dd>{v.venue?.name ?? '—'} · capacity {draft.maxCapacity}</dd></div>
                <div>
                  <dt>Tickets</dt>
                  <dd>
                    {draft.tiers.map((t) => (
                      <span key={t.name} className="review__tier">
                        {t.name}: {formatKes(t.priceKes)} × {t.totalQuantity}
                      </span>
                    ))}
                  </dd>
                </div>
                <div><dt>Description</dt><dd className="prose">{draft.description}</dd></div>
              </dl>
            )}

            <div className="wizard-nav">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                ← Back
              </Button>
              {step < WIZARD_STEPS.length - 1 ? (
                <Button type="submit">Continue →</Button>
              ) : (
                <Button type="submit" variant="success" loading={saving === 'submit'} disabled={saving !== null || !v.complete}>
                  Submit for approval
                </Button>
              )}
            </div>
          </form>
        </Card>

        <aside className="sticky-col stack">
          <p className="eyebrow">Student view preview</p>
          <EventCard event={previewEvent} preview />
          <Card title="Readiness checklist">
            <ul className="checklist">
              {v.checklist.map((item) => (
                <li key={item.label} className={item.done ? 'checklist__item checklist__item--done' : 'checklist__item'}>
                  <span aria-hidden="true">{item.done ? '✅' : '⬜'}</span> {item.label}
                  <span className="sr-only">{item.done ? '(done)' : '(to do)'}</span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
