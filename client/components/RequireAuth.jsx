'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/Button';

/**
 * Client-side guard for protected pages. While the session is being restored it
 * shows a loading state; if there is no user it redirects to /login.
 * (The server also enforces auth on every API route — this is UX only.)
 */
export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-primary">
        <Spinner className="h-6 w-6" />
        <span className="sr-only">Checking session…</span>
      </div>
    );
  }

  if (!user) return null;

  return children;
}
