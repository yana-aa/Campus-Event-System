import { NotFoundError, ValidationError } from '../errors/AppError';
import type { CreateReportInput, IEventReader, IReportRepository, IReportService, IUserReader } from '../interfaces';
import type { Report } from '../models';

/** Lets any signed-in user flag an event or account for admin review. */
export class ReportService implements IReportService {
  constructor(
    private readonly reports: IReportRepository,
    private readonly events: IEventReader,
    private readonly users: IUserReader,
  ) {}

  async create(reporterId: string, input: CreateReportInput): Promise<Report> {
    if (input.targetType === 'USER' && input.targetId === reporterId) {
      throw new ValidationError('You cannot report yourself');
    }
    const exists =
      input.targetType === 'EVENT'
        ? Boolean(await this.events.findById(input.targetId))
        : Boolean(await this.users.findById(input.targetId));
    if (!exists) throw new NotFoundError(input.targetType === 'EVENT' ? 'Event' : 'User');
    return this.reports.create({ reporterId, ...input, reason: input.reason.trim() });
  }
}
