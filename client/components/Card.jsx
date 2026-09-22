import { cn } from '@/lib/utils';

export function Card({ className, interactive = false, padded = true, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card shadow-soft',
        padded && 'p-6',
        interactive &&
          'transition-all duration-200 ease-out hover:shadow-lift hover:-translate-y-0.5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
