'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ScheduleCard } from '@/components/ScheduleCard';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { buttonClasses } from '@/components/Button';
import { useKit } from '@/hooks/useKit';
import { api } from '@/lib/api';
import { minutesLabel } from '@/lib/utils';

export default function SchedulePage() {
  const { id } = useParams();
  const { kit, loading, error, refetch, setKit } = useKit(id);
  const [selectedDay, setSelectedDay] = useState(null);
  const [savingDay, setSavingDay] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Completion is stored on the kit, so it follows the user across devices.
  const completed = useMemo(
    () => new Set(kit?.completed_days ?? []),
    [kit],
  );

  const days = kit?.schedule?.days ?? [];

  const questionById = useMemo(() => {
    const map = {};
    for (const q of kit?.questions ?? []) {
      if (!q.deleted) map[q.id] = q;
    }
    return map;
  }, [kit]);

  // The "current" day is the first day not yet marked complete.
  const currentDay = useMemo(() => {
    const d = days.find((day) => !completed.has(day.day));
    return d?.day ?? null;
  }, [days, completed]);

  const totalMinutes = useMemo(
    () => days.reduce((sum, d) => sum + (d.minutes ?? 0), 0),
    [days],
  );

  function toggle(dayNum, isDone) {
    // Optimistic: tick the box immediately, then persist. On failure the
    // previous value is restored and the error is shown, so the tracker never
    // silently disagrees with the server.
    const previous = kit?.completed_days ?? [];
    const optimistic = isDone
      ? [...new Set([...previous, dayNum])].sort((a, b) => a - b)
      : previous.filter((d) => d !== dayNum);

    setSaveError(null);
    setSavingDay(dayNum);
    setKit({ ...kit, completed_days: optimistic });

    api
      .setDayComplete(id, dayNum, isDone)
      .then((res) => setKit({ ...kit, completed_days: res.completed_days }))
      .catch((err) => {
        setKit({ ...kit, completed_days: previous });
        setSaveError(err instanceof Error ? err.message : 'Could not save your progress.');
      })
      .finally(() => setSavingDay(null));
  }

  if (loading) {
    return (
      <AppShell>
        <LoadingState label="Loading schedule…" cards={3} />
      </AppShell>
    );
  }

  if (error || !kit) {
    return (
      <AppShell>
        <ErrorState title="Kit not found" message={error ?? 'We could not load this schedule.'} onRetry={refetch} />
        <div className="mt-6 text-center">
          <Link href="/kits" className={buttonClasses('outline', 'md')}>Back to My Kits</Link>
        </div>
      </AppShell>
    );
  }

  const company = kit.source?.company || 'This company';

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href={`/kits/${id}`} className="text-sm font-medium text-muted hover:text-ink">
              ← {company}
            </Link>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Study Schedule</h1>
            <p className="mt-1 text-sm text-muted">
              {days.length} day{days.length === 1 ? '' : 's'} · {minutesLabel(totalMinutes)} total ·{' '}
              {completed.size}/{days.length || 0} complete
            </p>
            {days.length > 0 && (
              <div
                className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-surface"
                role="progressbar"
                aria-valuenow={completed.size}
                aria-valuemin={0}
                aria-valuemax={days.length}
                aria-label="Schedule days completed"
              >
                <div
                  className="h-full rounded-full bg-success transition-[width] duration-300"
                  style={{ width: `${(completed.size / days.length) * 100}%` }}
                />
              </div>
            )}
          </div>
          <Link href={`/practice/${id}`} className={buttonClasses('accent', 'md')}>
            Practise flashcards
          </Link>
        </header>

        {saveError && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
            {saveError}
          </div>
        )}

        {days.length === 0 ? (
          <EmptyState
            title="No schedule yet"
            description="This kit has no study plan. Regenerate the schedule from the kit page."
            action={<Link href={`/kits/${id}`} className={buttonClasses('primary', 'md')}>Open kit</Link>}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            {/* Timeline */}
            <ol className="min-w-0">
              {days.map((d) => {
                const state = completed.has(d.day)
                  ? 'completed'
                  : d.day === currentDay
                    ? 'current'
                    : 'upcoming';
                return (
                  <ScheduleCard
                    key={d.day}
                    day={d.day}
                    focus={d.focus}
                    minutes={d.minutes}
                    questionCount={d.question_ids?.length ?? 0}
                    state={state}
                    completed={completed.has(d.day)}
                    saving={savingDay === d.day}
                    onToggle={(v) => toggle(d.day, v)}
                    onSelect={() => setSelectedDay(d.day === selectedDay ? null : d.day)}
                  />
                );
              })}
            </ol>

            {/* Day detail */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <Card className="p-5">
                <h2 className="text-sm font-semibold text-ink">
                  {selectedDay ? `Day ${selectedDay} questions` : 'Select a day'}
                </h2>
                {(() => {
                  const day = days.find((x) => x.day === selectedDay);
                  if (!day) {
                    return (
                      <p className="mt-2 text-sm text-muted">
                        Pick a day on the timeline to see its questions and focus.
                      </p>
                    );
                  }
                  const qs = (day.question_ids ?? []).map((qid) => questionById[qid]).filter(Boolean);
                  return (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm text-muted">{day.focus}</p>
                      {qs.length === 0 ? (
                        <p className="text-sm text-muted italic">No questions mapped to this day.</p>
                      ) : (
                        <ul className="space-y-2">
                          {qs.map((q) => (
                            <li key={q.id} className="rounded-md border border-border bg-background p-2.5">
                              <p className="text-sm text-ink">{q.prompt}</p>
                              <p className="mt-1 text-xs capitalize text-muted">{q.category}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
              </Card>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
