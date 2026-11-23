# CampusPass Frontend

Web client for **CampusPass**, the student event ticketing system. Students discover and book events and carry
QR passes. Organizers run their events and scan tickets at the door. Admins approve events and manage accounts.

**Stack:** React 18 · TypeScript · Vite 5 · React Router 6 · `qrcode.react` (QR rendering) · `jsqr` (camera scanning) ·
Vitest + React Testing Library. Styling is a hand-built design system (CSS tokens + UI components), with no CSS framework.

## Setup

You need Node.js 18.18+ and the backend running from `../backend` (see its README). By default the backend listens on
**http://localhost:5000**, and this app calls **http://localhost:5000/api**.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest + React Testing Library smoke suite
npm run build      # type-check + production build into dist/
```

To point the app at a different API, copy `.env.example` to `.env` and change `VITE_API_URL`:

```bash
VITE_API_URL=http://localhost:5000/api
```

### Demo accounts

After seeding the backend (`npm run db:seed` in `/backend`), sign in with password `CampusPass@2026`. The login
page has one-click buttons that fill these in.

| Role | Email | Lands on |
|---|---|---|
| Student | `amani.w@students.ac.ke` | `/events` |
| Organizer | `cs.club@campus.ac.ke` | `/organizer/dashboard` |
| Admin | `n.otieno@campus.ac.ke` | `/admin/overview` |

## Screens

| Route | Who | What |
|---|---|---|
| `/login`, `/register` | everyone | University-email sign-in and sign-up with client-side domain validation |
| `/events` | everyone | Discovery: search, category chips, date range (today / week / month), free / paid, accessible-only |
| `/events/:id` | everyone | Hero, host club badge + Follow, seat progress with urgency pill, schedule timeline, accessibility box, report event |
| `/events/:id/book` | student | Tier selector (sold-out tiers join the waitlist), quantity stepper (max 2 per student), accessibility checkbox, live KES total |
| `/bookings/:id/confirmation` | student | "You're in!" celebration, perforated ticket with rendered QR and booking code, Add to calendar (.ics), My tickets |
| `/my-tickets` | student | Upcoming / Past / Waitlist tabs, "Starts in X days" banner, status chips, QR pass modal, Cancel booking |
| `/organizer/dashboard` | organizer | 4 KPI cards, monthly bookings chart, Next up, filterable My events table |
| `/organizer/events/new` | organizer | 4-step wizard with live student-view preview, readiness checklist, venue capacity validation, Save draft / Submit for approval |
| `/organizer/check-in` | organizer, admin | Camera QR scanner + manual `CP-XXXX-XXXX` entry. Full-card green **Valid entry** or red **Already scanned** (with the original check-in time) |
| `/admin/overview` | admin | KPIs, approval queue with venue-clash badges and Approve / Reject, audit activity feed, user table with search and Active / Suspended toggle |

## Notes

- **Camera scanning** needs a secure context: `localhost` or HTTPS. On a phone, open the app over HTTPS (for example
  through a tunnel) or use manual code entry.
- **Following a club** is saved in this browser's local storage, since the API has no follow endpoint.
- **Event dates** are calendar days and are shown in UTC so they never shift by timezone. Calendar files use
  Africa/Nairobi (EAT) times.
- The auth token is kept in `localStorage` (`campuspass.token`) and checked against `/api/auth/me` on load. Suspended
  or expired sessions are signed out automatically.

## Project structure

```
src/
  api/           typed fetch client, endpoint functions, wire types
  auth/          AuthContext (session) and RequireRole (route guard)
  components/
    ui/          design system: Button, Card, Badge/StatusChip, fields, Toggle, Tabs, Modal,
                 ProgressBar, QuantityStepper, WizardSteps, KpiCard, BarChart, Alert, Spinner, EmptyState
    layout/      AppShell (role-aware navigation)
    events/      EventCard, EventCover
    tickets/     TicketCard (perforated QR pass), QrScanner (getUserMedia + jsQR)
  hooks/         useAsync, useDebounced
  lib/           formatting (KES, dates), seat maths, schedule, .ics builder, club follow
  pages/         one file per screen (organizer/ and admin/ subfolders)
  styles/        tokens.css (design tokens) and global.css
  __tests__/     App.test.tsx smoke suite
```
