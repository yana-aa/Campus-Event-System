import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      icon="🧭"
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={<Link className="btn btn--primary" to="/events">Explore events</Link>}
    />
  );
}
