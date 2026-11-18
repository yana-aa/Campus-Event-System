import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TOKEN_STORAGE_KEY } from '../api/client';
import type { BookingWithDetails, CampusEvent, User } from '../api/types';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthContext';
import { Button, ProgressBar, QuantityStepper, StatusChip } from '../components/ui';
import { buildIcs } from '../lib/ics';
import { seatInfo } from '../lib/events';
import { formatBookingCodeInput } from '../pages/organizer/CheckInPage';
import { validateDraft, EMPTY_DRAFT } from '../pages/organizer/CreateEventPage';
import { groupBookings } from '../pages/MyTicketsPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function isoDay(offset: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
}

const users: Record<string, User> = {
  student: { id: 'u-student', fullName: 'Amani Wanjiku', email: 'amani.w@students.ac.ke', role: 'STUDENT', status: 'ACTIVE', createdAt: isoDay(-30) },
  organizer: { id: 'u-org', fullName: 'Computer Science Club', email: 'cs.club@campus.ac.ke', role: 'ORGANIZER', status: 'ACTIVE', createdAt: isoDay(-60) },
  admin: { id: 'u-admin', fullName: 'N. Otieno', email: 'n.otieno@campus.ac.ke', role: 'ADMIN', status: 'ACTIVE', createdAt: isoDay(-90) },
};

const venue = { id: 'v-1', name: 'Innovation Lab, Block B', maxCapacity: 200, isAccessible: true };

const hackathon: CampusEvent = {
  id: 'e-hack',
  organizerId: 'u-org',
  venueId: venue.id,
  title: 'Nairobi Tech Hackathon 2026',
  category: 'Technology',
  audience: 'All students',
  description: 'A 9-hour build sprint.',
  date: isoDay(17),
  startTime: '09:00',
  endTime: '18:00',
  maxCapacity: 200,
  status: 'PUBLISHED',
  coverImageUrl: null,
  createdAt: isoDay(-10),
  updatedAt: isoDay(-10),
  venue,
  organizer: { id: 'u-org', fullName: 'Computer Science Club', email: 'cs.club@campus.ac.ke' },
  tiers: [
    { id: 't-vol', eventId: 'e-hack', name: 'Volunteer', description: null, priceKes: 0, totalQuantity: 10, soldQuantity: 10 },
    { id: 't-reg', eventId: 'e-hack', name: 'Regular', description: 'General admission', priceKes: 500, totalQuantity: 140, soldQuantity: 111 },
    { id: 't-vip', eventId: 'e-hack', name: 'VIP', description: 'Reserved seating', priceKes: 1500, totalQuantity: 50, soldQuantity: 21 },
  ],
};

const confirmedBooking: BookingWithDetails = {
  id: 'b-1',
  bookingCode: 'CP-8H2K-4471',
  userId: 'u-student',
  eventId: 'e-hack',
  tierId: 't-reg',
  quantity: 1,
  totalAmountKes: 500,
  qrPayload: 'CP1.eyJiIjoiQ1AtOEgySy00NDcxIn0.signature',
  status: 'CONFIRMED',
  needsAccessibility: false,
  checkedInAt: null,
  createdAt: isoDay(-1),
  event: {
    id: 'e-hack',
    title: hackathon.title,
    date: hackathon.date,
    startTime: '09:00',
    endTime: '18:00',
    status: 'PUBLISHED',
    venue: { id: venue.id, name: venue.name },
  },
  tier: { id: 't-reg', name: 'Regular', priceKes: 500 },
};

// ---------------------------------------------------------------------------
// Fetch mock + render helpers
// ---------------------------------------------------------------------------
type Handler = (body: unknown, url: URL) => { status?: number; body: unknown };
type Routes = Record<string, Handler>;

function mockApi(routes: Routes, me?: User) {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });

    let result: { status?: number; body: unknown } = { status: 404, body: { error: { code: 'NOT_MOCKED', message: `${method} ${path}` } } };
    if (method === 'GET' && path === '/auth/me' && me) result = { body: { user: me } };
    const handler = routes[`${method} ${path}`];
    if (handler) result = handler(body, url);

    const status = result.status ?? 200;
    return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(result.body) } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function renderApp(path: string, as?: keyof typeof users, routes: Routes = {}) {
  const me = as ? users[as] : undefined;
  if (me) window.localStorage.setItem(TOKEN_STORAGE_KEY, `token-${me.role}`);
  const calls = mockApi(routes, me);
  const utils = render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  return { ...utils, calls, user: userEvent.setup() };
}

