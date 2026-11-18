import { z } from 'zod';
import { EventStatus, Role, UserStatus } from '../models';

export const eventStatusSchema = z.object({
  status: z.nativeEnum(EventStatus),
  reason: z.string().trim().max(500).optional(),
});

export const userStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().trim().max(500).optional(),
});

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const adminEventQuerySchema = z.object({
  status: z.nativeEnum(EventStatus).default(EventStatus.PENDING_APPROVAL),
});

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().trim().min(1).max(60).optional(),
  actorId: z.string().trim().min(1).max(64).optional(),
  targetType: z.string().trim().min(1).max(60).optional(),
});
