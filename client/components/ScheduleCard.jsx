'use client';

import { cn, minutesLabel } from '@/lib/utils';

/**
 * One day of the study schedule. Visual state:
 *  - completed → sage
 *  - current   → terracotta (the first not-yet-completed day)
 *  - upcoming  → gray
 */
export function ScheduleCard({ day, focus, minutes, questionCount, state, completed, saving, onToggle, onSelect }) {
  const isCompleted = state === 'completed';
  const isCurrent = state === 'current';

  return (
    <li className="relative flex gap-4">
      {/* Rail + marker */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
            isCompleted && 'border-success bg-success text-white',
            isCurrent && 'border-accent bg-accent text-white',
            !isCompleted && !isCurrent && 'border-border bg-card text-muted',
          )}
          aria-hidden="true"
        >
          {isCompleted ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 13 4 4L19 7" />
            </svg>
          ) : (
            day
          )}
        </span>
        <span
          className={cn('mt-1 w-0.5 flex-1 rounded', isCompleted ? 'bg-success/40' : 'bg-border')}
          aria-hidden="true"
        />
      </div>

      {/* Body */}
      <div
        className={cn(
          'mb-3 flex-1 rounded-lg border bg-card p-4 shadow-soft transition-colors',
          isCurrent ? 'border-accent/40' : 'border-border',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={onSelect}
            className="min-w-0 text-left focus:outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label={`View Day ${day} questions`}
          >
            <p className="font-heading text-sm font-semibold text-ink">Day {day}</p>
            <p className="mt-0.5 text-sm text-muted">{focus}</p>
          </button>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium font-heading',
              isCompleted && 'bg-success/10 text-success',
              isCurrent && 'bg-accent/10 text-accent',
              !isCompleted && !isCurrent && 'bg-surface text-muted',
            )}
          >
            {isCompleted ? 'Completed' : isCurrent ? 'Up next' : 'Upcoming'}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
            </svg>
            {minutesLabel(minutes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
            {questionCount} question{questionCount === 1 ? '' : 's'}
          </span>
        </div>

        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
          <input
            type="checkbox"
            checked={completed}
            disabled={saving}
            onChange={(e) => onToggle?.(e.target.checked)}
            className="h-4 w-4 rounded border-border text-success accent-[#4f8a5b] focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          />
          Mark complete
          {saving && <span className="text-xs font-normal text-muted" role="status">Saving…</span>}
        </label>
      </div>
    </li>
  );
}
