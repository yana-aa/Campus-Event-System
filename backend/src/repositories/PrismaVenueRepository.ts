import type { IVenueRepository } from '../interfaces';
import type { PrismaExecutor } from '../lib/prisma';
import type { Venue } from '../models';

export class PrismaVenueRepository implements IVenueRepository {
  constructor(private readonly db: PrismaExecutor) {}

  findById(id: string): Promise<Venue | null> {
    return this.db.venue.findUnique({ where: { id } });
  }

  findAll(): Promise<Venue[]> {
    return this.db.venue.findMany({ orderBy: { name: 'asc' } });
  }
}
