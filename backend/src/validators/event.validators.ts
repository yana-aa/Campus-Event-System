import { z } from 'zod';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:mm (24h)');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date must be YYYY-MM-DD');
const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const tierSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).nullish(),
  priceKes: z.number().int('priceKes must be whole shillings').min(0).max(1_000_000),
  totalQuantity: z.number().int().min(1).max(100_000),
});

const eventFields = {
  venueId: z.string().min(1),
  title: z.string().trim().min(3).max(150),
  category: z.string().trim().min(2).max(60),
  audience: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(5000),
  date,
  startTime: time,
  endTime: time,
  maxCapacity: z.number().int().min(1).max(100_000),
  coverImageUrl: z.string().url().max(2048).nullish(),
  submitForApproval: z.boolean().optional(),
};

export const createEventSchema = z.object({
  ...eventFields,
  tiers: z.array(tierSchema).min(1).max(10),
});

export const updateEventSchema = z
  .object(eventFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided');

export const listEventsQuerySchema = z.object({
  category: z.string().trim().min(1).max(60).optional(),
  dateRange: z.enum(['today', 'week', 'month']).optional(),
  priceType: z.enum(['free', 'paid']).optional(),
  accessibleOnly: booleanString.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1).max(64) });
