import type { Request, Response } from 'express';
import type { IAdminAnalyticsService, IAdminGovernanceService } from '../interfaces';
import { requireAuth } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { parseOrThrow } from '../utils/validation';
import { auditLogQuerySchema, eventStatusSchema, idParamSchema, userStatusSchema } from '../validators';

export class AdminController {
  constructor(
    private readonly analytics: IAdminAnalyticsService,
    private readonly governance: IAdminGovernanceService,
  ) {}

  overview = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json(await this.analytics.getAdminOverview());
  });

  changeEventStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const { status, reason } = parseOrThrow(eventStatusSchema, req.body);
    const event = await this.governance.changeEventStatus(requireAuth(req).userId, id, status, reason);
    res.status(200).json({ event });
  });

  changeUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const { status, reason } = parseOrThrow(userStatusSchema, req.body);
    const user = await this.governance.changeUserStatus(requireAuth(req).userId, id, status, reason);
    res.status(200).json({ user });
  });

  auditLogs = asyncHandler(async (req: Request, res: Response) => {
    const query = parseOrThrow(auditLogQuerySchema, req.query);
    res.status(200).json(await this.governance.listAuditLogs(query));
  });
}
