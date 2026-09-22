'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo';
import { Button } from './Button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/kits', label: 'My Kits' },
  { href: '/generate', label: 'Generate' },
];

function isActive(pathname, href) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    setOpen(false);
    await logout();
    router.push('/login');
  };

  const navLinks = user ? LINKS : [];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
      <nav
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
        aria-label="Main"
      >
        <div className="flex items-center gap-8">
          <Logo href={user ? '/dashboard' : '/'} />

          {user && (
            <ul className="hidden items-center gap-1 md:flex">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200',
                      isActive(pathname, l.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:bg-surface hover:text-ink',
                    )}
                    aria-current={isActive(pathname, l.href) ? 'page' : undefined}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-md bg-surface" aria-hidden="true" />
          ) : user ? (
            <>
              <span
                className="hidden max-w-[180px] truncate rounded-full bg-surface px-3 py-1.5 text-sm text-muted lg:inline"
                title={user.email}
              >
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={onLogout} className="hidden sm:inline-flex">
                Logout
              </Button>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label="Toggle navigation menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink transition-colors hover:bg-surface md:hidden"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link href="/register" className="hidden sm:block">
                <Button size="sm">Create account</Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      <AnimatePresence>
        {open && user && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden border-t border-border bg-card md:hidden"
          >
            <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'block rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive(pathname, l.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted hover:bg-surface hover:text-ink',
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-border pt-2">
                <span className="block truncate px-3 py-1.5 text-xs text-muted">{user.email}</span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/5"
                >
                  Logout
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
