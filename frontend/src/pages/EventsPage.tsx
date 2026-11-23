import { useMemo, useState } from 'react';
import { eventsApi } from '../api/endpoints';
import type { EventFilters } from '../api/types';
import { errorMessage } from '../api/client';
import { EventCard } from '../components/events/EventCard';
import { Alert, Button, EmptyState, Spinner, Tabs, Toggle } from '../components/ui';
import { useAsync, useDebounced } from '../hooks/useAsync';
import { EVENT_CATEGORIES } from '../lib/events';

type DateKey = 'any' | 'today' | 'week' | 'month';
type PriceKey = 'any' | 'free' | 'paid';

export function EventsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<DateKey>('any');
  const [priceType, setPriceType] = useState<PriceKey>('any');
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const debouncedSearch = useDebounced(search.trim(), 300);

  const filters: EventFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category,
      dateRange: dateRange === 'any' ? undefined : dateRange,
      priceType: priceType === 'any' ? undefined : priceType,
      accessibleOnly: accessibleOnly || undefined,
    }),
    [debouncedSearch, category, dateRange, priceType, accessibleOnly],
  );

  const { data, loading, error, reload } = useAsync(() => eventsApi.list(filters), [filters]);
  const hasFilters = Boolean(filters.search || filters.category || filters.dateRange || filters.priceType || filters.accessibleOnly);

  const clear = () => {
    setSearch('');
    setCategory(undefined);
    setDateRange('any');
    setPriceType('any');
    setAccessibleOnly(false);
  };

  return (
    <div className="page">
      <section className="discover-hero">
        <h1>What's happening on campus</h1>
        <p>Discover hackathons, workshops, concerts and club events, then book in a tap.</p>
        <div className="search">
          <span aria-hidden="true">🔍</span>
          <input
            type="search"
            aria-label="Search events"
            placeholder="Search events, e.g. hackathon"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </section>

      <section className="filters" aria-label="Filters">
        <div className="chip-row" role="group" aria-label="Category">
          <button type="button" className={['chip', !category && 'chip--active'].filter(Boolean).join(' ')} onClick={() => setCategory(undefined)}>
            All
          </button>
          {EVENT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              className={['chip', category === c && 'chip--active'].filter(Boolean).join(' ')}
              onClick={() => setCategory(category === c ? undefined : c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="filters__row">
          <Tabs<DateKey>
            label="Date"
            variant="pill"
            active={dateRange}
            onChange={setDateRange}
            items={[
              { key: 'any', label: 'Any date' },
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This week' },
              { key: 'month', label: 'This month' },
            ]}
          />
          <Tabs<PriceKey>
            label="Price"
            variant="pill"
            active={priceType}
            onChange={setPriceType}
            items={[
              { key: 'any', label: 'Any price' },
              { key: 'free', label: 'Free' },
              { key: 'paid', label: 'Paid' },
            ]}
          />
          <label className="inline-toggle">
            <Toggle checked={accessibleOnly} onChange={setAccessibleOnly} label="Accessible venues only" />
            <span>♿ Accessible only</span>
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}
        </div>
      </section>

      {error ? (
        <Alert tone="danger" title="Couldn't load events" action={<Button variant="secondary" size="sm" onClick={reload}>Retry</Button>}>
          {errorMessage(error)}
        </Alert>
      ) : loading && !data ? (
        <Spinner label="Loading events" />
      ) : data && data.events.length === 0 ? (
        <EmptyState
          icon="🗓"
          title="No events match your filters"
          description="Try a different date range or category."
          action={hasFilters ? <Button onClick={clear}>Clear filters</Button> : undefined}
        />
      ) : (
        <>
          <p className="text-muted" aria-live="polite">
            {data?.count ?? 0} {data?.count === 1 ? 'event' : 'events'}
          </p>
          <div className="event-grid">{data?.events.map((event) => <EventCard key={event.id} event={event} />)}</div>
        </>
      )}
    </div>
  );
}
