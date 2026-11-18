import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Forwards rejected promises from async handlers to the error middleware (Express 4). */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
