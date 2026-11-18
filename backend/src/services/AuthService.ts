import {
  AccountSuspendedError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/AppError';
import type {
  AuthResult,
  IAuthService,
  IPasswordHasher,
  ITokenService,
  IUserRepository,
  RegisterInput,
} from '../interfaces';
import { ALLOWED_EMAIL_DOMAINS, Role, UserStatus, type PublicUser, type User } from '../models';
import { toPublicUser } from '../utils/serializers';

const STAFF_DOMAIN = 'campus.ac.ke';

export class AuthService implements IAuthService {
  /** Compared against when the email is unknown, so response time does not reveal accounts. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: IUserRepository,
    private readonly hasher: IPasswordHasher,
    private readonly tokens: ITokenService,
  ) {}

  static emailDomain(email: string): string {
    const at = email.lastIndexOf('@');
    return at === -1 ? '' : email.slice(at + 1).toLowerCase();
  }

  static isUniversityEmail(email: string): boolean {
    return ALLOWED_EMAIL_DOMAINS.includes(AuthService.emailDomain(email));
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    if (!AuthService.isUniversityEmail(email)) {
      throw new ValidationError(
        `Registration requires a university email (${ALLOWED_EMAIL_DOMAINS.map((d) => `@${d}`).join(' or ')})`,
      );
    }

    const role = input.role ?? Role.STUDENT;
    if (role === Role.ADMIN) {
      throw new ForbiddenError('Administrator accounts cannot be self-registered');
    }
    if (role === Role.ORGANIZER && AuthService.emailDomain(email) !== STAFF_DOMAIN) {
      throw new ForbiddenError(`Organizer accounts require an @${STAFF_DOMAIN} email`);
    }

    if (await this.users.findByEmail(email)) {
      throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN');
    }

    const user = await this.users.create({
      fullName: input.fullName.trim(),
      email,
      passwordHash: await this.hasher.hash(input.password),
      role,
    });
    return this.issue(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const valid = await this.hasher.compare(password, user ? user.passwordHash : await this.getDummyHash());
    if (!user || !valid) throw new UnauthorizedError('Invalid email or password');
    if (user.status === UserStatus.SUSPENDED) throw new AccountSuspendedError();
    return this.issue(user);
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User');
    return toPublicUser(user);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('campuspass-timing-equaliser');
    return this.dummyHash;
  }

  private issue(user: User): AuthResult {
    return { token: this.tokens.sign({ userId: user.id, role: user.role }), user: toPublicUser(user) };
  }
}
