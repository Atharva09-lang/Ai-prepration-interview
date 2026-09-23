'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { StatCard } from '@/components/StatCard';
import { KitCard } from '@/components/KitCard';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonCard } from '@/components/LoadingState';
import { buttonClasses } from '@/components/Button';
import { useKits } from '@/hooks/useKits';
import { greeting, practiceStreak } from '@/lib/utils';

export default function DashboardPage() {
  const { kits, loading, error, refetch } = useKits();

  const total = kits.length;
  const ready = kits.filter((k) => k.status === 'ready').length;
  const generating = kits.filter((k) => k.status === 'generating').length;
  // A session is complete once every flashcard in that kit has been rated.
  const completedSessions = kits.filter((k) => k.progress?.practice_complete).length;
  const streak = practiceStreak(kits);
  const recent = [...kits].slice(0, 6);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {greeting()}. Ready for your next interview?
            </h1>
            <p className="mt-1 text-sm text-muted">
              Track and continue your interview preparation.
            </p>
          </div>
          <Link href="/generate" className={buttonClasses('primary', 'md')}>
            Create New Kit
          </Link>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
          <StatCard label="Total Kits" value={loading ? '—' : total} accent icon={<IconStack />} />
          <StatCard
            label="Active Preparation"
            value={loading ? '—' : ready}
            hint={generating ? `${generating} generating now` : 'Ready to study'}
            icon={<IconBook />}
          />
          <StatCard
            label="Completed Sessions"
            value={loading ? '—' : completedSessions}
            hint={completedSessions ? 'Decks fully practised' : 'Finish a practice deck to start'}
            icon={<IconCheck />}
          />
          <StatCard
            label="Practice Streak"
            value={loading ? '—' : streak}
            hint={streak ? 'Consecutive days practised' : 'Rate a card to start your streak'}
            icon={<IconFlame />}
          />
        </section>

        {/* Recent kits */}
        <section aria-label="Recent kits">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">Recent Kits</h2>
            {!loading && kits.length > 0 && (
              <Link href="/kits" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            )}
          </div>

          {error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : loading ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </ul>
          ) : kits.length === 0 ? (
            <EmptyState
              icon={<IconStack />}
              title="No interview kits yet"
              description="Create your first preparation kit from a job description."
              action={
                <Link href="/generate" className={buttonClasses('primary', 'md')}>
                  Create Your First Kit
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((kit, i) => (
                <KitCard key={kit.id} kit={kit} index={i} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function IconStack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function IconFlame() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-3-2 1-4 3.5-4 7a7 7 0 0 0 14 0c0-6-7-12-7-12Z" />
    </svg>
  );
}
