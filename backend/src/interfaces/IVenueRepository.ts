import type { Venue } from '../models';

export interface IVenueRepository {
  findById(id: string): Promise<Venue | null>;
  findAll(): Promise<Venue[]>;
}
