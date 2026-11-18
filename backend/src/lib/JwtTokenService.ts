import jwt, { type SignOptions } from 'jsonwebtoken';
import type { ITokenService, TokenPayload } from '../interfaces';
import { Role } from '../models';

const ROLES = new Set<string>(Object.values(Role));

export class JwtTokenService implements ITokenService {
  constructor(
    private readonly secret: string,
    private readonly expiresIn: string,
  ) {}

  sign(payload: TokenPayload): string {
    const options: SignOptions = { expiresIn: this.expiresIn as SignOptions['expiresIn'], algorithm: 'HS256' };
    return jwt.sign({ userId: payload.userId, role: payload.role }, this.secret, options);
  }

  verify(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof decoded !== 'object' || decoded === null) return null;
      const { userId, role } = decoded as Record<string, unknown>;
      if (typeof userId !== 'string' || typeof role !== 'string' || !ROLES.has(role)) return null;
      return { userId, role: role as Role };
    } catch {
      return null;
    }
  }
}
