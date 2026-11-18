import type { TicketTier } from '../models';

export interface ITicketTierRepository {
  findById(id: string): Promise<TicketTier | null>;
  /**
   * Optimistic-concurrency increment: succeeds only if `soldQuantity` still
   * equals `expectedSold` and the new total does not exceed `totalQuantity`.
   * Returns false when another writer got there first or stock ran out.
   */
  tryReserve(tierId: string, expectedSold: number, quantity: number): Promise<boolean>;
  release(tierId: string, quantity: number): Promise<void>;
}