// ---------------------------------------------------------------------------
// Design system
// ---------------------------------------------------------------------------
describe('Design system components', () => {
  it('Button applies variant classes and disables itself while loading', () => {
    render(
      <>
        <Button variant="danger">Delete</Button>
        <Button loading>Saving</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn', 'btn--danger');
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
  });

  it('StatusChip renders human labels for booking states', () => {
    render(
      <>
        <StatusChip status="CONFIRMED" />
        <StatusChip status="WAITLISTED" />
        <StatusChip status="PAYMENT_DUE" />
      </>,
    );
    expect(screen.getByText('Confirmed')).toHaveClass('badge--success');
    expect(screen.getByText('Waitlisted')).toHaveClass('badge--warning');
    expect(screen.getByText('Payment due')).toHaveClass('badge--danger');
  });

  it('QuantityStepper never goes past the max of 2', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState(1);
      return <QuantityStepper value={value} max={2} onChange={setValue} />;
    }
    render(<Harness />);
    const plus = screen.getByRole('button', { name: 'Increase quantity' });
    await user.click(plus);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(plus).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeEnabled();
  });

  it('ProgressBar exposes accessible values', () => {
    render(<ProgressBar value={142} max={200} label="Seats booked" />);
    const bar = screen.getByRole('progressbar', { name: 'Seats booked' });
    expect(bar).toHaveAttribute('aria-valuenow', '142');
    expect(bar).toHaveAttribute('aria-valuemax', '200');
  });
});

