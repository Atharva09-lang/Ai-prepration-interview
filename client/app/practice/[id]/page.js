'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Flashcard } from '@/components/Flashcard';
import { Button, buttonClasses } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { RequireAuth } from '@/components/RequireAuth';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';
import { CONFIDENCE } from '@/lib/constants';
import { cn } from '@/lib/utils';

const RATINGS = [
  { value: CONFIDENCE.AGAIN, label: 'Again', tone: 'danger', hint: 'Forgot it' },
  { value: CONFIDENCE.GOOD, label: 'Good', tone: 'primary', hint: 'Recalled with effort' },
  { value: CONFIDENCE.EASY, label: 'Easy', tone: 'success', hint: 'Confident' },
];

export default function PracticePage() {
  const { id } = useParams();
  const [cards, setCards] = useState(null); // ordered [{id, front, back, confidence, seen_count}]
  const [rated, setRated] = useState({}); // flashcardId -> confidence given this session
  const [error, setError] = useState(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setCards(null);
    try {
      const [{ kit }, session] = await Promise.all([api.getKit(id), api.getPractice(id)]);
      const byId = Object.fromEntries(
        (kit.flashcards ?? []).filter((f) => !f.deleted).map((f) => [f.id, f]),
      );
      const statsById = Object.fromEntries((session.cards ?? []).map((c) => [c.id, c]));
      const ordered = (session.order ?? [])
        .map((fid) => byId[fid])
        .filter(Boolean)
        .map((f) => ({
          id: f.id,
          front: f.front,
          back: f.back,
          confidence: statsById[f.id]?.confidence ?? null,
          seen_count: statsById[f.id]?.seen_count ?? 0,
        }));
      setCards(ordered);
      setRated({});
      setIndex(0);
      setFlipped(false);
      setFinished(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the practice session.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const total = cards?.length ?? 0;
  const card = cards?.[index];
  const progress = useMemo(() => (total ? (index / total) * 100 : 0), [index, total]);

  // Live coverage: what has been covered and what has not. Ratings from this
  // session overlay the stored ones so the tracker moves as you practise.
  const coverage = useMemo(() => {
    const list = cards ?? [];
    const valueOf = (c) => (c.id in rated ? rated[c.id] : c.confidence);
    const covered = list.filter((c) => valueOf(c) !== null && valueOf(c) !== undefined).length;
    return {
      total: list.length,
      covered,
      notCovered: list.length - covered,
      needsReview: list.filter((c) => [1, 2].includes(valueOf(c))).length,
      confident: list.filter((c) => valueOf(c) === 3).length,
    };
  }, [cards, rated]);

  async function rate(value) {
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      await api.postConfidence(id, card.id, value);
      setRated((r) => ({ ...r, [card.id]: value }));
      if (index + 1 >= total) {
        setFinished(true);
      } else {
        setIndex((i) => i + 1);
        setFlipped(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your answer.');
    } finally {
      setSubmitting(false);
    }
  }

  const coverageRow = total > 0 && (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted" aria-live="polite">
      <span>
        <span className="font-semibold text-ink">{coverage.covered}</span> of {coverage.total} covered
      </span>
      <span>{coverage.notCovered} not covered yet</span>
      <span>{coverage.needsReview} need review</span>
      <span>{coverage.confident} confident</span>
    </div>
  );

  return (
    <RequireAuth>
      <div className="flex min-h-dvh flex-col bg-background">
        {/* Minimal, distraction-free header */}
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo href={`/kits/${id}`} compact />
          <Link href={`/kits/${id}`} className="text-sm font-medium text-muted hover:text-ink">
            ← Back to kit
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-12 sm:px-6">
          {error ? (
            <ErrorState title="Practice unavailable" message={error} onRetry={load} />
          ) : cards === null ? (
            <LoadingState label="Loading practice session…" cards={1} />
          ) : total === 0 ? (
            <EmptyState
              title="No flashcards to practise"
              description="Add or regenerate flashcards in your kit first."
              action={<Link href={`/kits/${id}`} className={buttonClasses('primary', 'md')}>Back to kit</Link>}
            />
          ) : finished ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto mt-10 w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-soft"
            >
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 13 4 4L19 7" />
                </svg>
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Session complete</h1>
              <p className="mt-2 text-sm text-muted">
                You reviewed all {total} card{total === 1 ? '' : 's'}. Nice work.
              </p>
              <p className="mt-1 text-sm text-muted">
                {coverage.covered} of {coverage.total} cards covered · {coverage.needsReview} still need review
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={load}>Practise again</Button>
                <Link href={`/kits/${id}`} className={buttonClasses('primary', 'md')}>Back to kit</Link>
              </div>
            </motion.div>
          ) : (
            <>
              {coverageRow}

              {/* Progress */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">
                    Card {index + 1} of {total}
                  </span>
                  <span className="text-muted">
                    {card.seen_count > 0 && !(card.id in rated)
                      ? `Seen ${card.seen_count}× before`
                      : `${Math.round(progress)}% through`}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-surface"
                  role="progressbar"
                  aria-valuenow={index + 1}
                  aria-valuemin={1}
                  aria-valuemax={total}
                  aria-label="Practice progress"
                >
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{ width: `${((index + (flipped ? 0.5 : 0)) / total) * 100}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <Flashcard
                    front={card.front}
                    back={card.back}
                    flipped={flipped}
                    onFlip={() => setFlipped((v) => !v)}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Controls */}
              <div className="mt-6">
                {!flipped ? (
                  <Button size="lg" className="w-full" onClick={() => setFlipped(true)}>
                    Show Answer
                  </Button>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {RATINGS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        disabled={submitting}
                        onClick={() => rate(r.value)}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 font-heading font-semibold transition-all duration-200',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                          'disabled:opacity-50 active:scale-[0.98]',
                          r.tone === 'danger' && 'border-danger/30 bg-card text-danger hover:bg-danger/5',
                          r.tone === 'primary' && 'border-primary/30 bg-card text-primary hover:bg-primary/5',
                          r.tone === 'success' && 'border-success/30 bg-card text-success hover:bg-success/5',
                        )}
                      >
                        {r.label}
                        <span className="text-[11px] font-normal text-muted">{r.hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
