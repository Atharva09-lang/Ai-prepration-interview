'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { KitCard } from '@/components/KitCard';
import { Input } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { SkeletonCard } from '@/components/LoadingState';
import { Button, buttonClasses } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { useKits } from '@/hooks/useKits';
import { api } from '@/lib/api';
import { cn, hostnameOf } from '@/lib/utils';

const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'generating', label: 'Generating', match: (k) => k.status === 'generating' },
  { key: 'completed', label: 'Completed', match: (k) => k.status === 'ready' },
  { key: 'failed', label: 'Failed', match: (k) => k.status === 'failed' },
];

export default function KitsPage() {
  const { kits, loading, error, refetch } = useKits();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  


    async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteKit(pendingDelete.id);
      setPendingDelete(null);
      await refetch();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the kit.');
    } finally {
      setDeleting(false);
    }
  }


  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
    const q = query.trim().toLowerCase();
    return kits.filter((k) => {
      if (!active.match(k)) return false;
      if (!q) return true;
      const company = (k.company || hostnameOf(k.company_url)).toLowerCase();
      const role = (k.title || '').toLowerCase();
      return company.includes(q) || role.includes(q);
    });
  }, [kits, filter, query]);

  const counts = useMemo(() => {
    const c = { all: kits.length, generating: 0, completed: 0, failed: 0 };
    for (const k of kits) {
      if (k.status === 'generating') c.generating += 1;
      else if (k.status === 'ready') c.completed += 1;
      else if (k.status === 'failed') c.failed += 1;
    }
    return c;
  }, [kits]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">My Kits</h1>
            <p className="mt-1 text-sm text-muted">
              All your generated interview preparation kits.
            </p>
          </div>
          <Link href="/generate" className={buttonClasses('primary', 'md')}>
            Create New Kit
          </Link>
        </header>

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter kits by status">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-200',
                  filter === f.key
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-card text-muted hover:bg-surface hover:text-ink',
                )}
              >
                {f.label}
                <span className={cn('ml-1.5 text-xs', filter === f.key ? 'text-white/70' : 'text-muted/70')}>
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>

          <div className="sm:w-72">
            <Input
              type="search"
              aria-label="Search kits by company or role"
              placeholder="Search company or role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Grid */}
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
            title="No interview kits yet"
            description="Create your first preparation kit from a job description."
            action={
              <Link href="/generate" className={buttonClasses('primary', 'md')}>
                Create Your First Kit
              </Link>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            title="No kits match"
            description="Try a different filter or clear your search."
            action={
              <button
                type="button"
                className={buttonClasses('secondary', 'md')}
                onClick={() => {
                  setFilter('all');
                  setQuery('');
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((kit, i) => (
               <KitCard
                key={kit.id}
                kit={kit}
                index={i}
                onDelete={setPendingDelete}
                deleting={deleting && pendingDelete?.id === kit.id}
              />
            ))}
          </ul>
        )}
      </div>


            <Modal
        open={Boolean(pendingDelete)}
        onClose={() => !deleting && setPendingDelete(null)}
        title="Delete this kit?"
        description={
          pendingDelete
            ? `“${pendingDelete.title || 'Untitled role'}” at ${pendingDelete.company || hostnameOf(pendingDelete.company_url)} will be permanently removed. This cannot be undone.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)} disabled={deleting} type="button">
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} loading={deleting} type="button">
              Delete kit
            </Button>
          </>
        }
      >
        {deleteError && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
            {deleteError}
          </div>
        )}
      </Modal>

    </AppShell>
  );
}
