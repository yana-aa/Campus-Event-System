/* eslint-disable no-console */
import { BookingStatus, EventStatus, PrismaClient, Role, UserStatus } from '@prisma/client';
import { config } from '../src/config/env';
import { BcryptPasswordHasher } from '../src/lib/BcryptPasswordHasher';
import { HmacQRCodeGenerator } from '../src/lib/HmacQRCodeGenerator';

const prisma = new PrismaClient();
const hasher = new BcryptPasswordHasher(config.bcryptSaltRounds);
const qr = new HmacQRCodeGenerator(config.qrHmacSecret);

export const SEED_PASSWORD = 'CampusPass@2026';

async function main(): Promise<void> {
  // Reset in FK-safe order so the seed is idempotent.
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
      date: new Date('2026-12-05T00:00:00.000Z'),
      startTime: '09:00',
      endTime: '18:00',
      maxCapacity: 200,
      status: EventStatus.PUBLISHED,
      coverImageUrl: 'https://images.campuspass.example/hackathon-2026.jpg',
      tiers: {
        create: [
          {
            name: 'Regular',
            description: 'General admission, meals included',
            priceKes: 500,
            totalQuantity: 150,
            soldQuantity: 1,
          },
          {
            name: 'VIP',
            description: 'Reserved seating, mentor office hours and swag pack',
            priceKes: 1500,
            totalQuantity: 50,
            soldQuantity: 0,
          },
        ],
      },
    },
    include: { tiers: true },
  });

  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      venueId: lab4.id,
      title: 'Intro to Flutter Bootcamp',
      category: 'Workshop',
      audience: 'Beginners',
      description: 'Hands-on introduction to building cross-platform mobile apps with Flutter and Dart.',
      date: new Date('2026-12-12T00:00:00.000Z'),
      startTime: '14:00',
      endTime: '17:00',
      maxCapacity: 120,
      status: EventStatus.PENDING_APPROVAL,
      tiers: {
        create: [{ name: 'Free', description: 'Free entry', priceKes: 0, totalQuantity: 120 }],
      },
    },
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
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'EVENT_STATUS_CHANGED',
      targetType: 'Event',
      targetId: hackathon.id,
      details: JSON.stringify({ from: EventStatus.PENDING_APPROVAL, to: EventStatus.PUBLISHED, reason: 'Seed data' }),
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
