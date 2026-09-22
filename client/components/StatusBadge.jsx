import { cn } from '@/lib/utils';

const tones = {
  neutral: 'bg-surface text-ink border-border',
  primary: 'bg-primary/10 text-primary border-primary/20',
  accent: 'bg-accent/10 text-accent border-accent/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  outline: 'bg-card text-muted border-border',
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5',
        'text-xs font-medium font-heading whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_MAP = {
  ready: { tone: 'success', label: 'Ready' },
  generating: { tone: 'primary', label: 'Generating' },
  failed: { tone: 'danger', label: 'Failed' },
  succeeded: { tone: 'success', label: 'Done' },
  running: { tone: 'primary', label: 'Running' },
  queued: { tone: 'outline', label: 'Queued' },
};

export function StatusBadge({ status, className }) {
  const cfg = STATUS_MAP[status] ?? { tone: 'outline', label: status };
  return (
    <Badge tone={cfg.tone} className={className}>
      {status === 'generating' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
      )}
      {cfg.label}
    </Badge>
  );
}
