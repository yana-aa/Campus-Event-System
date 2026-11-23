import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function body(code: string, message: string, details?: unknown): ErrorBody {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(body('ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
};

/** Centralized error -> HTTP mapping. Internal details never leak on 5xx. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      body(
        'VALIDATION_ERROR',
        'Request validation failed',
        err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      ),
    );
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json(body('UNIQUE_CONSTRAINT', 'A record with these values already exists'));
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json(body('NOT_FOUND', 'Record not found'));
      return;
    }
    if (err.code === 'P2034') {
      res.status(409).json(body('TRANSACTION_CONFLICT', 'Concurrent update detected, please retry'));
      return;
    }
  }

  const parseError = err as { type?: string; status?: number };
  if (parseError?.type === 'entity.parse.failed') {
    res.status(400).json(body('MALFORMED_JSON', 'Request body is not valid JSON'));
    return;
  }
  if (parseError?.type === 'entity.too.large') {
    res.status(413).json(body('PAYLOAD_TOO_LARGE', 'Request body is too large'));
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[unhandled]', err);
  res.status(500).json(body('INTERNAL_ERROR', 'An unexpected error occurred'));
};
