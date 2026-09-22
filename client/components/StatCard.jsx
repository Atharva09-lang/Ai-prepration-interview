import { Card } from './Card';
import { cn } from '@/lib/utils';

export function StatCard({ label, value, hint, icon, accent = false }) {
  return (
    <Card className={cn('p-5', accent && 'border-primary/25 bg-primary/[0.03]')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-2 font-heading text-3xl font-bold tracking-tight text-ink">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        {icon && (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              accent ? 'bg-primary/10 text-primary' : 'bg-surface text-muted',
            )}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
    </Card>
  );
}
