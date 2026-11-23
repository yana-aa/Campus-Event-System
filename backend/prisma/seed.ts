/* eslint-disable no-console */
import { BookingStatus, EventStatus, PrismaClient, ReportStatus, Role, UserStatus } from '@prisma/client';
import { config } from '../src/config/env';
import { BcryptPasswordHasher } from '../src/lib/BcryptPasswordHasher';
import { HmacQRCodeGenerator } from '../src/lib/HmacQRCodeGenerator';

const prisma = new PrismaClient();
const hasher = new BcryptPasswordHasher(config.bcryptSaltRounds);
const qr = new HmacQRCodeGenerator(config.qrHmacSecret);

export const SEED_PASSWORD = 'CampusPass@2026';

/** Calendar day `offset` days from today at 00:00 UTC, so demo data never goes stale. */
function day(offset: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
}

function daysAgo(days: number, hourUtc = 9): Date {
  const d = day(-days);
  d.setUTCHours(hourUtc);
  return d;
}

async function main(): Promise<void> {
  // Reset in FK-safe order so the seed is idempotent.
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.ticketTier.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hasher.hash(SEED_PASSWORD);

  const student = await prisma.user.create({
    data: {
      fullName: 'Amani Wanjiku',
      email: 'amani.w@students.ac.ke',
      passwordHash,
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      fullName: 'Brian Kiptoo',
      email: 'brian.k@students.ac.ke',
      passwordHash,
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
    },
  });

  await prisma.user.create({
    data: {
      fullName: 'Wanjiru Mwangi',
      email: 'wanjiru.m@students.ac.ke',
      passwordHash,
      role: Role.STUDENT,
      status: UserStatus.SUSPENDED,
    },
  });

  const organizer = await prisma.user.create({
    data: {
      fullName: 'Computer Science Club',
      email: 'cs.club@campus.ac.ke',
      passwordHash,
      role: Role.ORGANIZER,
      status: UserStatus.ACTIVE,
    },
  });

  const admin = await prisma.user.create({
    data: {
      fullName: 'N. Otieno',
      email: 'n.otieno@campus.ac.ke',
      passwordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const innovationLab = await prisma.venue.create({
    data: { name: 'Innovation Lab, Block B', maxCapacity: 200, isAccessible: true },
  });

  const lab4 = await prisma.venue.create({
    data: { name: 'Lab 4, Science Block', maxCapacity: 120, isAccessible: false },
  });

  const hackathon = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      venueId: innovationLab.id,
      title: 'Nairobi Tech Hackathon 2026',
      category: 'Technology',
      audience: 'All students',
      description:
        'A 9-hour build sprint where student teams prototype solutions for Nairobi-based challenges. Mentors, meals and prizes included.',
      date: day(17),
      startTime: '09:00',
      endTime: '18:00',
      maxCapacity: 200,
      status: EventStatus.PUBLISHED,
      // Sold counts include walk-up/offline sales so the demo shows 142 / 200 seats booked.
      tiers: {
        create: [
          {
            name: 'Regular',
            description: 'General admission, meals included',
            priceKes: 500,
            totalQuantity: 140,
            soldQuantity: 111,
          },
          {
            name: 'VIP',
            description: 'Reserved seating, mentor office hours and swag pack',
            priceKes: 1500,
            totalQuantity: 50,
            soldQuantity: 21,
          },
          {
            name: 'Volunteer',
            description: 'Help run the event, free entry and a volunteer certificate',
            priceKes: 0,
            totalQuantity: 10,
            soldQuantity: 10,
          },
        ],
      },
    },
    include: { tiers: true },
  });

  const flutter = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      venueId: lab4.id,
      title: 'Intro to Flutter Bootcamp',
      category: 'Workshop',
      audience: 'Beginners',
      description: 'Hands-on introduction to building cross-platform mobile apps with Flutter and Dart.',
      date: day(24),
      startTime: '14:00',
      endTime: '17:00',
      maxCapacity: 120,
      status: EventStatus.PENDING_APPROVAL,
      tiers: {
        create: [{ name: 'Free', description: 'Free entry', priceKes: 0, totalQuantity: 120 }],
      },
    },
  });

  // Second pending event that overlaps the Flutter bootcamp: shows the clash badge in the admin queue.
  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      venueId: lab4.id,
      title: 'Mobile Dev Meetup',
      category: 'Technology',
      audience: 'All students',
      description: 'Lightning talks and demos from student mobile developers.',
      date: flutter.date,
      startTime: '16:00',
      endTime: '18:00',
      maxCapacity: 80,
      status: EventStatus.PENDING_APPROVAL,
      tiers: { create: [{ name: 'Free', priceKes: 0, totalQuantity: 80 }] },
    },
  });

  const jazz = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      venueId: innovationLab.id,
      title: 'Campus Jazz Night',
      category: 'Music',
      audience: 'All students',
      description: 'An evening of live jazz from the university band and guest artists from Nairobi.',
      date: day(31),
      startTime: '18:00',
      endTime: '21:00',
      maxCapacity: 150,
      status: EventStatus.PUBLISHED,
      tiers: { create: [{ name: 'General', priceKes: 300, totalQuantity: 150, soldQuantity: 150 }] },
    },
    include: { tiers: true },
  });

  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      venueId: lab4.id,
      title: 'Git & GitHub Crash Course',
      category: 'Workshop',
      audience: 'First years',
      description: 'Version control fundamentals: commits, branches, pull requests and code review.',
      date: day(5),
      startTime: '10:00',
      endTime: '12:00',
      maxCapacity: 60,
      status: EventStatus.PUBLISHED,
      tiers: { create: [{ name: 'Free', priceKes: 0, totalQuantity: 60, soldQuantity: 18 }] },
    },
  });

  const cyber = await prisma.event.create({
    data: {
      organizerId: organizer.id,
      venueId: lab4.id,
      title: 'Cyber Security Awareness Talk',
      category: 'Technology',
      audience: 'All students',
      description: 'Practical tips on phishing, password hygiene and protecting your M-Pesa account.',
      date: day(-29),
      startTime: '14:00',
      endTime: '16:00',
      maxCapacity: 100,
      status: EventStatus.COMPLETED,
      tiers: { create: [{ name: 'Free', priceKes: 0, totalQuantity: 100, soldQuantity: 64 }] },
    },
    include: { tiers: true },
  });

  const regular = hackathon.tiers.find((t) => t.name === 'Regular');
  if (!regular) throw new Error('Regular tier missing');

  const bookingCode = 'CP-8H2K-4471';
  await prisma.booking.create({
    data: {
      bookingCode,
      userId: student.id,
      eventId: hackathon.id,
      tierId: regular.id,
      quantity: 1,
      totalAmountKes: 500,
      qrPayload: qr.generate({ bookingCode, eventId: hackathon.id, userId: student.id }),
      status: BookingStatus.CONFIRMED,
      needsAccessibility: false,
      createdAt: daysAgo(3),
    },
  });

  const vip = hackathon.tiers.find((t) => t.name === 'VIP');
  if (!vip) throw new Error('VIP tier missing');
  await prisma.booking.create({
    data: {
      bookingCode: 'CP-B7RK-2290',
      userId: student2.id,
      eventId: hackathon.id,
      tierId: vip.id,
      quantity: 2,
      totalAmountKes: 3000,
      qrPayload: qr.generate({ bookingCode: 'CP-B7RK-2290', eventId: hackathon.id, userId: student2.id }),
      status: BookingStatus.CONFIRMED,
      needsAccessibility: true,
      createdAt: daysAgo(40),
    },
  });

  await prisma.booking.create({
    data: {
      bookingCode: 'CP-J4ZZ-2210',
      userId: student.id,
      eventId: jazz.id,
      tierId: jazz.tiers[0].id,
      quantity: 1,
      totalAmountKes: 300,
      qrPayload: null,
      status: BookingStatus.WAITLISTED,
      needsAccessibility: false,
      createdAt: daysAgo(1),
    },
  });

  await prisma.booking.create({
    data: {
      bookingCode: 'CP-SEC1-0815',
      userId: student.id,
      eventId: cyber.id,
      tierId: cyber.tiers[0].id,
      quantity: 1,
      totalAmountKes: 0,
      qrPayload: qr.generate({ bookingCode: 'CP-SEC1-0815', eventId: cyber.id, userId: student.id }),
      status: BookingStatus.CHECKED_IN,
      needsAccessibility: false,
      checkedInAt: daysAgo(29, 13),
      createdAt: daysAgo(70),
    },
  });

  await prisma.report.createMany({
    data: [
      {
        reporterId: student.id,
        targetType: 'EVENT',
        targetId: jazz.id,
        reason: 'Tickets for this event are being resold on WhatsApp groups at triple the price.',
        status: ReportStatus.OPEN,
      },
      {
        reporterId: student2.id,
        targetType: 'EVENT',
        targetId: hackathon.id,
        reason: 'The venue listing says accessible but the side entrance ramp is under repair.',
        status: ReportStatus.OPEN,
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'EVENT_STATUS_CHANGED',
      targetType: 'Event',
      targetId: hackathon.id,
      details: JSON.stringify({
        title: hackathon.title,
        from: EventStatus.PENDING_APPROVAL,
        to: EventStatus.PUBLISHED,
        reason: 'Meets campus event guidelines',
      }),
    },
  });

  console.log('Seed complete.');
  console.log(`  Student   : ${student.email}`);
  console.log(`  Organizer : ${organizer.email} (${organizer.fullName})`);
  console.log(`  Admin     : ${admin.email}`);
  console.log(`  Password  : ${SEED_PASSWORD}`);
  console.log(`  Booking   : ${bookingCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
