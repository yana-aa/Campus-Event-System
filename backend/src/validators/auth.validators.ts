import { z } from 'zod';
import { Role } from '../models';

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'fullName must be at least 2 characters').max(120),
  email: z.string().trim().toLowerCase().email('A valid email is required').max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
  role: z.enum([Role.STUDENT, Role.ORGANIZER]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});
