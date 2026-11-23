import type { Request, Response } from 'express';
import type { IAdminAnalyticsService, IEventService } from '../interfaces';
import { requireAuth } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';

export class OrganizerController {
  constructor(
    private readonly analytics: IAdminAnalyticsService,
    private readonly events: IEventService,
  ) {}

  dashboard = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json(await this.analytics.getOrganizerDashboard(requireAuth(req).userId));
  });

  myEvents = asyncHandler(async (req: Request, res: Response) => {
    const events = await this.events.listForOrganizer(requireAuth(req).userId);
    res.status(200).json({ count: events.length, events });
  });
}
