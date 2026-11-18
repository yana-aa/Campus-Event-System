import { useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { adminApi } from '../../api/endpoints';
import type { AuditLog, EventForReview, Role, User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Badge, Button, Card, EmptyState, KpiCard, Modal, RoleBadge, SelectField, Spinner, StatusChip, TextArea, Toggle } from '../../components/ui';
import { useAsync, useDebounced } from '../../hooks/useAsync';
import { formatEventDate, formatTime, formatTimestamp, initials } from '../../lib/format';

const STATUS_VERBS: Record<string, string> = {
  PUBLISHED: 'approved',
  DRAFT: 'sent back',
  CANCELLED: 'cancelled',
  COMPLETED: 'marked as completed',
};

export function describeAudit(log: AuditLog): string {
  const d = (log.details ?? {}) as Record<string, unknown>;
  const actor = log.actor?.fullName ?? 'An admin';
  if (log.action === 'EVENT_STATUS_CHANGED') {
    const verb = STATUS_VERBS[String(d.to)] ?? `changed to ${String(d.to)}`;
    return `${actor} ${verb} "${String(d.title ?? 'an event')}"`;
  }
  if (log.action === 'USER_STATUS_CHANGED') {
    return `${actor} ${d.to === 'SUSPENDED' ? 'suspended' : 'reactivated'} ${String(d.email ?? 'a user')}`;
  }
  return `${actor} performed ${log.action}`;
}

export function AdminOverviewPage() {
  const overview = useAsync(() => adminApi.overview(), []);
  const queue = useAsync(() => adminApi.reviewQueue('PENDING_APPROVAL'), []);
  const audit = useAsync(() => adminApi.auditLogs({ pageSize: 12 }), []);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<EventForReview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refreshAll = () => {
    overview.reload();
    queue.reload();
    audit.reload();
  };

  const decide = async (event: EventForReview, status: 'PUBLISHED' | 'DRAFT', reason?: string) => {
    setBusyId(event.id);
    try {
      await adminApi.setEventStatus(event.id, status, reason);
      setNotice({ tone: 'success', text: status === 'PUBLISHED' ? `"${event.title}" approved and published.` : `"${event.title}" sent back to the organizer.` });
      setRejecting(null);
      refreshAll();
    } catch (err) {
      setNotice({ tone: 'danger', text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  };

  const o = overview.data;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Governance console</h1>
          <p className="text-muted">Approve events, manage accounts and review every admin action.</p>
        </div>
        <Button variant="secondary" onClick={refreshAll}>↻ Refresh</Button>
      </header>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {Boolean(overview.error) && <Alert tone="danger" title="Couldn't load KPIs">{errorMessage(overview.error)}</Alert>}

      <div className="kpi-grid">
        <KpiCard label="Registered students" value={o ? o.usersByRole.STUDENT.toLocaleString() : '…'} icon="🎓" />
        <KpiCard label="Active events" value={o ? o.eventsByStatus.PUBLISHED : '…'} hint={o ? `${o.kpis.ticketsSold} tickets issued` : undefined} icon="📅" tone="success" />
        <KpiCard label="Pending approvals" value={o ? o.eventsByStatus.PENDING_APPROVAL : '…'} icon="⏳" tone="warning" />
        <KpiCard label="Open reports" value={o ? o.openReports : '…'} icon="⚑" tone="danger" />
      </div>

      <div className="two-col two-col--wide-left">
        <Card title="Events awaiting approval" actions={queue.data && <Badge tone="warning">{queue.data.count} pending</Badge>}>
          {queue.loading && !queue.data ? (
            <Spinner label="Loading queue" />
          ) : queue.error ? (
            <Alert tone="danger">{errorMessage(queue.error)}</Alert>
          ) : queue.data && queue.data.events.length === 0 ? (
            <EmptyState icon="🎉" title="All caught up" description="No events are waiting for approval." />
          ) : (
            <ul className="approval-list">
              {queue.data?.events.map((event) => (
                <li key={event.id} className="approval">
                  <div className="approval__info">
                    <div className="approval__head">
                      <Link to={`/events/${event.id}`} className="approval__title">{event.title}</Link>
                      {event.clashes.length > 0 && (
                        <span className="badge badge--danger" title={event.clashes.map((c) => c.title).join(', ')}>
                          ⚠ Venue clash
                        </span>
                      )}
                    </div>
                    <p className="text-muted text-small">
                      {event.organizer.fullName} · {formatEventDate(event.date, 'short')} · {formatTime(event.startTime)}–{formatTime(event.endTime)} · {event.venue.name} ({event.maxCapacity}/{event.venue.maxCapacity})
                    </p>
                    {event.clashes.length > 0 && (
                      <p className="approval__clash">
                        Overlaps with{' '}
                        {event.clashes.map((c, i) => (
                          <span key={c.id}>
                            {i > 0 && ', '}"{c.title}" ({formatTime(c.startTime)}–{formatTime(c.endTime)})
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="approval__actions">
                    <Button size="sm" variant="success" loading={busyId === event.id} onClick={() => decide(event, 'PUBLISHED')} aria-label={`Approve ${event.title}`}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === event.id} onClick={() => setRejecting(event)} aria-label={`Reject ${event.title}`}>
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity">
          {audit.loading && !audit.data ? (
            <Spinner label="Loading activity" />
          ) : audit.error ? (
            <Alert tone="danger">{errorMessage(audit.error)}</Alert>
          ) : audit.data && audit.data.items.length === 0 ? (
            <p className="text-muted">No admin actions recorded yet.</p>
          ) : (
            <ol className="feed">
              {audit.data?.items.map((log) => {
                const reason = (log.details as Record<string, unknown> | null)?.reason;
                return (
                  <li key={log.id} className="feed__item">
                    <span className="feed__dot" aria-hidden="true" />
                    <div>
                      <p className="feed__text">{describeAudit(log)}</p>
                      {typeof reason === 'string' && reason && <p className="feed__reason">"{reason}"</p>}
                      <time className="text-muted text-small" dateTime={log.createdAt}>{formatTimestamp(log.createdAt)}</time>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      <UserManagement onChanged={refreshAll} />

      <RejectModal event={rejecting} busy={busyId !== null} onClose={() => setRejecting(null)} onConfirm={(reason) => rejecting && decide(rejecting, 'DRAFT', reason)} />
    </div>
  );
}

function RejectModal({ event, busy, onClose, onConfirm }: { event: EventForReview | null; busy: boolean; onClose(): void; onConfirm(reason: string): void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal
      open={Boolean(event)}
      onClose={onClose}
      title="Reject event"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>
            Reject & notify organizer
          </Button>
        </>
      }
    >
      <p>
        <strong>{event?.title}</strong> will go back to the organizer as a draft. The reason is saved in the audit log.
      </p>
      <TextArea label="Reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Venue clash with Intro to Flutter Bootcamp" />
    </Modal>
  );
}

export function UserManagement({ onChanged }: { onChanged?(): void }) {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const debounced = useDebounced(search.trim(), 300);
  const users = useAsync(() => adminApi.users({ search: debounced || undefined, role: role || undefined, pageSize: 50 }), [debounced, role]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (target: User) => {
    const nextStatus = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setPendingId(target.id);
    setError(null);
    try {
      const { user: updated } = await adminApi.setUserStatus(target.id, nextStatus, nextStatus === 'SUSPENDED' ? 'Suspended from governance console' : 'Reactivated from governance console');
      users.setData((current) => current && { ...current, items: current.items.map((u) => (u.id === updated.id ? updated : u)) });
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card title="User management" padded={false}>
      <div className="card__toolbar">
        <div className="search search--compact">
          <span aria-hidden="true">🔍</span>
          <input type="search" aria-label="Search users" placeholder="Search by name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
          <option value="">All roles</option>
          <option value="STUDENT">Students</option>
          <option value="ORGANIZER">Organizers</option>
          <option value="ADMIN">Admins</option>
        </SelectField>
      </div>
      {error && <div className="card__toolbar"><Alert tone="danger">{error}</Alert></div>}
      {users.loading && !users.data ? (
        <Spinner label="Loading users" />
      ) : users.error ? (
        <Alert tone="danger">{errorMessage(users.error)}</Alert>
      ) : users.data && users.data.items.length === 0 ? (
        <EmptyState icon="👤" title="No users found" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Joined</th>
                <th scope="col">Status</th>
                <th scope="col" className="num">Active</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <span className="avatar" aria-hidden="true">{initials(u.fullName)}</span>
                      <div>
                        <span className="table__primary">{u.fullName}</span>
                        <span className="table__secondary">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td><RoleBadge role={u.role} /></td>
                  <td>{new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td><StatusChip status={u.status} /></td>
                  <td className="num">
                    <Toggle
                      checked={u.status === 'ACTIVE'}
                      label={`${u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'} ${u.fullName}`}
                      disabled={pendingId === u.id || u.id === me?.id}
                      onChange={() => toggle(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
