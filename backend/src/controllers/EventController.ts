import type { Request, Response } from 'express';
import type { IEventService, IVenueRepository } from '../interfaces';
import { requireAuth } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { parseOrThrow } from '../utils/validation';
import { createEventSchema, idParamSchema, listEventsQuerySchema, updateEventSchema } from '../validators';

export class EventController {
  constructor(
    private readonly events: IEventService,
    private readonly venues: IVenueRepository,
  ) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(listEventsQuerySchema, req.query);
    const events = await this.events.listPublished(query);
    res.status(200).json({ count: events.length, events });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    res.status(200).json({ event: await this.events.getById(id, req.auth) });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createEventSchema, req.body);
    res.status(201).json({ event: await this.events.create(requireAuth(req).userId, input) });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const input = parseOrThrow(updateEventSchema, req.body);
    res.status(200).json({ event: await this.events.update(requireAuth(req), id, input) });
  });

  listVenues = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({ venues: await this.venues.findAll() });
  });
}
