import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { Role } from '../../api/types';
import { homePathFor, useAuth } from '../../auth/AuthContext';
import { initials } from '../../lib/format';
import { RoleBadge } from '../ui';

interface NavItem {
  to: string;
  label: string;
}

const NAV: Record<Role | 'GUEST', NavItem[]> = {
  GUEST: [{ to: '/events', label: 'Explore events' }],
  STUDENT: [
    { to: '/events', label: 'Explore events' },
    { to: '/my-tickets', label: 'My tickets' },
  ],
  ORGANIZER: [
    { to: '/organizer/dashboard', label: 'Dashboard' },
    { to: '/organizer/events/new', label: 'Create event' },
    { to: '/organizer/check-in', label: 'Door check-in' },
    { to: '/events', label: 'Browse' },
  ],
  ADMIN: [
    { to: '/admin/overview', label: 'Governance' },
    { to: '/events', label: 'Browse events' },
  ],
};

export function Logo() {
  return (
    <span className="logo">
      <span className="logo__mark" aria-hidden="true">
        🎟
      </span>
      <span className="logo__text">
        Campus<strong>Pass</strong>
      </span>
    </span>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = NAV[user?.role ?? 'GUEST'];

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar__inner container">
          <Link to={homePathFor(user?.role)} className="topbar__brand" aria-label="CampusPass home">
            <Logo />
          </Link>
          <button
            type="button"
            className="icon-btn topbar__menu-btn"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ☰
          </button>
          <nav className={['topbar__nav', menuOpen && 'topbar__nav--open'].filter(Boolean).join(' ')} aria-label="Main">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/events'}
                className={({ isActive }) => ['topbar__link', isActive && 'topbar__link--active'].filter(Boolean).join(' ')}
              >
                {item.label}
              </NavLink>
            ))}
            <div className="topbar__account">
              {user ? (
                <>
                  <span className="avatar" aria-hidden="true">
                    {initials(user.fullName)}
                  </span>
                  <span className="topbar__user">
                    <span className="topbar__user-name">{user.fullName}</span>
                    <RoleBadge role={user.role} />
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                  >
                    <span>Sign out</span>
                  </button>
                </>
              ) : (
                <>
                  <Link className="btn btn--ghost btn--sm" to="/login">
                    Sign in
                  </Link>
                  <Link className="btn btn--primary btn--sm" to="/register">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main id="main" className="main container">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer__inner">
          <Logo />
          <p>Student event ticketing for campus life · Prices in Kenyan Shillings (KES)</p>
        </div>
      </footer>
    </div>
  );
}
