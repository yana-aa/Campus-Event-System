import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { homePathFor, useAuth } from './AuthContext';

interface Props {
  roles?: Role[];
  children: ReactNode;
}

/** Route guard: signs anonymous users in, shows a 403 screen for the wrong role. */
export function RequireRole({ roles, children }: Props) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session" fullPage />;
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState
        icon="🔒"
        title="You don't have access to this page"
        description={`This area is for ${roles.map((r) => r.toLowerCase()).join(' or ')} accounts. You're signed in as ${user.role.toLowerCase()}.`}
        action={
          <Link className="btn btn--primary" to={homePathFor(user.role)}>
            Go to my home
          </Link>
        }
      />
    );
  }
  return <>{children}</>;
}
