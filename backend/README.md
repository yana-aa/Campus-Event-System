# CampusPass Backend

REST API for **CampusPass**, the student event ticketing system: university-only sign-up, event discovery,
atomic ticket booking with waitlists, HMAC-signed QR tickets with anti-fraud door check-in, and admin
governance with an append-only audit log.

**Stack:** Node.js 18.18+ · Express 4 · TypeScript 5 · Prisma 6.19 (SQLite, native enums) · Zod · Jest · Supertest

---

## Local setup in 5 steps

1. **Install dependencies**
   ```bash
   cd backend
   npm install
   ```
2. **Create your environment file** (the defaults work locally; change the secrets for any shared deployment)
   ```bash
   cp .env.example .env
   ```
3. **Generate the Prisma client and create the SQLite database** (`prisma/dev.db`)
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. **Seed demo data** (all accounts use the password `CampusPass@2026`)
   ```bash
   npm run db:seed
   ```
   | Account | Email | Role |
   |---|---|---|
   | Amani Wanjiku | `amani.w@students.ac.ke` | STUDENT (holds booking `CP-8H2K-4471`) |
   | Computer Science Club | `cs.club@campus.ac.ke` | ORGANIZER |
   | N. Otieno | `n.otieno@campus.ac.ke` | ADMIN |

   Venues: *Innovation Lab, Block B* (200, accessible) and *Lab 4, Science Block* (120).
   Events: *Nairobi Tech Hackathon 2026* (published; Regular KES 500, VIP KES 1500) and
   *Intro to Flutter Bootcamp* (pending approval; Free).
5. **Run it**
   ```bash
   npm run dev          # ts-node, http://localhost:4000
   npm run build && npm start
   npm test             # unit + integration (uses an isolated prisma/test.db)
   ```

`npm test` never touches `dev.db`: Jest's global setup deletes `prisma/test.db` and pushes the schema to a
fresh file. `npm run db:reset` wipes and reseeds the **dev** database.

---

## Architecture

```
HTTP ─► routes ─► middlewares (authenticate, authorizeRoles) ─► controllers   (HTTP only: parse, respond)
                                                                     │
                                                                     ▼
                                                                 services      (business rules)
                                                                     │  depends on interfaces only
                                                                     ▼
                                                               repositories    (Prisma persistence)
                                                                     │
                                                                     ▼
                                                                  models       (Prisma-generated types)
```

```
src/
  app.ts            createApp(): Express app without listen() (used by Supertest)
  server.ts         binds the port, graceful shutdown
  container.ts      composition root: the only place concrete classes are created
  config/           typed env config (fails fast in production if secrets are missing)
  interfaces/       repository, service, strategy and infrastructure contracts
  models/           entity types, enums and domain constants
  repositories/     Prisma implementations + PrismaTransactionManager
  strategies/       FreeTicketStrategy, PaidTicketStrategy, PricingStrategyResolver
  services/         Auth, Event, Booking, QRCode, AdminAnalytics, AdminGovernance
  middlewares/      JWT auth, RBAC, centralized error handler
  controllers/      thin HTTP adapters
  routes/           Express routers
  validators/       Zod request schemas
  lib/              infrastructure adapters (bcrypt, JWT, HMAC QR, booking codes, Prisma client)
  errors/           AppError hierarchy (e.g. TicketAlreadyUsedError -> 409)
```

## SOLID mapping

| Principle | Where | How |
|---|---|---|
| **S**ingle Responsibility | `AuthService`, `EventService`, `BookingService`, `QRCodeService`, `AdminAnalyticsService`, `AdminGovernanceService` | Each service owns one concern: identity, event lifecycle and venue rules, booking/waitlist, ticket signing and check-in, read-only KPIs, admin state changes plus auditing. Controllers only translate HTTP and repositories only persist. |
| **O**pen/Closed | `ITicketPricingStrategy`, `FreeTicketStrategy`, `PaidTicketStrategy`, `PricingStrategyResolver` | `BookingService` asks the resolver for a strategy. A new tier such as early-bird or group pricing is a new class registered in `buildContainer()`, with no edits to `BookingService`. The unit test *"accepts a brand-new pricing tier…"* checks this. |
| **L**iskov Substitution | `interfaces/*` ↔ `repositories/*`, `lib/*` | Prisma repositories, the HMAC generator and the bcrypt/JWT adapters can be swapped for the jest mocks in `tests/helpers/fixtures.ts` without changing service behaviour. Services depend only on the interface contracts. |
| **I**nterface Segregation | `IBookingRepository` = `IBookingCommandRepository` + `IBookingQueryRepository` + `IBookingCheckInRepository` + `IBookingStatsRepository`; `IUserReader` ⊂ `IUserRepository`; `IEventReader` ⊂ `IEventRepository` | `QRCodeService` sees only `findByCode` and `markCheckedIn`. `AdminAnalyticsService` sees only the stats aggregations. The auth middleware sees only `IUserReader`. `IAuditLogRepository` has no update or delete, so the audit log stays append-only. |
| **D**ependency Inversion | Constructors of every service; `container.ts` | Services receive `IUserRepository`, `ITransactionManager`, `IPricingStrategyResolver`, `IQRCodeGenerator`, `IPasswordHasher`, `ITokenService` and so on through their constructors. Only the composition root knows about Prisma, bcrypt or jsonwebtoken, which lets the unit tests inject mocks. |