describe('Domain helpers', () => {
  it('computes seats and urgency (142 / 200 → 58 left, urgent)', () => {
    expect(seatInfo(hackathon)).toMatchObject({ booked: 142, capacity: 200, remaining: 58, urgent: true, soldOut: false });
  });

  it('formats manual booking codes as CP-XXXX-XXXX', () => {
    expect(formatBookingCodeInput('cp8h2k4471')).toBe('CP-8H2K-4471');
    expect(formatBookingCodeInput('8h2k')).toBe('CP-8H2K');
    // Typing and deleting the prefix one key at a time.
    expect(formatBookingCodeInput('c')).toBe('C');
    expect(formatBookingCodeInput('CP')).toBe('CP');
    expect(formatBookingCodeInput('CP-8H2K-')).toBe('CP-8H2K');
  });

  it('flags event capacity above venue capacity in the wizard', () => {
    const lab4 = { id: 'v-lab4', name: 'Lab 4, Science Block', maxCapacity: 120, isAccessible: false };
    const result = validateDraft({ ...EMPTY_DRAFT, venueId: 'v-lab4', maxCapacity: 150 }, [lab4]);
    expect(result.stepErrors[1].maxCapacity).toMatch(/holds 120 people/);
    expect(result.checklist.find((c) => c.label === 'Venue selected')?.done).toBe(false);
  });

  it('groups tickets into upcoming, past and waitlist', () => {
    const waitlisted = { ...confirmedBooking, id: 'b-2', status: 'WAITLISTED' as const, qrPayload: null };
    const past = { ...confirmedBooking, id: 'b-3', status: 'CHECKED_IN' as const, event: { ...confirmedBooking.event, date: isoDay(-5) } };
    const groups = groupBookings([confirmedBooking, waitlisted, past]);
    expect(groups.upcoming.map((b) => b.id)).toEqual(['b-1']);
    expect(groups.waitlist.map((b) => b.id)).toEqual(['b-2']);
    expect(groups.past.map((b) => b.id)).toEqual(['b-3']);
  });

  it('builds a valid .ics calendar entry in Nairobi time', () => {
    const ics = buildIcs({ uid: 'CP-8H2K-4471', title: 'Hackathon, 2026', description: 'Bring a laptop', location: 'Innovation Lab', date: '2026-12-05', startTime: '09:00', endTime: '18:00' });
    expect(ics).toContain('DTSTART;TZID=Africa/Nairobi:20261205T090000');
    expect(ics).toContain('SUMMARY:Hackathon\\, 2026');
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Role-based routing
// ---------------------------------------------------------------------------
describe('Role-based routing', () => {
  it('sends anonymous visitors of organizer pages to sign in', async () => {
    renderApp('/organizer/dashboard');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('shows a 403 screen when a student opens the admin console', async () => {
    renderApp('/admin/overview', 'student');
    expect(await screen.findByText("You don't have access to this page")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to my home' })).toHaveAttribute('href', '/events');
  });

  it('lands each role on its home page from /', async () => {
    renderApp('/', 'organizer', {
      'GET /organizer/dashboard': () => ({
        body: {
          summary: { totalBookings: 5, ticketsSold: 5, checkedInTickets: 1, checkInRatePercent: 20, revenueKes: 5000, waitlisted: 1, totalEvents: 1, upcomingEvents: 1 },
          events: [],
          monthlyBookings: [{ month: '2026-11', bookings: 3, tickets: 3 }],
        },
      }),
      'GET /organizer/events': () => ({ body: { count: 1, events: [hackathon] } }),
    });
    expect(await screen.findByRole('heading', { name: 'Organizer dashboard' })).toBeInTheDocument();
    expect(screen.getByLabelText('Check-in rate')).toHaveTextContent('20%');
    expect(screen.getByLabelText('Ticket revenue')).toHaveTextContent('KES 5,000');
  });

  it('renders the admin governance console with clash warnings', async () => {
    const clashing = { ...hackathon, id: 'e-flutter', title: 'Intro to Flutter Bootcamp', status: 'PENDING_APPROVAL' as const, clashes: [{ id: 'e-meetup', title: 'Mobile Dev Meetup', startTime: '16:00', endTime: '18:00' }] };
    renderApp('/admin/overview', 'admin', {
      'GET /admin/overview': () => ({
        body: {
          kpis: { totalBookings: 5, ticketsSold: 5, checkedInTickets: 1, checkInRatePercent: 20, revenueKes: 5000, waitlisted: 1 },
          usersByRole: { STUDENT: 3, ORGANIZER: 1, ADMIN: 1 },
          eventsByStatus: { DRAFT: 0, PENDING_APPROVAL: 2, PUBLISHED: 3, COMPLETED: 1, CANCELLED: 0 },
          openReports: 2,
        },
      }),
      'GET /admin/events': () => ({ body: { count: 1, events: [clashing] } }),
      'GET /admin/audit-logs': () => ({ body: { items: [], total: 0, page: 1, pageSize: 12 } }),
      'GET /admin/users': () => ({ body: { items: Object.values(users), total: 3, page: 1, pageSize: 50 } }),
    });
    expect(await screen.findByText('Intro to Flutter Bootcamp')).toBeInTheDocument();
    expect(screen.getByText('⚠ Venue clash')).toBeInTheDocument();
    expect(screen.getByLabelText('Registered students')).toHaveTextContent('3');
    expect(screen.getByLabelText('Open reports')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: 'Approve Intro to Flutter Bootcamp' })).toBeInTheDocument();
    // The admin cannot suspend themselves.
    expect(await screen.findByRole('switch', { name: 'Suspend N. Otieno' })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Booking UI states
// ---------------------------------------------------------------------------
describe('Event details & booking flow', () => {
  it('shows seat progress and the urgency pill', async () => {
    renderApp(`/events/${hackathon.id}`, undefined, { [`GET /events/${hackathon.id}`]: () => ({ body: { event: hackathon } }) });
    expect(await screen.findByRole('heading', { name: hackathon.title })).toBeInTheDocument();
    expect(screen.getByText('Only 58 spots left, book soon', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Seats booked' })).toHaveAttribute('aria-valuenow', '142');
    expect(screen.getByRole('button', { name: '+ Follow' })).toBeInTheDocument();
  });

  it('supports tier selection, the 2-ticket cap, live KES total and sold-out waitlist', async () => {
    const { user } = renderApp(`/events/${hackathon.id}/book`, 'student', {
      [`GET /events/${hackathon.id}`]: () => ({ body: { event: hackathon } }),
      'GET /bookings/me': () => ({ body: { count: 0, bookings: [] } }),
    });
    expect(await screen.findByRole('heading', { name: 'Choose your tickets' })).toBeInTheDocument();
    expect(screen.getByText('Sold out · join waitlist')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /VIP/ }));
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByTestId('booking-total')).toHaveTextContent('KES 3,000');
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /Volunteer/ }));
    expect(screen.getByRole('button', { name: 'Join waitlist' })).toBeInTheDocument();
  });

  it('submits the booking and shows the "You\'re in!" ticket with QR and booking code', async () => {
    const { user, calls } = renderApp(`/events/${hackathon.id}/book`, 'student', {
      [`GET /events/${hackathon.id}`]: () => ({ body: { event: hackathon } }),
      'GET /bookings/me': () => ({ body: { count: 1, bookings: calls.some((c) => c.method === 'POST') ? [confirmedBooking] : [] } }),
      'POST /bookings': () => ({ status: 201, body: { booking: confirmedBooking, message: 'Booking confirmed.' } }),
    });
    await screen.findByRole('heading', { name: 'Choose your tickets' });
    await user.click(screen.getByRole('checkbox', { name: /I need accessibility support/ }));
    await user.click(screen.getByRole('button', { name: 'Pay KES 500 & book' }));

    expect(await screen.findByRole('heading', { name: /You're in!/ })).toBeInTheDocument();
    expect(screen.getByText('CP-8H2K-4471')).toBeInTheDocument();
    expect(within(screen.getByTestId('ticket-qr')).getByTitle('QR code for CP-8H2K-4471')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add to calendar/ })).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.path === '/bookings')?.body).toEqual({
      eventId: 'e-hack',
      tierId: 't-reg',
      quantity: 1,
      needsAccessibility: true,
    });
  });

  it('shows the My tickets reminder banner and status tabs', async () => {
    renderApp('/my-tickets', 'student', {
      'GET /bookings/me': () => ({ body: { count: 2, bookings: [confirmedBooking, { ...confirmedBooking, id: 'b-w', bookingCode: 'CP-J4ZZ-2210', status: 'WAITLISTED', qrPayload: null }] } }),
    });
    expect(await screen.findByText(/Starts in 17 days: Nairobi Tech Hackathon 2026/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Waitlist/ })).toHaveTextContent('1');
  });
});

// ---------------------------------------------------------------------------
// Door check-in UI states
// ---------------------------------------------------------------------------
describe('Door check-in tool', () => {
  it('shows green "Valid entry" then red "Already scanned" with the original timestamp', async () => {
    let scans = 0;
    const firstScan = '2026-12-05T08:45:12.000Z';
    const { user, calls } = renderApp('/organizer/check-in', 'organizer', {
      'GET /organizer/events': () => ({ body: { count: 1, events: [hackathon] } }),
      'POST /tickets/validate': () => {
        scans += 1;
        return scans === 1
          ? { body: { valid: true, ticket: { bookingId: 'b-1', bookingCode: 'CP-8H2K-4471', eventId: 'e-hack', quantity: 1, status: 'CHECKED_IN', checkedInAt: firstScan } } }
          : { status: 409, body: { error: { code: 'TICKET_ALREADY_USED', message: 'Ticket has already been scanned', details: { checkedInAt: firstScan } } } };
      },
    });

    expect(await screen.findByRole('heading', { name: 'Door check-in' })).toBeInTheDocument();
    expect(screen.getByText('Camera not available')).toBeInTheDocument();

    const input = screen.getByLabelText('Booking code');
    await user.type(input, 'cp8h2k4471');
    expect(input).toHaveValue('CP-8H2K-4471');
    await user.click(screen.getByRole('button', { name: 'Check in' }));

    expect(await screen.findByRole('heading', { name: 'Valid entry — Checked in' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/tickets/validate')?.body).toEqual({ eventId: 'e-hack', bookingCode: 'CP-8H2K-4471' });

    await user.click(screen.getByRole('button', { name: 'Scan next ticket' }));
    await user.type(screen.getByLabelText('Booking code'), 'CP-8H2K-4471');
    await user.click(screen.getByRole('button', { name: 'Check in' }));

    expect(await screen.findByRole('heading', { name: 'Already scanned — Do not admit' })).toBeInTheDocument();
    expect(screen.getByText('409 Duplicate')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Originally checked in at/)).toHaveTextContent(/5 Dec/));
  });

  it('rejects malformed manual codes without calling the API', async () => {
    const { user, calls } = renderApp('/organizer/check-in', 'organizer', {
      'GET /organizer/events': () => ({ body: { count: 1, events: [hackathon] } }),
    });
    await user.type(await screen.findByLabelText('Booking code'), 'CP-12');
    await user.click(screen.getByRole('button', { name: 'Check in' }));
    expect(screen.getByText('Booking codes look like CP-XXXX-XXXX')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/tickets/validate')).toBe(false);
  });
});
