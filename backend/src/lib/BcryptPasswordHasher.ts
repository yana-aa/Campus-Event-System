import bcrypt from 'bcryptjs';
import type { IPasswordHasher } from '../interfaces';

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly saltRounds = 10) {}

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
