'use client';

import { Button } from './Button';
import { cn } from '@/lib/utils';

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-danger/30',
        'bg-danger/5 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger/15 text-danger">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
