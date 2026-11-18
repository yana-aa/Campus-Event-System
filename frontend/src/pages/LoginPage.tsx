import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { Logo } from '../components/layout/AppShell';
import { Alert, Button, TextField } from '../components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'amani.w@students.ac.ke' },
  { label: 'Organizer', email: 'cs.club@campus.ac.ke' },
  { label: 'Admin', email: 'n.otieno@campus.ac.ke' },
];
const DEMO_PASSWORD = 'CampusPass@2026';

/** Only allow in-app redirects to prevent open-redirects via ?next=. */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const next = safeNext(params.get('next'));

  if (user) return <Navigate to={next ?? homePathFor(user.role)} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login(email, password);
      navigate(next ?? homePathFor(me.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__panel">
        <Logo />
        <h1 className="auth__title">Welcome back</h1>
        <p className="text-muted">Sign in with your university email to book and manage tickets.</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <form className="stack" onSubmit={onSubmit} noValidate>
          <TextField
            label="University email"
            type="email"
            autoComplete="email"
            placeholder="you@students.ac.ke"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" block size="lg" loading={submitting}>
            Sign in
          </Button>
        </form>
        <p className="text-center">
          New to CampusPass? <Link to="/register">Create an account</Link>
        </p>
        <div className="auth__demo">
          <p className="auth__demo-title">Demo accounts (seeded)</p>
          <div className="auth__demo-buttons">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="chip"
                onClick={() => {
                  setEmail(acc.email);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <aside className="auth__hero" aria-hidden="true">
        <h2>Every campus event, one pass.</h2>
        <p>Hackathons, bootcamps, concerts and club nights. Book in seconds and walk in with a QR code.</p>
      </aside>
    </div>
  );
}
