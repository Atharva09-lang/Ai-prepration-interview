import { cn } from '@/lib/utils';

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-md bg-surface', className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-card p-6 shadow-soft', className)}
      aria-hidden="true"
    >
      <Skeleton className="mb-4 h-4 w-1/3" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function LoadingState({ label = 'Loading…', className, cards = 2 }) {
  return (
    <div className={cn('space-y-4', className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function InlineLoading({ label = 'Loading…' }) {
  return (
    <div className="space-y-2 py-2" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <SkeletonText lines={2} />
    </div>
  );
}
