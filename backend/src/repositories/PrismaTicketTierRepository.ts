import type { ITicketTierRepository } from '../interfaces';
import type { PrismaExecutor } from '../lib/prisma';
import type { TicketTier } from '../models';

export class PrismaTicketTierRepository implements ITicketTierRepository {
  constructor(private readonly db: PrismaExecutor) {}

  findById(id: string): Promise<TicketTier | null> {
    return this.db.ticketTier.findUnique({ where: { id } });
  }

  async tryReserve(tierId: string, expectedSold: number, quantity: number): Promise<boolean> {
    const tier = await this.db.ticketTier.findUnique({ where: { id: tierId }, select: { totalQuantity: true } });
    if (!tier || expectedSold + quantity > tier.totalQuantity) return false;
    // Compare-and-swap on soldQuantity guards against concurrent over-selling.
    const result = await this.db.ticketTier.updateMany({
      where: { id: tierId, soldQuantity: expectedSold },
      data: { soldQuantity: { increment: quantity } },
    });
    return result.count === 1;
  }

  async release(tierId: string, quantity: number): Promise<void> {
    await this.db.ticketTier.updateMany({
      where: { id: tierId, soldQuantity: { gte: quantity } },
      data: { soldQuantity: { decrement: quantity } },
    });
  }
}
