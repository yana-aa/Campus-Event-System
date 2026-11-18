import type { IBookingCommandRepository } from './IBookingRepository';
import type { IEventReader } from './IEventRepository';
import type { ITicketTierRepository } from './ITicketTierRepository';

/** Repositories bound to a single database transaction. */
export interface TransactionContext {
  bookings: IBookingCommandRepository;
  tiers: ITicketTierRepository;
  events: IEventReader;
}

export interface ITransactionManager {
  run<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
