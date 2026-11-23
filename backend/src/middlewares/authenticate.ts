import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AccountSuspendedError, UnauthorizedError } from '../errors/AppError';
import type { ITokenService, IUserReader, TokenPayload } from '../interfaces';
import { UserStatus } from '../models';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export interface AuthMiddleware {
  /** Requires a valid bearer token for an active account. */
  authenticate: RequestHandler;
  /** Attaches identity when a valid token is present; never rejects. */
  optionalAuth: RequestHandler;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

export function createAuthMiddleware(tokens: ITokenService, users: IUserReader): AuthMiddleware {
  // Re-load the user so suspensions and role changes take effect immediately,
  // even for tokens issued before the change.
  async function resolve(req: Request): Promise<TokenPayload> {
    const token = extractBearer(req);
    if (!token) throw new UnauthorizedError('Missing bearer token');
    const payload = tokens.verify(token);
    if (!payload) throw new UnauthorizedError('Invalid or expired token');
    const user = await users.findById(payload.userId);
    if (!user) throw new UnauthorizedError('Account no longer exists');
    if (user.status === UserStatus.SUSPENDED) throw new AccountSuspendedError();
    return { userId: user.id, role: user.role };
  }

  return {
    authenticate: (req: Request, _res: Response, next: NextFunction) => {
      resolve(req)
        .then((auth) => {
          req.auth = auth;
          next();
        })
        .catch(next);
    },
    optionalAuth: (req: Request, _res: Response, next: NextFunction) => {
      if (!extractBearer(req)) {
        next();
        return;
      }
      resolve(req)
        .then((auth) => {
          req.auth = auth;
          next();
        })
        .catch(() => next());
    },
  };
}

/** Returns the authenticated identity or throws 401 (for use inside controllers). */
export function requireAuth(req: Request): TokenPayload {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}
