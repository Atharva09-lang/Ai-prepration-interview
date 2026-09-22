import { cn } from '@/lib/utils';

const base =
  'inline-flex items-center justify-center gap-2 font-heading font-semibold rounded-md ' +
  'transition-all duration-200 ease-out select-none ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ' +
  'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-soft',
  accent: 'bg-accent text-white hover:brightness-95 shadow-soft',
  secondary: 'bg-surface text-ink border border-border hover:bg-border/50',
  outline: 'bg-card text-ink border border-border hover:bg-surface',
  ghost: 'text-muted hover:text-ink hover:bg-surface',
  danger: 'bg-card text-danger border border-danger/30 hover:bg-danger/5',
};

const sizes = {
  sm: 'text-sm px-3 py-1.5',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-base px-6 py-3',
};

export function buttonClasses(variant = 'primary', size = 'md', className) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Spinner({ className }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
