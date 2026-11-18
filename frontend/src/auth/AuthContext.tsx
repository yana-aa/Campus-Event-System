import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getStoredToken, setStoredToken } from '../api/client';
import { authApi } from '../api/endpoints';
import type { Role, User } from '../api/types';

interface AuthState {
  user: User | null;
  /** True until the stored token has been checked against /auth/me. */
  loading: boolean;
  login(email: string, password: string): Promise<User>;
  register(input: { fullName: string; email: string; password: string; role: Role }): Promise<User>;
  logout(): void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(getStoredToken()));

  useEffect(() => {
    if (!getStoredToken()) return;
    let active = true;
    authApi
      .me()
      .then(({ user: me }) => active && setUser(me))
      .catch(() => {
        // Expired, revoked or suspended: drop the token.
        setStoredToken(null);
        if (active) setUser(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setStoredToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (input: { fullName: string; email: string; password: string; role: Role }) => {
    const result = await authApi.register(input);
    setStoredToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Where each role lands after signing in. */
export function homePathFor(role: Role | undefined): string {
  switch (role) {
    case 'ORGANIZER':
      return '/organizer/dashboard';
    case 'ADMIN':
      return '/admin/overview';
    default:
      return '/events';
  }
}
