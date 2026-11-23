import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError, errorMessage } from '../api/client';
import type { Role } from '../api/types';
import { homePathFor, useAuth } from '../auth/AuthContext';
import { Logo } from '../components/layout/AppShell';
import { Alert, Button, SelectField, TextField } from '../components/ui';

const DOMAINS = ['students.ac.ke', 'campus.ac.ke'];

export function validateRegistration(input: { fullName: string; email: string; password: string; role: Role }) {
  const errors: Partial<Record<'fullName' | 'email' | 'password', string>> = {};
  const domain = input.email.trim().toLowerCase().split('@')[1] ?? '';
  if (input.fullName.trim().length < 2) errors.fullName = 'Enter your full name';
  if (!/^[^\s@]+@[^\s@]+$/.test(input.email.trim())) errors.email = 'Enter a valid email address';
  else if (!DOMAINS.includes(domain)) errors.email = 'Use your university email (@students.ac.ke or @campus.ac.ke)';
  else if (input.role === 'ORGANIZER' && domain !== 'campus.ac.ke') errors.email = 'Organizer accounts need an @campus.ac.ke email';
  if (input.password.length < 8) errors.password = 'At least 8 characters';
  else if (!/[A-Za-z]/.test(input.password) || !/\d/.test(input.password)) errors.password = 'Include a letter and a number';
  return errors;
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'STUDENT' as Role });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  const errors = validateRegistration(form);
  const show = (key: keyof typeof errors) => (touched ? errors[key] : undefined);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const me = await register(form);
      navigate(homePathFor(me.role), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'EMAIL_TAKEN' ? 'An account with this email already exists. Sign in instead.' : errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__panel">
        <Logo />
        <h1 className="auth__title">Create your CampusPass</h1>
        <p className="text-muted">Only university emails can join, which keeps events safe for students.</p>
        {error && <Alert tone="danger">{error}</Alert>}
        <form className="stack" onSubmit={onSubmit} noValidate>
          <TextField
            label="Full name"
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            error={show('fullName')}
          />
          <TextField
            label="University email"
            type="email"
            autoComplete="email"
            placeholder="you@students.ac.ke"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={show('email')}
            hint="@students.ac.ke for students, @campus.ac.ke for staff and clubs"
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={show('password')}
            hint="8+ characters with a letter and a number"
          />
          <SelectField label="I am a…" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="STUDENT">Student</option>
            <option value="ORGANIZER">Club / event organizer (staff email)</option>
          </SelectField>
          <Button type="submit" block size="lg" loading={submitting}>
            Create account
          </Button>
        </form>
        <p className="text-center">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
      <aside className="auth__hero" aria-hidden="true">
        <h2>Never miss what's on.</h2>
        <p>Follow clubs, grab free and paid tickets in KES, and join waitlists when events fill up.</p>
      </aside>
    </div>
  );
}
