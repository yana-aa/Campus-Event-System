import type { PrismaClient } from '@prisma/client';
import type { ITransactionManager, TransactionContext } from '../interfaces';
import { PrismaAuditLogRepository } from './PrismaAuditLogRepository';
import { PrismaBookingRepository } from './PrismaBookingRepository';
import { PrismaEventRepository } from './PrismaEventRepository';
import { PrismaTicketTierRepository } from './PrismaTicketTierRepository';
import { PrismaUserRepository } from './PrismaUserRepository';

/**
 * Runs work inside an interactive Prisma `$transaction`, handing the caller
 * repositories bound to the transaction client so every read/write is atomic.
 */
export class PrismaTransactionManager implements ITransactionManager {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      (tx) =>
        work({
          bookings: new PrismaBookingRepository(tx),
          tiers: new PrismaTicketTierRepository(tx),
          events: new PrismaEventRepository(tx),
          users: new PrismaUserRepository(tx),
          auditLogs: new PrismaAuditLogRepository(tx),
        }),
      { maxWait: 5_000, timeout: 15_000 },
    );
  }
}
