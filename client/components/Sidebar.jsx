'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Kit section navigation. On desktop it is a sticky left rail; on mobile it
 * becomes a horizontally scrollable row of chips. `items` may be links
 * (href) or in-page anchors (href starting with "#").
 */
export function Sidebar({ items, activeHref, header, footer, className }) {
  return (
    <aside
      className={cn(
        'flex w-full flex-col gap-1 rounded-xl border border-border bg-card p-3 shadow-soft',
        'lg:sticky lg:top-20 lg:w-60 lg:self-start',
        className,
      )}
      aria-label="Kit sections"
    >
      {header && <div className="px-2 pb-2 pt-1">{header}</div>}
      <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {items.map((item) => {
          const active =
            activeHref === item.href ||
            (item.href !== activeHref && !item.href.startsWith('#') && activeHref?.startsWith(item.href + '/'));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium',
                'transition-colors duration-200 lg:w-full',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-surface hover:text-ink',
              )}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
              {item.badge !== undefined && (
                <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {footer && <div className="mt-auto hidden px-2 pt-3 lg:block">{footer}</div>}
    </aside>
  );
}
