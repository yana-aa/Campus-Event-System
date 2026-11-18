import type { Prisma } from '@prisma/client';
import type { AuditLogQuery, CreateAuditLogData, IAuditLogRepository, Paginated } from '../interfaces';
import type { PrismaExecutor } from '../lib/prisma';
import type { AuditLog, AuditLogWithActor } from '../models';

export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: PrismaExecutor) {}

  append(entry: CreateAuditLogData): Promise<AuditLog> {
    return this.db.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    });
  }

  async list(query: AuditLogQuery): Promise<Paginated<AuditLogWithActor>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { actor: { select: { id: true, fullName: true, email: true, role: true } } },
      }),
      this.db.auditLog.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