## Key business rules

- **Registration:** only `@students.ac.ke` and `@campus.ac.ke` emails are accepted. `ORGANIZER` sign-up requires `@campus.ac.ke`, and `ADMIN` accounts cannot be self-registered. Passwords are hashed with bcryptjs.
- **Suspension:** a `SUSPENDED` account cannot log in, and any JWT it already holds is rejected. The auth middleware re-loads the user on every request.
- **Events:** `maxCapacity` must not exceed the venue's capacity, and tier allocations must fit within `maxCapacity`. A non-cancelled event at the same venue on the same day with an overlapping `[start, end)` time is a clash (409 `VENUE_CLASH`). New events start as `PENDING_APPROVAL`, or `DRAFT` when `submitForApproval: false`.
- **Bookings:** all checks run inside one Prisma `$transaction`: event published, tier exists, at most 2 active tickets per student per event, event-wide seat count, and a compare-and-swap on `TicketTier.soldQuantity`. If any capacity check fails, the booking is saved as `WAITLISTED` with no QR code and the API returns 202. Cancelling a seated booking releases its stock and promotes waitlisted bookings strictly first-in-first-out.
- **QR tickets:** the payload is `CP1.<base64url claims>.<HMAC-SHA256>` and signs the booking code, event ID and user ID. Door validation checks the signature (constant-time compare), that the ticket is for this event, that it matches the stored booking, and that its status is `CONFIRMED`. It then flips the booking to `CHECKED_IN` with a conditional update. A second scan, including a lost race, gets 409 `TICKET_ALREADY_USED`.
- **Governance:** event status changes follow an allowed transition table. Cancelling an event cancels its bookings. Each admin change writes its `AuditLog` row in the same transaction.

## API reference

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | public | `{ fullName, email, password, role? }` |
| POST | `/api/auth/login` | public | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | any | Current profile |
| GET | `/api/events` | public | Published events. Query: `category`, `dateRange=today\|week\|month`, `priceType=free\|paid`, `accessibleOnly=true`, `search` |
| GET | `/api/events/:id` | public (owner/admin see unpublished) | Event with venue and tiers |
| POST | `/api/events` | ORGANIZER | Create event with `tiers[]` |
| PATCH | `/api/events/:id` | ORGANIZER (owner), ADMIN | Edit event; re-checks capacity and clashes |
| GET | `/api/venues` | public | Venue list |
| POST | `/api/bookings` | STUDENT | `{ eventId, tierId, quantity, needsAccessibility? }` → 201 confirmed / 202 waitlisted |
| GET | `/api/bookings/me` | any | My bookings, with QR payloads |
| DELETE | `/api/bookings/:id` | owner, ADMIN | Cancel and promote the waitlist |
| POST | `/api/tickets/validate` | ORGANIZER (owner), ADMIN | `{ eventId, qrPayload }` → check-in, or 409 on duplicate |
| GET | `/api/organizer/dashboard` | ORGANIZER | KPIs: bookings, tickets sold, check-in rate %, revenue in KES, per-event breakdown |
| GET | `/api/organizer/events` | ORGANIZER | My events, any status |
| GET | `/api/admin/overview` | ADMIN | Platform KPIs, users by role, events by status |
| PATCH | `/api/admin/events/:id/status` | ADMIN | `{ status, reason? }`: approve, reject (back to `DRAFT`), cancel, complete |
| PATCH | `/api/admin/users/:id/status` | ADMIN | `{ status: ACTIVE\|SUSPENDED, reason? }` |
| GET | `/api/admin/audit-logs` | ADMIN | Query: `page`, `pageSize`, `action`, `actorId`, `targetType` |
| GET | `/health` | public | Liveness probe |

Errors always use the shape `{ "error": { "code": "TICKET_ALREADY_USED", "message": "...", "details": { ... } } }`.

## Notes

- Amounts are whole Kenyan Shillings stored as integers, which avoids floating-point rounding.
- `PAYMENT_DUE` is in the schema and counts as a held seat, ready for a payment-gateway integration such as M-Pesa STK push. The current flow confirms paid bookings straight away.
- Prisma 6.19 prints a deprecation notice for the `package.json#prisma` seed key. It still works and only matters when upgrading to Prisma 7.
