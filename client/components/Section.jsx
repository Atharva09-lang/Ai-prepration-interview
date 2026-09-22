'use client';

import { Card } from './Card';
import { Button } from './Button';
import { cn } from '@/lib/utils';

/**
 * A kit section shell: title + optional description, an optional regenerate
 * action, and the section body. Gives every builder section consistent
 * affordances (regenerate one section without touching the others).
 */
export function Section({
  title,
  description,
  action,
  onRegenerate,
  regenerating = false,
  regenerateLabel = 'Regenerate',
  children,
  className,
  id,
}) {
  return (
    <Card className={cn('scroll-mt-24', className)} id={id}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              loading={regenerating}
              aria-label={`${regenerateLabel} ${title}`}
            >
              {!regenerating && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-3-6.7" />
                  <path d="M21 3v5h-5" />
                </svg>
              )}
              {regenerateLabel}
            </Button>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}
