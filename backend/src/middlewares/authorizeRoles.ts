import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';
import type { Role } from '../models';

/** RBAC guard. Must run after `authenticate`. */
export function authorizeRoles(...allowed: Role[]): RequestHandler {
  const set = new Set<Role>(allowed);
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }
    if (!set.has(req.auth.role)) {
      next(new ForbiddenError(`This action requires one of the roles: ${allowed.join(', ')}`));
      return;
    }
    next();
  };
}
