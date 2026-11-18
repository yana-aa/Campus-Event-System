import type { Report, ReportStatus } from '../models';

export interface CreateReportData {
  reporterId: string;
  targetType: 'EVENT' | 'USER';
  targetId: string;
  reason: string;
}

export interface IReportRepository {
  create(data: CreateReportData): Promise<Report>;
  countByStatus(status: ReportStatus): Promise<number>;
}
