import type { ZodType, ZodTypeDef } from 'zod';
import { ValidationError } from '../errors/AppError';

/** Parse untrusted input with a zod schema, throwing a domain ValidationError. */
export function parseOrThrow<T>(schema: ZodType<T, ZodTypeDef, unknown>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      'Request validation failed',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}
