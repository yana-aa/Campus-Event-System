import type { Role, User, UserStatus } from '../models';

export interface CreateUserData {
  fullName: string;
  email: string;
  passwordHash: string;
  role: Role;
}

/** Read-only user lookups (used by auth middleware and services). */
export interface IUserReader {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
}

/** User persistence and governance. */
export interface IUserRepository extends IUserReader {
  create(data: CreateUserData): Promise<User>;
  updateStatus(id: string, status: UserStatus): Promise<User>;
  countByRole(): Promise<Record<Role, number>>;
}
