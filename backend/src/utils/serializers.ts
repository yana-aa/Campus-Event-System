import type { AuditLog, AuditLogView, AuditLogWithActor, PublicUser, User } from '../models';

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}

export function toAuditLogView(log: AuditLog | AuditLogWithActor): AuditLogView {
  let details: unknown = null;
  if (log.details) {
    try {
      details = JSON.parse(log.details);
    } catch {
      details = log.details;
    }
  }
  return { ...log, details, actor: 'actor' in log ? log.actor : null };
}
