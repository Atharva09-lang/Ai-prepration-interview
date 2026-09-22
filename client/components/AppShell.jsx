'use client';

import { Navbar } from './Navbar';
import { RequireAuth } from './RequireAuth';
import { cn } from '@/lib/utils';

/**
 * Shared chrome for authenticated pages: session guard + navbar + a centered
 * content container. Keeps protected pages consistent without a route group.
 */
export function AppShell({ children, className, wide = false }) {
  return (
    <RequireAuth>
      <div className="flex min-h-dvh flex-col">
        <Navbar />
        <main
          className={cn(
            'mx-auto w-full flex-1 px-4 py-8 sm:px-6',
            wide ? 'max-w-7xl' : 'max-w-6xl',
            className,
          )}
        >
          {children}
        </main>
      </div>
    </RequireAuth>
  );
}
