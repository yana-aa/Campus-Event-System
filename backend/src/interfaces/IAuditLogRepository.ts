import type { AuditLog, AuditLogWithActor } from '../models';

export interface CreateAuditLogData {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  action?: string;
  actorId?: string;
  targetType?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Append-only by design: there is intentionally no update or delete. */
export interface IAuditLogRepository {
  append(entry: CreateAuditLogData): Promise<AuditLog>;
  list(query: AuditLogQuery): Promise<Paginated<AuditLogWithActor>>;
}
