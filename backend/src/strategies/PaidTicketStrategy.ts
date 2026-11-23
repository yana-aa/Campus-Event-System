import type { ITicketPricingStrategy, PricedTier } from '../interfaces';

export class PaidTicketStrategy implements ITicketPricingStrategy {
  readonly name = 'PAID';

  supports(tier: PricedTier): boolean {
    return tier.priceKes > 0;
  }

  calculateTotal(tier: PricedTier, quantity: number): number {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new RangeError('Quantity must be a positive integer');
    }
    return tier.priceKes * quantity;
  }
}
