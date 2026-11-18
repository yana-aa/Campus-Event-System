import type { Request, Response } from 'express';
import type { IReportService } from '../interfaces';
import { requireAuth } from '../middlewares/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { parseOrThrow } from '../utils/validation';
import { createReportSchema } from '../validators';

export class ReportController {
  constructor(private readonly reports: IReportService) {}

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseOrThrow(createReportSchema, req.body);
    res.status(201).json({ report: await this.reports.create(requireAuth(req).userId, input) });
  });
}
