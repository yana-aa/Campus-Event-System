import type { ReactNode } from 'react';
import type { BookingStatus, EventStatus, Role, UserStatus } from '../../api/types';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({ tone = 'neutral', children, icon }: { tone?: BadgeTone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}

type AnyStatus = BookingStatus | EventStatus | UserStatus;

const STATUS_META: Record<AnyStatus, { label: string; tone: BadgeTone }> = {
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  WAITLISTED: { label: 'Waitlisted', tone: 'warning' },
  PAYMENT_DUE: { label: 'Payment due', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  CHECKED_IN: { label: 'Checked in', tone: 'info' },
  DRAFT: { label: 'Draft', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'warning' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'info' },
  ACTIVE: { label: 'Active', tone: 'success' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

/** Consistent label + colour for every booking, event and account status. */
export function StatusChip({ status }: { status: AnyStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`badge badge--${meta.tone} badge--dot`} data-status={status}>
      {meta.label}
    </span>
  );
}

const ROLE_TONE: Record<Role, BadgeTone> = { STUDENT: 'brand', ORGANIZER: 'info', ADMIN: 'danger' };

export function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={ROLE_TONE[role]}>{role.charAt(0) + role.slice(1).toLowerCase()}</Badge>;
}
