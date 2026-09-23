'use client';

import { useState } from 'react';
import { Badge } from './StatusBadge';
import { EditableText } from './EditableText';
import { cn, CATEGORY_LABEL, DIFFICULTY_LABEL } from '@/lib/utils';

const DIFFICULTY_TONE = { 1: 'success', 2: 'warning', 3: 'accent' };

/**
 * One interview question with inline editing, difficulty control, related
 * requirements, delete, and keyboard-friendly reorder buttons. The parent
 * renders this inside a framer-motion Reorder.Item for drag-and-drop.
 */
export function QuestionCard({
  question,
  requirements = [],
  onEdit,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
  saved,
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const reqText = (id) => requirements.find((r) => r.id === id)?.text;

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-soft transition-shadow hover:shadow-lift">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1 text-xs text-muted">
              <span className="sr-only">Category</span>
              <select
                value={question.category}
                onChange={(e) => onEdit?.({ category: e.target.value })}
                className={cn(
                  'rounded-full border border-primary/20 bg-card px-2 py-0.5',
                  'text-xs font-medium font-heading text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30',
                )}
                aria-label="Move question to category"
                title="Move this question to another category"
              >
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1 text-xs text-muted">
              <span className="sr-only">Difficulty</span>
              <select
                value={question.difficulty ?? 2}
                onChange={(e) => onEdit?.({ difficulty: Number(e.target.value) })}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs font-medium font-heading',
                  'bg-card focus:outline-none focus:ring-2 focus:ring-primary/30',
                  question.difficulty === 1 && 'border-success/20 text-success',
                  question.difficulty === 2 && 'border-warning/20 text-warning',
                  question.difficulty === 3 && 'border-accent/20 text-accent',
                )}
                aria-label="Difficulty"
              >
                <option value={1}>Easy</option>
                <option value={2}>Medium</option>
                <option value={3}>Hard</option>
              </select>
            </label>
            {question.origin === 'user' && <Badge tone="outline">Yours</Badge>}
            {question.pinned && <Badge tone="outline">Pinned</Badge>}
            {saved && (
              <span className="text-xs font-medium text-success" role="status">
                Saved
              </span>
            )}
          </div>

          <EditableText
            label="Question prompt"
            value={question.prompt}
            multiline
            onSave={(next) => onEdit?.({ prompt: next })}
            className="-mx-2.5 font-medium text-ink"
          />

          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              aria-expanded={showAnswer}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn('transition-transform', showAnswer && 'rotate-90')}
                aria-hidden="true"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
              {showAnswer ? 'Hide answer outline' : 'Show answer outline'}
            </button>
            {showAnswer && (
              <div className="mt-2 rounded-md bg-surface/70 p-1">
                <EditableText
                  label="Answer outline"
                  value={question.answer_outline}
                  multiline
                  placeholder="Add an answer outline…"
                  onSave={(next) => onEdit?.({ answer_outline: next })}
                  className="text-muted"
                />
              </div>
            )}
          </div>

          {question.requirement_ids?.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {question.requirement_ids.map((rid) => (
                <li key={rid}>
                  <span
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted"
                    title={reqText(rid) || rid}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" aria-hidden="true" />
                    <span className="truncate">{reqText(rid) || rid}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit?.({ pinned: !question.pinned })}
            aria-pressed={!!question.pinned}
            aria-label={question.pinned ? 'Unpin question' : 'Pin question'}
            title={question.pinned ? 'Unpin — allow regeneration to replace it' : 'Pin — keep it through regeneration'}
            className={cn(
              'rounded-md p-1 transition-colors hover:bg-surface',
              question.pinned ? 'text-primary' : 'text-muted hover:text-ink',
            )}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={question.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMove?.(-1)}
            disabled={!canMoveUp}
            aria-label="Move question up"
            className="rounded-md p-1 text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 15 6-6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMove?.(1)}
            disabled={!canMoveDown}
            aria-label="Move question down"
            className="rounded-md p-1 text-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete question"
            className="mt-1 rounded-md p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
