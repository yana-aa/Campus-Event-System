import { BusinessRuleError, NotFoundError } from '../errors/AppError';
import type {
  AuditLogQuery,
  IAdminGovernanceService,
  IAuditLogRepository,
  ITransactionManager,
  Paginated,
} from '../interfaces';
import {
  AuditAction,
  EventStatus,
  UserStatus,
  type AuditLogView,
  type EventWithDetails,
  type PublicUser,
} from '../models';
import { toAuditLogView, toPublicUser } from '../utils/serializers';

/** Allowed administrative transitions of the event lifecycle. */
export const EVENT_STATUS_TRANSITIONS: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  [EventStatus.DRAFT]: [EventStatus.CANCELLED],
  [EventStatus.PENDING_APPROVAL]: [EventStatus.PUBLISHED, EventStatus.DRAFT, EventStatus.CANCELLED],
  [EventStatus.PUBLISHED]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

/**
 * Administrative state changes. Every change and its audit entry are written
 * in the same transaction, so there is never an unaudited admin action.
 */
export class AdminGovernanceService implements IAdminGovernanceService {
  constructor(
    private readonly tx: ITransactionManager,
    private readonly auditLogs: IAuditLogRepository,
  ) {}

  async changeEventStatus(
    adminId: string,
    eventId: string,
    status: EventStatus,
    reason?: string,
  ): Promise<EventWithDetails> {
    return this.tx.run(async (ctx) => {
      const event = await ctx.events.findById(eventId);
      if (!event) throw new NotFoundError('Event');
      if (!EVENT_STATUS_TRANSITIONS[event.status].includes(status)) {
        throw new BusinessRuleError(
          `Cannot change event status from ${event.status} to ${status}`,
          'INVALID_STATUS_TRANSITION',
          { from: event.status, to: status, allowed: EVENT_STATUS_TRANSITIONS[event.status] },
        );
      }

      await ctx.events.updateStatus(event.id, status);
      const cancelledBookings = status === EventStatus.CANCELLED ? await ctx.bookings.cancelActiveForEvent(event.id) : 0;

      await ctx.auditLogs.append({
        actorId: adminId,
        action: AuditAction.EVENT_STATUS_CHANGED,
        targetType: 'Event',
        targetId: event.id,
        details: {
          from: event.status,
          to: status,
          reason: reason ?? null,
          ...(status === EventStatus.CANCELLED ? { cancelledBookings } : {}),
        },
      });

      const updated = await ctx.events.findById(event.id);
      if (!updated) throw new NotFoundError('Event');
      return updated;
    });
  }

  async changeUserStatus(adminId: string, userId: string, status: UserStatus, reason?: string): Promise<PublicUser> {
    if (adminId === userId && status === UserStatus.SUSPENDED) {
      throw new BusinessRuleError('Administrators cannot suspend their own account', 'SELF_SUSPENSION');
    }
    return this.tx.run(async (ctx) => {
      const user = await ctx.users.findById(userId);
      if (!user) throw new NotFoundError('User');
      if (user.status === status) {
        throw new BusinessRuleError(`User is already ${status}`, 'STATUS_UNCHANGED');
      }

      const updated = await ctx.users.updateStatus(user.id, status);
      await ctx.auditLogs.append({
        actorId: adminId,
        action: AuditAction.USER_STATUS_CHANGED,
        targetType: 'User',
        targetId: user.id,
        details: { from: user.status, to: status, email: user.email, reason: reason ?? null },
      });
      return toPublicUser(updated);
    });
  }

  async listAuditLogs(query: AuditLogQuery): Promise<Paginated<AuditLogView>> {
    const page = await this.auditLogs.list(query);
    return { ...page, items: page.items.map(toAuditLogView) };
  }
}
