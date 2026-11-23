import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { BcryptPasswordHasher } from '../../src/lib/BcryptPasswordHasher';
import { disconnectPrisma, getPrismaClient } from '../../src/lib/prisma';
import { Role, UserStatus } from '../../src/models';

const prisma = getPrismaClient();
const PASSWORD = 'CampusPass@2026';

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe('CampusPass API workflow (Supertest, SQLite test DB)', () => {
  let app: Express;
  let adminToken: string;
  let organizerToken: string;
  let studentToken: string;
  let student2Token: string;
  let student2Id: string;
  let venueId: string;
  let smallVenueId: string;
  let eventId: string;
  let regularTierId: string;
  let vipTierId: string;
  let qrPayload: string;
  let bookingId: string;
  const eventDate = isoDay(3);

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.ticketTier.deleteMany();
    await prisma.event.deleteMany();
    await prisma.venue.deleteMany();
    await prisma.user.deleteMany();

    // Admins cannot self-register, so the admin and venues are provisioned directly.
    await prisma.user.create({
      data: {
        fullName: 'N. Otieno',
        email: 'n.otieno@campus.ac.ke',
        passwordHash: await new BcryptPasswordHasher(4).hash(PASSWORD),
        role: Role.ADMIN,
      },
    });
    venueId = (await prisma.venue.create({ data: { name: 'Innovation Lab, Block B', maxCapacity: 200, isAccessible: true } })).id;
    smallVenueId = (await prisma.venue.create({ data: { name: 'Lab 4, Science Block', maxCapacity: 120 } })).id;

    app = createApp();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  // ---------------------------------------------------------------- auth
  describe('auth', () => {
    it('rejects non-university emails', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ fullName: 'Outsider', email: 'someone@gmail.com', password: PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('registers an organizer (staff domain) and two students', async () => {
      const org = await request(app).post('/api/auth/register').send({
        fullName: 'Computer Science Club',
        email: 'cs.club@campus.ac.ke',
        password: PASSWORD,
        role: 'ORGANIZER',
      });
      expect(org.status).toBe(201);
      expect(org.body.user).not.toHaveProperty('passwordHash');
      expect(org.body.user.role).toBe('ORGANIZER');

      const s1 = await request(app)
        .post('/api/auth/register')
        .send({ fullName: 'Amani Wanjiku', email: 'amani.w@students.ac.ke', password: PASSWORD });
      expect(s1.status).toBe(201);
      expect(s1.body.user.role).toBe('STUDENT');

      const s2 = await request(app)
        .post('/api/auth/register')
        .send({ fullName: 'Brian Kiptoo', email: 'brian.k@students.ac.ke', password: PASSWORD });
      expect(s2.status).toBe(201);
      student2Token = s2.body.token;
      student2Id = s2.body.user.id;
    });

    it('blocks students from self-registering as organizers and rejects duplicate emails', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ fullName: 'Sneaky', email: 'sneaky@students.ac.ke', password: PASSWORD, role: 'ORGANIZER' });
      expect(res.status).toBe(403);

      const dup = await request(app)
        .post('/api/auth/register')
        .send({ fullName: 'Amani Again', email: 'amani.w@students.ac.ke', password: PASSWORD });
      expect(dup.status).toBe(409);
    });

    it('logs everyone in and returns the profile from /me', async () => {
      const login = async (email: string) => {
        const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
        expect(res.status).toBe(200);
        return res.body.token as string;
      };
      adminToken = await login('n.otieno@campus.ac.ke');
      organizerToken = await login('cs.club@campus.ac.ke');
      studentToken = await login('amani.w@students.ac.ke');

      const wrong = await request(app).post('/api/auth/login').send({ email: 'amani.w@students.ac.ke', password: 'nope' });
      expect(wrong.status).toBe(401);

      const me = await request(app).get('/api/auth/me').set(auth(studentToken));
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe('amani.w@students.ac.ke');

      expect((await request(app).get('/api/auth/me')).status).toBe(401);
    });
  });

  // ---------------------------------------------------------------- events
  describe('event creation and approval', () => {
    const baseEvent = () => ({
      venueId,
      title: 'Nairobi Tech Hackathon 2026',
      category: 'Technology',
      audience: 'All students',
      description: 'A 9-hour build sprint for student teams.',
      date: eventDate,
      startTime: '09:00',
      endTime: '18:00',
      maxCapacity: 200,
      tiers: [
        { name: 'Regular', priceKes: 500, totalQuantity: 150 },
        { name: 'VIP', priceKes: 1500, totalQuantity: 1 },
      ],
    });

    it('only organizers may create events', async () => {
      const res = await request(app).post('/api/events').set(auth(studentToken)).send(baseEvent());
      expect(res.status).toBe(403);
    });

    it('enforces event.maxCapacity <= venue.maxCapacity', async () => {
      const res = await request(app)
        .post('/api/events')
        .set(auth(organizerToken))
        .send({ ...baseEvent(), venueId: smallVenueId, maxCapacity: 150, tiers: [{ name: 'Free', priceKes: 0, totalQuantity: 100 }] });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VENUE_CAPACITY_EXCEEDED');
    });

    it('creates the event as PENDING_APPROVAL', async () => {
      const res = await request(app).post('/api/events').set(auth(organizerToken)).send(baseEvent());
      expect(res.status).toBe(201);
      expect(res.body.event.status).toBe('PENDING_APPROVAL');
      eventId = res.body.event.id;
      regularTierId = res.body.event.tiers.find((t: { name: string }) => t.name === 'Regular').id;
      vipTierId = res.body.event.tiers.find((t: { name: string }) => t.name === 'VIP').id;
    });

    it('detects venue/date clashes', async () => {
      const res = await request(app)
        .post('/api/events')
        .set(auth(organizerToken))
        .send({ ...baseEvent(), title: 'Overlapping Meetup', startTime: '17:00', endTime: '20:00', tiers: [{ name: 'Free', priceKes: 0, totalQuantity: 50 }] });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VENUE_CLASH');
      expect(res.body.error.details.clashingEventIds).toContain(eventId);
    });

    it('hides unapproved events from the public and refuses bookings', async () => {
      expect((await request(app).get(`/api/events/${eventId}`)).status).toBe(404);
      const booking = await request(app)
        .post('/api/bookings')
        .set(auth(studentToken))
        .send({ eventId, tierId: regularTierId, quantity: 1 });
      expect(booking.status).toBe(422);
      expect(booking.body.error.code).toBe('EVENT_NOT_BOOKABLE');
    });

    it('lets an admin approve the event', async () => {
      const forbidden = await request(app)
        .patch(`/api/admin/events/${eventId}/status`)
        .set(auth(organizerToken))
        .send({ status: 'PUBLISHED' });
      expect(forbidden.status).toBe(403);

      const res = await request(app)
        .patch(`/api/admin/events/${eventId}/status`)
        .set(auth(adminToken))
        .send({ status: 'PUBLISHED', reason: 'Meets campus guidelines' });
      expect(res.status).toBe(200);
      expect(res.body.event.status).toBe('PUBLISHED');
    });

    it('lists the published event with public filters', async () => {
      const paidWeek = await request(app).get('/api/events').query({ priceType: 'paid', dateRange: 'week', accessibleOnly: 'true' });
      expect(paidWeek.status).toBe(200);
      expect(paidWeek.body.events.map((e: { id: string }) => e.id)).toContain(eventId);

      const free = await request(app).get('/api/events').query({ priceType: 'free' });
      expect(free.body.events.map((e: { id: string }) => e.id)).not.toContain(eventId);

      const today = await request(app).get('/api/events').query({ dateRange: 'today' });
      expect(today.body.count).toBe(0);

      const other = await request(app).get('/api/events').query({ category: 'Sports' });
      expect(other.body.count).toBe(0);
    });
  });

  // ---------------------------------------------------------------- bookings
  describe('booking and door check-in', () => {
    it('books a Regular ticket atomically with a CP code and signed QR payload', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set(auth(studentToken))
        .send({ eventId, tierId: regularTierId, quantity: 1 });
      expect(res.status).toBe(201);
      expect(res.body.booking.status).toBe('CONFIRMED');
      expect(res.body.booking.totalAmountKes).toBe(500);
      expect(res.body.booking.bookingCode).toMatch(/^CP-[A-Z2-9]{4}-\d{4}$/);
      expect(res.body.booking.qrPayload).toMatch(/^CP1\./);
      qrPayload = res.body.booking.qrPayload;
      bookingId = res.body.booking.id;

      const tier = await prisma.ticketTier.findUniqueOrThrow({ where: { id: regularTierId } });
      expect(tier.soldQuantity).toBe(1);
    });

    it('only students can book', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set(auth(organizerToken))
        .send({ eventId, tierId: regularTierId, quantity: 1 });
      expect(res.status).toBe(403);
    });

    it('enforces the 2-ticket limit per student per event', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set(auth(studentToken))
        .send({ eventId, tierId: regularTierId, quantity: 2 });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('TICKET_LIMIT_EXCEEDED');
    });

    it('waitlists when a tier is full and promotes the waitlist on cancellation', async () => {
      const vip = await request(app).post('/api/bookings').set(auth(studentToken)).send({ eventId, tierId: vipTierId, quantity: 1 });
      expect(vip.status).toBe(201);
      expect(vip.body.booking.totalAmountKes).toBe(1500);

      const waitlisted = await request(app)
        .post('/api/bookings')
        .set(auth(student2Token))
        .send({ eventId, tierId: vipTierId, quantity: 1 });
      expect(waitlisted.status).toBe(202);
      expect(waitlisted.body.booking.status).toBe('WAITLISTED');
      expect(waitlisted.body.booking.qrPayload).toBeNull();

      const notMine = await request(app).delete(`/api/bookings/${vip.body.booking.id}`).set(auth(student2Token));
      expect(notMine.status).toBe(403);

      const cancel = await request(app).delete(`/api/bookings/${vip.body.booking.id}`).set(auth(studentToken));
      expect(cancel.status).toBe(200);
      expect(cancel.body.booking.status).toBe('CANCELLED');
      expect(cancel.body.promotedBookingIds).toEqual([waitlisted.body.booking.id]);

      const mine = await request(app).get('/api/bookings/me').set(auth(student2Token));
      expect(mine.status).toBe(200);
      expect(mine.body.bookings[0]).toMatchObject({ status: 'CONFIRMED', event: { id: eventId } });
      expect(mine.body.bookings[0].qrPayload).toMatch(/^CP1\./);

      const tier = await prisma.ticketTier.findUniqueOrThrow({ where: { id: vipTierId } });
      expect(tier.soldQuantity).toBe(1);
    });

    it('rejects a tampered QR payload', async () => {
      const [v, body, sig] = qrPayload.split('.');
      const forged = `${v}.${body}.${sig.slice(0, -2)}xx`;
      const res = await request(app).post('/api/tickets/validate').set(auth(organizerToken)).send({ eventId, qrPayload: forged });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TICKET');
    });

    it('validates the QR at the door and marks it CHECKED_IN', async () => {
      const studentAttempt = await request(app).post('/api/tickets/validate').set(auth(studentToken)).send({ eventId, qrPayload });
      expect(studentAttempt.status).toBe(403);

      const res = await request(app).post('/api/tickets/validate').set(auth(organizerToken)).send({ eventId, qrPayload });
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.ticket.status).toBe('CHECKED_IN');

      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe('CHECKED_IN');
      expect(booking.checkedInAt).toBeInstanceOf(Date);
    });

    it('rejects a duplicate scan with 409 TicketAlreadyUsedError', async () => {
      const res = await request(app).post('/api/tickets/validate').set(auth(organizerToken)).send({ eventId, qrPayload });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TICKET_ALREADY_USED');
      expect(res.body.error.details.checkedInAt).toEqual(expect.any(String));
    });

    it('checks in by manually typed booking code and rejects a repeat', async () => {
      const mine = await request(app).get('/api/bookings/me').set(auth(student2Token));
      const code = mine.body.bookings.find((b: { status: string }) => b.status === 'CONFIRMED').bookingCode as string;

      const bad = await request(app).post('/api/tickets/validate').set(auth(organizerToken)).send({ eventId, bookingCode: 'nope' });
      expect(bad.status).toBe(400);

      const ok = await request(app)
        .post('/api/tickets/validate')
        .set(auth(organizerToken))
        .send({ eventId, bookingCode: code.toLowerCase() });
      expect(ok.status).toBe(200);
      expect(ok.body.ticket.bookingCode).toBe(code);

      const again = await request(app).post('/api/tickets/validate').set(auth(organizerToken)).send({ eventId, bookingCode: code });
      expect(again.status).toBe(409);
    });
  });

  // ---------------------------------------------------------------- governance
  describe('dashboards and governance', () => {
    it('reports organizer KPIs (bookings, check-in rate, revenue)', async () => {
      const res = await request(app).get('/api/organizer/dashboard').set(auth(organizerToken));
      expect(res.status).toBe(200);
      // Confirmed: Amani Regular (checked in, 500) + Brian VIP (promoted, 1500)
      expect(res.body.summary).toMatchObject({
        totalEvents: 1,
        totalBookings: 2,
        ticketsSold: 2,
        checkedInTickets: 2,
        checkInRatePercent: 100,
        revenueKes: 2000,
        upcomingEvents: 1,
      });
      expect(res.body.events[0]).toMatchObject({ eventId, occupancyPercent: 1 });
      expect(res.body.monthlyBookings).toHaveLength(6);
      expect(res.body.monthlyBookings[5]).toMatchObject({ month: new Date().toISOString().slice(0, 7), bookings: 2 });
    });

    it('reports the admin overview', async () => {
      const res = await request(app).get('/api/admin/overview').set(auth(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.kpis.revenueKes).toBe(2000);
      expect(res.body.usersByRole).toEqual({ STUDENT: 2, ORGANIZER: 1, ADMIN: 1 });
      expect(res.body.eventsByStatus.PUBLISHED).toBe(1);
      expect(res.body.openReports).toBe(0);
    });

    it('accepts user reports and counts them as open in the overview', async () => {
      const res = await request(app)
        .post('/api/reports')
        .set(auth(studentToken))
        .send({ targetType: 'EVENT', targetId: eventId, reason: 'Tickets are being resold above face value.' });
      expect(res.status).toBe(201);
      expect(res.body.report.status).toBe('OPEN');

      const overview = await request(app).get('/api/admin/overview').set(auth(adminToken));
      expect(overview.body.openReports).toBe(1);
    });

    it('lists the approval queue with venue clash warnings', async () => {
      const create = (title: string, startTime: string, endTime: string) =>
        request(app)
          .post('/api/events')
          .set(auth(organizerToken))
          .send({
            venueId: smallVenueId,
            title,
            category: 'Workshop',
            audience: 'Beginners',
            description: 'A hands-on workshop for beginners.',
            date: isoDay(10),
            startTime,
            endTime,
            maxCapacity: 100,
            tiers: [{ name: 'Free', priceKes: 0, totalQuantity: 100 }],
          });
      const first = await create('Intro to Flutter Bootcamp', '14:00', '17:00');
      expect(first.status).toBe(201);
      // Pending events do block each other at creation, so make the clash via an edit-free path:
      // insert an overlapping pending event directly, as a legacy/imported record would be.
      const clash = await prisma.event.create({
        data: {
          organizerId: first.body.event.organizerId,
          venueId: smallVenueId,
          title: 'Mobile Dev Meetup',
          category: 'Technology',
          audience: 'All students',
          description: 'Lightning talks.',
          date: new Date(`${isoDay(10)}T00:00:00.000Z`),
          startTime: '16:00',
          endTime: '18:00',
          maxCapacity: 50,
          status: 'PENDING_APPROVAL',
        },
      });

      const res = await request(app).get('/api/admin/events').query({ status: 'PENDING_APPROVAL' }).set(auth(adminToken));
      expect(res.status).toBe(200);
      const flutter = res.body.events.find((e: { id: string }) => e.id === first.body.event.id);
      expect(flutter.clashes).toEqual([expect.objectContaining({ id: clash.id, title: 'Mobile Dev Meetup' })]);
    });

    it('lists and searches users for the admin user table', async () => {
      const all = await request(app).get('/api/admin/users').set(auth(adminToken));
      expect(all.status).toBe(200);
      expect(all.body.total).toBe(4);
      expect(all.body.items[0]).not.toHaveProperty('passwordHash');

      const search = await request(app).get('/api/admin/users').query({ search: 'amani' }).set(auth(adminToken));
      expect(search.body.items.map((u: { email: string }) => u.email)).toEqual(['amani.w@students.ac.ke']);

      const organizers = await request(app).get('/api/admin/users').query({ role: 'ORGANIZER' }).set(auth(adminToken));
      expect(organizers.body.total).toBe(1);
    });

    it('suspends a user, which blocks login and existing tokens', async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${student2Id}/status`)
        .set(auth(adminToken))
        .send({ status: UserStatus.SUSPENDED, reason: 'Ticket resale' });
      expect(res.status).toBe(200);
      expect(res.body.user.status).toBe('SUSPENDED');

      const login = await request(app).post('/api/auth/login').send({ email: 'brian.k@students.ac.ke', password: PASSWORD });
      expect(login.status).toBe(403);
      expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED');

      const me = await request(app).get('/api/auth/me').set(auth(student2Token));
      expect(me.status).toBe(403);
    });

    it('records an immutable audit log entry for every admin action', async () => {
      const res = await request(app).get('/api/admin/audit-logs').set(auth(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);

      const actions = res.body.items.map((i: { action: string }) => i.action);
      expect(actions).toEqual(expect.arrayContaining(['EVENT_STATUS_CHANGED', 'USER_STATUS_CHANGED']));

      const approval = res.body.items.find((i: { action: string }) => i.action === 'EVENT_STATUS_CHANGED');
      expect(approval.actor).toMatchObject({ fullName: 'N. Otieno', role: 'ADMIN' });
      expect(approval).toMatchObject({
        targetType: 'Event',
        targetId: eventId,
        details: { from: 'PENDING_APPROVAL', to: 'PUBLISHED', reason: 'Meets campus guidelines' },
      });

      const filtered = await request(app).get('/api/admin/audit-logs').query({ action: 'USER_STATUS_CHANGED' }).set(auth(adminToken));
      expect(filtered.body.items).toHaveLength(1);
      expect(filtered.body.items[0].targetId).toBe(student2Id);

      expect((await request(app).get('/api/admin/audit-logs').set(auth(organizerToken))).status).toBe(403);
    });

    it('returns structured 404s for unknown routes', async () => {
      const res = await request(app).get('/api/nope');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    });
  });
});
