import type { Role } from '../models';

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export interface TokenPayload {
  userId: string;
  role: Role;
}

export interface ITokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload | null;
}

export interface IBookingCodeGenerator {
  /** e.g. CP-8H2K-4471 */
  generate(): string;
}
