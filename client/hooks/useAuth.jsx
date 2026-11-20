'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

// Last known user, so the header can show the right state while /api/auth/me
// is in flight (a cold backend can take 15-20s to answer).
const USER_CACHE_KEY = 'aipk.user';

function readCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user) {
  if (typeof window === 'undefined') return;
  try {
    if (user) window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the UI works without it.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Apply the cached user immediately; the server check below is the source of truth.
  useEffect(() => {
    const cached = readCachedUser();
    if (cached) setUser((current) => current ?? cached);
  }, []);

  // Restore the session cookie on first load.
  useEffect(() => {
    let active = true;
    api
      .me()
      .then((res) => {
        if (!active) return;
        writeCachedUser(res.user);
        setUser(res.user);
      })
      .catch(() => {
        if (!active) return;
        writeCachedUser(null);
        setUser(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    writeCachedUser(res.user);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email, password) => {
    const res = await api.register(email, password);
    writeCachedUser(res.user);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      writeCachedUser(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
