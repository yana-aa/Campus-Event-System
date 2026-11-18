import { z } from 'zod';

export const createBookingSchema = z.object({
  eventId: z.string().min(1),
  tierId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  needsAccessibility: z.boolean().optional(),
});

export const validateTicketSchema = z.object({
  eventId: z.string().min(1),
  qrPayload: z.string().min(1).max(2048),
});
