import type { CreateReportData, IReportRepository } from '../interfaces';
import type { PrismaExecutor } from '../lib/prisma';
import type { Report, ReportStatus } from '../models';

export class PrismaReportRepository implements IReportRepository {
  constructor(private readonly db: PrismaExecutor) {}

  create(data: CreateReportData): Promise<Report> {
    return this.db.report.create({ data });
  }

  countByStatus(status: ReportStatus): Promise<number> {
    return this.db.report.count({ where: { status } });
  }
}
