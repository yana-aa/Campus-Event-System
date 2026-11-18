import type { TicketTier } from '../models';

export type PricedTier = Pick<TicketTier, 'id' | 'name' | 'priceKes'>;

/**
 * Open/Closed: add a new pricing tier (early-bird, group, member discount...)
 * by implementing this interface and registering it - BookingService never changes.
 */
export interface ITicketPricingStrategy {
  readonly name: string;
  supports(tier: PricedTier): boolean;
  calculateTotal(tier: PricedTier, quantity: number): number;
}

export interface IPricingStrategyResolver {
  resolve(tier: PricedTier): ITicketPricingStrategy;
}
