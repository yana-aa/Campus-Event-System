import type { IAuditLogRepository } from './IAuditLogRepository';
import type { IBookingCommandRepository } from './IBookingRepository';
import type { IEventRepository } from './IEventRepository';
import type { ITicketTierRepository } from './ITicketTierRepository';
import type { IUserRepository } from './IUserRepository';

/**
 * Repositories bound to a single database transaction. Each service only
 * touches the members it needs; tests supply just those members.
 */
export interface TransactionContext {
  bookings: IBookingCommandRepository;
  tiers: ITicketTierRepository;
  events: IEventRepository;
  users: IUserRepository;
  auditLogs: IAuditLogRepository;
}

export interface ITransactionManager {
  run<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
