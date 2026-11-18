import { z } from 'zod';
import { EventStatus, UserStatus } from '../models';

export const eventStatusSchema = z.object({
  status: z.nativeEnum(EventStatus),
  reason: z.string().trim().max(500).optional(),
});

export const userStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().trim().max(500).optional(),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().min(1).max(60).optional(),
  actorId: z.string().trim().min(1).max(64).optional(),
  targetType: z.string().trim().min(1).max(60).optional(),
});
