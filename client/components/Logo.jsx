import Link from 'next/link';
import { cn } from '@/lib/utils';

export function LogoMark({ className }) {
  return (
    <span
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-white',
        className,
      )}
      aria-hidden="true"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5" />
        <path d="m8.5 14.5 2 2 4-4.5" />
      </svg>
    </span>
  );
}

export function Logo({ href = '/', className, compact = false }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-2.5', className)}
      aria-label="AI Interview Prep Kit home"
    >
      <LogoMark />
      {!compact && (
        <span className="font-heading text-base font-bold leading-tight tracking-tight text-ink sm:text-lg">
          AI Interview
          <span className="block text-xs font-semibold text-muted sm:text-sm">Prep Kit</span>
        </span>
      )}
    </Link>
  );
}
