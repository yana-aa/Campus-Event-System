import type { IPricingStrategyResolver, ITicketPricingStrategy, PricedTier } from '../interfaces';

/**
 * Chooses the first registered strategy that supports a tier. Register more
 * specific strategies first; new tiers are added at the composition root.
 */
export class PricingStrategyResolver implements IPricingStrategyResolver {
  constructor(private readonly strategies: readonly ITicketPricingStrategy[]) {
    if (strategies.length === 0) throw new Error('At least one pricing strategy is required');
  }

  resolve(tier: PricedTier): ITicketPricingStrategy {
    const strategy = this.strategies.find((s) => s.supports(tier));
    if (!strategy) throw new Error(`No pricing strategy supports tier "${tier.name}"`);
    return strategy;
  }
}
