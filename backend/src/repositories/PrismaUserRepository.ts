import type { Prisma } from '@prisma/client';
import type { CreateUserData, IUserRepository, Paginated, UserListQuery } from '../interfaces';
import type { PrismaExecutor } from '../lib/prisma';
import { Role, type User, type UserStatus } from '../models';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db: PrismaExecutor) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  create(data: CreateUserData): Promise<User> {
    return this.db.user.create({ data: { ...data, email: data.email.toLowerCase() } });
  }

  updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.db.user.update({ where: { id }, data: { status } });
  }

  async countByRole(): Promise<Record<Role, number>> {
    const rows = await this.db.user.groupBy({ by: ['role'], _count: { _all: true } });
    const result = Object.fromEntries(Object.values(Role).map((r) => [r, 0])) as Record<Role, number>;
    for (const row of rows) result[row.role] = row._count._all;
    return result;
  }

  async list(query: UserListQuery): Promise<Paginated<User>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { OR: [{ fullName: { contains: query.search } }, { email: { contains: query.search.toLowerCase() } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
