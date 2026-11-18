import type { ITicketPricingStrategy, PricedTier } from '../interfaces';

export class FreeTicketStrategy implements ITicketPricingStrategy {
  readonly name = 'FREE';

  supports(tier: PricedTier): boolean {
    return tier.priceKes === 0;
  }

  calculateTotal(_tier: PricedTier, _quantity: number): number {
    return 0;
  }
}
