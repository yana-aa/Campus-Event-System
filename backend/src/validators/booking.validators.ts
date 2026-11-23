import { z } from 'zod';

export const createBookingSchema = z.object({
  eventId: z.string().min(1),
  tierId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  needsAccessibility: z.boolean().optional(),
});

export const BOOKING_CODE_PATTERN = /^CP-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export const validateTicketSchema = z
  .object({
    eventId: z.string().min(1),
    qrPayload: z.string().min(1).max(2048).optional(),
    bookingCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(BOOKING_CODE_PATTERN, 'Booking code must look like CP-XXXX-XXXX')
      .optional(),
  })
  .refine((v) => Boolean(v.qrPayload) !== Boolean(v.bookingCode), {
    message: 'Provide exactly one of qrPayload or bookingCode',
    path: ['qrPayload'],
  });

export const createReportSchema = z.object({
  targetType: z.enum(['EVENT', 'USER']),
  targetId: z.string().min(1).max(64),
  reason: z.string().trim().min(5).max(1000),
});
