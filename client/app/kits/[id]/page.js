'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Reorder } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { Sidebar } from '@/components/Sidebar';
import { Card } from '@/components/Card';
import { Section } from '@/components/Section';
import { Button, buttonClasses } from '@/components/Button';
import { Badge, StatusBadge } from '@/components/StatusBadge';
import { EditableText } from '@/components/EditableText';
import { QuestionCard } from '@/components/QuestionCard';
import { Modal } from '@/components/Modal';
import { Input } from '@/components/Input';
import { Textarea } from '@/components/Textarea';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { ProgressTimeline } from '@/components/ProgressTimeline';
import { useKit } from '@/hooks/useKit';
import { useJobPolling, deriveStageStates, deriveStageDetails } from '@/hooks/useJobPolling';
import { api } from '@/lib/api';
import { CATEGORY_LABEL, hostnameOf, relativeTime } from '@/lib/utils';

const CATEGORY_ORDER = ['technical', 'behavioural', 'system-design', 'company-fit'];

const SECTIONS = [
  { href: '#brief', label: 'Company Brief' },
  { href: '#role', label: 'Role Breakdown' },
  { href: '#technical', label: 'Technical' },
  { href: '#behavioural', label: 'Behavioural' },
  { href: '#system-design', label: 'System Design' },
  { href: '#company-fit', label: 'Company Fit' },
  { href: '#flashcards', label: 'Flashcards' },
  { href: '#schedule', label: 'Study Schedule' },
];

function SavedNote() {
  return (
    <span className="mt-1 inline-block px-2.5 text-xs font-medium text-success" role="status">
      Saved
    </span>
  );
}

export default function KitDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { kit, job, loading, error, refetch, setKit } = useKit(id);

  const [editMode, setEditMode] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [busySection, setBusySection] = useState(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [addState, setAddState] = useState(null); 
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  
  const generating = kit?.status === 'generating';
  const jobId = generating ? job?.id ?? null : null;
  const { job: liveJob } = useJobPolling(jobId, {
    onTerminal: () => refetch(),
  });
  const timelineJob = liveJob ?? job;

  const flashSaved = useCallback((key) => {
    setSavedId(key);
    setTimeout(() => setSavedId((cur) => (cur === key ? null : cur)), 1500);
  }, []);

 
  const patchBrief = useCallback(
    async (field, value) => {
      const res = await api.patchKit(id, { company_brief: { [field]: value } });
      setKit(res.kit);
      flashSaved(`brief-${field}`);
    },
    [id, setKit, flashSaved],
  );

  const patchRole = useCallback(
    async (field, value) => {
      const res = await api.patchKit(id, { role: { [field]: value } });
      setKit(res.kit);
      flashSaved(`role-${field}`);
    },
    [id, setKit, flashSaved],
  );

  const saveResponsibilities = useCallback(
    async (next) => {
      const res = await api.patchKit(id, { role: { responsibilities: next } });
      setKit(res.kit);
      flashSaved('role-responsibilities');
    },
    [id, setKit, flashSaved],
  );

  const editQuestion = useCallback(
    async (qid, patch) => {
      const res = await api.updateQuestion(id, qid, patch);
      setKit(res.kit);
      flashSaved(qid);
    },
    [id, setKit, flashSaved],
  );

  const deleteQuestion = useCallback(
    async (qid) => {
      await api.deleteQuestion(id, qid);
      await refetch();
    },
    [id, refetch],
  );

  const editFlashcard = useCallback(
    async (fid, patch) => {
      const res = await api.updateFlashcard(id, fid, patch);
      setKit(res.kit);
      flashSaved(fid);
    },
    [id, setKit, flashSaved],
  );

  const deleteFlashcard = useCallback(
    async (fid) => {
      await api.deleteFlashcard(id, fid);
      await refetch();
    },
    [id, refetch],
  );

  const regenerate = useCallback(
    async (section) => {
      setRegenOpen(false);
      setActionError(null);
      setBusySection(section);
      try {
        const res = await api.regenerate(id, section);
        setKit(res.kit);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Regeneration failed.');
      } finally {
        setBusySection(null);
      }
    },
    [id, setKit],
  );

    const confirmDeleteKit = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteKit(id);
      router.push('/kits');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete the kit.');
      setDeleting(false);
    }
  }, [id, router]);


  const reorderQuestions = useCallback(
    async (category, orderedIds) => {
      const active = kit.questions.filter((q) => !q.deleted);
      const sorted = [...active].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const slots = sorted.filter((q) => q.category === category);
      const slotOrders = slots.map((q, i) => q.order ?? i);
      const byId = Object.fromEntries(active.map((q) => [q.id, q]));

      const updates = orderedIds
        .map((qid, i) => ({ qid, order: slotOrders[i] }))
        .filter(({ qid, order }) => (byId[qid]?.order ?? 0) !== order);

      setKit({
        ...kit,
        questions: kit.questions.map((q) => {
          const idx = q.category === category ? orderedIds.indexOf(q.id) : -1;
          return idx >= 0 ? { ...q, order: slotOrders[idx] } : q;
        }),
      });

      await Promise.all(updates.map(({ qid, order }) => api.updateQuestion(id, qid, { order })));
      await refetch();
    },
    [kit, id, setKit, refetch],
  );

  const reorderFlashcards = useCallback(
    async (orderedIds) => {
      const active = kit.flashcards.filter((f) => !f.deleted);
      const byId = Object.fromEntries(active.map((f) => [f.id, f]));
      const updates = orderedIds
        .map((fid, i) => ({ fid, order: i }))
        .filter(({ fid, order }) => (byId[fid]?.order ?? 0) !== order);

      setKit({
        ...kit,
        flashcards: kit.flashcards.map((f) => {
          const idx = orderedIds.indexOf(f.id);
          return idx >= 0 ? { ...f, order: idx } : f;
        }),
      });

      await Promise.all(updates.map(({ fid, order }) => api.updateFlashcard(id, fid, { order })));
      await refetch();
    },
    [kit, id, setKit, refetch],
  );

  const moveQuestion = useCallback(
    (category, ids, from, to) => {
      if (to < 0 || to >= ids.length) return;
      const next = [...ids];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      reorderQuestions(category, next);
    },
    [reorderQuestions],
  );

  
  const questionsByCategory = useMemo(() => {
    const map = {};
    for (const c of CATEGORY_ORDER) map[c] = [];
    for (const q of kit?.questions ?? []) {
      if (q.deleted) continue;
      (map[q.category] ??= []).push(q);
    }
    for (const c of CATEGORY_ORDER) (map[c] ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return map;
  }, [kit]);

  const flashcards = useMemo(
    () =>
      (kit?.flashcards ?? [])
        .filter((f) => !f.deleted)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [kit],
  );

  
  if (loading) {
    return (
      <AppShell wide>
        <LoadingState label="Loading kit…" cards={3} />
      </AppShell>
    );
  }

  if (error || !kit) {
    return (
      <AppShell wide>
        <ErrorState
          title="Kit not found"
          message={error ?? 'We could not load this kit. It may have been deleted.'}
          onRetry={refetch}
        />
        <div className="mt-6 text-center">
          <Link href="/kits" className={buttonClasses('outline', 'md')}>Back to My Kits</Link>
        </div>
      </AppShell>
    );
  }

  if (generating) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <Card className="p-6 sm:p-8">
            <header className="mb-6">
              <StatusBadge status="generating" />
              <h1 className="mt-3 text-xl font-bold tracking-tight text-ink">Building your kit…</h1>
              <p className="mt-1 text-sm text-muted">
                Hang tight — the pipeline is researching and generating your material.
              </p>
            </header>
            <ProgressTimeline
              stageStates={deriveStageStates(timelineJob)}
              details={deriveStageDetails(timelineJob)}
            />
          </Card>
        </div>
      </AppShell>
    );
  }

  if (kit.status === 'failed') {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          <ErrorState
            title="Generation failed"
            message={job?.error?.message ?? 'Something went wrong while generating this kit.'}
            onRetry={() => router.push('/generate')}
            retryLabel="Create a new kit"
          />
        </div>
      </AppShell>
    );
  }

  const company = kit.source?.company || hostnameOf(kit.input?.company_url);
  const requirements = kit.role?.requirements ?? [];
  const uncoveredIds = new Set(kit.coverage?.uncovered_requirement_ids ?? []);

  return (
    <AppShell wide>
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <Sidebar
          items={SECTIONS}
          activeHref={`/kits/${id}`}
          className="mb-6 lg:mb-0"
          footer={
            <div className="space-y-2">
              <Link href={`/practice/${id}`} className={buttonClasses('primary', 'sm', 'w-full')}>
                Practice
              </Link>
              <Link href={`/schedule/${id}`} className={buttonClasses('outline', 'sm', 'w-full')}>
                Full schedule
              </Link>
            </div>
          }
        />

        <div className="min-w-0 space-y-6">
        
          <header className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={kit.status} />
                  <span className="text-xs text-muted">Updated {relativeTime(kit.updatedAt)}</span>
                </div>
                <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-ink">{company}</h1>
                <p className="mt-0.5 text-sm text-muted">
                  {kit.role?.title || 'Role'}
                  {kit.role?.seniority ? ` · ${kit.role.seniority}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={editMode ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setEditMode((v) => !v)}
                  aria-pressed={editMode}
                >
                  {editMode ? 'Done editing' : 'Edit'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
                  Regenerate
                </Button>
                <Link href={`/practice/${id}`} className={buttonClasses('accent', 'sm')}>
                  Practice
                </Link>
                <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              </div>
            </div>

            {actionError && (
              <div role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
                {actionError}
              </div>
            )}
          </header>

          <KitHealth kit={kit} requirements={requirements} onRegenerate={() => setRegenOpen(true)} />

          
          <Section
            id="brief"
            title="Company Brief"
            description="What the company does and how they hire."
            onRegenerate={() => regenerate('brief')}
            regenerating={busySection === 'brief'}
             action={
              <Button
                variant={kit.company_brief?.pinned ? 'primary' : 'outline'}
                size="sm"
                onClick={() => patchBrief('pinned', !kit.company_brief?.pinned)}
                aria-pressed={!!kit.company_brief?.pinned}
                title={kit.company_brief?.pinned ? 'Unpin — allow regeneration to replace it' : 'Pin — keep it through regeneration'}
              >
                {kit.company_brief?.pinned ? 'Pinned' : 'Pin'}
              </Button>
            }
          >
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Overview</p>
                <EditableText
                  label="Company overview"
                  multiline
                  value={kit.company_brief?.summary}
                  placeholder="No summary yet."
                  onSave={(v) => patchBrief('summary', v)}
                />
                {savedId === 'brief-summary' && <SavedNote />}
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">What they do</p>
                <EditableText
                  label="What they do"
                  multiline
                  value={kit.company_brief?.what_they_do}
                  placeholder="No details yet."
                  onSave={(v) => patchBrief('what_they_do', v)}
                />
                {savedId === 'brief-what_they_do' && <SavedNote />}
              </div>

              {kit.research?.hiring_process?.found && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Hiring process</p>
                  <p className="px-2.5 text-sm text-ink">{kit.research.hiring_process.summary}</p>
                  {kit.research.hiring_process.stages?.length > 0 && (
                    <ol className="mt-2 flex flex-wrap gap-1.5 px-2.5">
                      {kit.research.hiring_process.stages.map((s, i) => (
                        <li key={i}><Badge tone="outline">{i + 1}. {s}</Badge></li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {kit.company_brief?.sources?.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Sources</p>
                  <ul className="flex flex-wrap gap-1.5 px-2.5">
                    {kit.company_brief.sources.map((s, i) => (
                      <li key={`${s}-${i}`}>
                        <a
                          href={s}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs text-muted hover:text-primary"
                        >
                          <span className="truncate">{hostnameOf(s)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Section>

          <Section id="role" title="Role Breakdown" description="Responsibilities and requirements for this role.">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Title</p>
                <EditableText label="Role title" value={kit.role?.title} onSave={(v) => patchRole('title', v)} />
                {savedId === 'role-title' && <SavedNote />}

                <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted">Seniority</p>
                <EditableText label="Seniority" value={kit.role?.seniority} onSave={(v) => patchRole('seniority', v)} />
                {savedId === 'role-seniority' && <SavedNote />}

                <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted">Responsibilities</p>
                <EditableList
                  items={kit.role?.responsibilities ?? []}
                  editMode={editMode}
                  onChange={saveResponsibilities}
                  emptyLabel="No responsibilities listed."
                />
                {savedId === 'role-responsibilities' && <SavedNote />}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Requirements</p>
                <ul className="space-y-2">
                  {requirements.map((r) => (
                    <li key={r.id} className="flex items-start gap-2 rounded-md border border-border bg-background p-2.5">
                      <span
                        className={r.priority === 'must' ? 'mt-1 h-2 w-2 shrink-0 rounded-full bg-accent' : 'mt-1 h-2 w-2 shrink-0 rounded-full bg-border'}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-ink">{r.text}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {r.kind} · {r.priority === 'must' ? 'Must have' : 'Nice to have'}
                        </p>
                        {uncoveredIds.has(r.id) && (
                          <Badge tone={r.priority === 'must' ? 'danger' : 'outline'} className="mt-1.5">
                            No question yet
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                  {requirements.length === 0 && <li className="text-sm text-muted">No requirements extracted.</li>}
                </ul>
              </div>
            </div>
          </Section>

          
          {CATEGORY_ORDER.map((category) => (
            <QuestionSection
              key={category}
              id={category}
              category={category}
              questions={questionsByCategory[category] ?? []}
              requirements={requirements}
              editMode={editMode}
              savedId={savedId}
              busy={busySection === category}
              onRegenerate={() => regenerate(category)}
              onEdit={editQuestion}
              onDelete={deleteQuestion}
              onMove={(ids, from, to) => moveQuestion(category, ids, from, to)}
              onReorder={(ids) => reorderQuestions(category, ids)}
              onAdd={() => setAddState({ type: 'question', category })}
            />
          ))}

          
          <Section
            id="flashcards"
            title="Flashcards"
            description="Quick-review cards for your practice sessions."
            onRegenerate={() => regenerate('flashcards')}
            regenerating={busySection === 'flashcards'}
            action={<Link href={`/practice/${id}`} className={buttonClasses('outline', 'sm')}>Practice</Link>}
          >
            {editMode && (
              <Button size="sm" variant="secondary" className="mb-4" onClick={() => setAddState({ type: 'flashcard' })}>
                Add flashcard
              </Button>
            )}
            {flashcards.length === 0 ? (
              <EmptyState title="No flashcards yet" description="Regenerate this section or add your own." />
            ) : (
              <Reorder.Group
                axis="y"
                values={flashcards}
                onReorder={(next) => reorderFlashcards(next.map((f) => f.id))}
                className="grid list-none gap-3 sm:grid-cols-2"
                as="ul"
              >
                {flashcards.map((f) => (
                  <Reorder.Item
                    key={f.id}
                    value={f}
                    as="li"
                    className="cursor-grab active:cursor-grabbing"
                    whileDrag={{ scale: 1.02 }}
                  >
                    <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
                      <div className="flex items-start justify-between gap-2">
                         <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
                          Front
                          {f.pinned && <Badge tone="outline">Pinned</Badge>}
                        </p>
                        {editMode && (
                           <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => editFlashcard(f.id, { pinned: !f.pinned })}
                              aria-pressed={!!f.pinned}
                              aria-label={f.pinned ? 'Unpin flashcard' : 'Pin flashcard'}
                              title={f.pinned ? 'Unpin — allow regeneration to replace it' : 'Pin — keep it through regeneration'}
                              className={`rounded-md p-1 transition-colors hover:bg-surface ${f.pinned ? 'text-primary' : 'text-muted hover:text-ink'}`}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill={f.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
                              </svg>
                            </button>
                          <button
                              type="button"
                              onClick={() => deleteFlashcard(f.id)}
                              aria-label="Delete flashcard"
                              className="rounded-md p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      <EditableText label="Flashcard front" multiline value={f.front} onSave={(v) => editFlashcard(f.id, { front: v })} />
                      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted">Back</p>
                      <EditableText label="Flashcard back" multiline value={f.back} onSave={(v) => editFlashcard(f.id, { back: v })} />
                      {savedId === f.id && <SavedNote />}
                    </div>
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            )}
          </Section>

          {/* Study Schedule */}
          <Section
            id="schedule"
            title="Study Schedule"
            description={`${kit.schedule?.days_available ?? kit.input?.days ?? 0} day plan.`}
            onRegenerate={() => regenerate('schedule')}
            regenerating={busySection === 'schedule'}
            action={<Link href={`/schedule/${id}`} className={buttonClasses('outline', 'sm')}>Open schedule</Link>}
          >
            <ol className="space-y-2">
              {(kit.schedule?.days ?? []).slice(0, 5).map((d) => (
                <li key={d.day} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">Day {d.day}</p>
                    <p className="truncate text-xs text-muted">{d.focus}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {d.question_ids?.length ?? 0} q · {d.minutes} min
                  </span>
                </li>
              ))}
            </ol>
            {(kit.schedule?.days?.length ?? 0) > 5 && (
              <Link href={`/schedule/${id}`} className="mt-3 inline-block px-2.5 text-sm font-medium text-primary hover:underline">
                View all {kit.schedule.days.length} days →
              </Link>
            )}
          </Section>
        </div>
      </div>

      <RegenerateModal open={regenOpen} onClose={() => setRegenOpen(false)} onPick={regenerate} />

      <AddItemModal
        state={addState}
        onClose={() => setAddState(null)}
        onError={setActionError}
        onDone={async () => {
          setAddState(null);
          await refetch();
        }}
        addQuestion={(payload) => api.addQuestion(id, payload)}
        addFlashcard={(payload) => api.addFlashcard(id, payload)}
      />
      
      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Delete this kit?"
        description={`“${company}” and everything in it will be permanently removed. This cannot be undone.`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting} type="button">
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDeleteKit} loading={deleting} type="button">
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

/**
 * Honest reporting of what the pipeline could and could not produce:
 * uncovered must-haves, empty/failed sections, and unretrievable sources.
 * A kit that hides its gaps looks identical to a complete one — so it doesn't.
 */
function KitHealth({ kit, requirements, onRegenerate }) {
  const uncoveredIds = kit.coverage?.uncovered_requirement_ids ?? [];
  const mustUncovered = requirements.filter(
    (r) => r.priority === 'must' && uncoveredIds.includes(r.id),
  );
  const warnings = kit.warnings ?? [];
  const failedSources = kit.research?.pages_failed ?? [];

  if (!mustUncovered.length && !warnings.length && !failedSources.length) return null;

  return (
    <div className="space-y-3">
      {mustUncovered.length > 0 && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <p className="font-semibold">
            {mustUncovered.length} must-have requirement{mustUncovered.length === 1 ? '' : 's'} still
            {mustUncovered.length === 1 ? ' has' : ' have'} no question
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {mustUncovered.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
          <p className="mt-2">
            Add a question by hand, or regenerate the question category these belong to.
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onRegenerate}>
            Regenerate a section
          </Button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          <p className="font-semibold">
            Partial results — {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((w, i) => (
              <li key={`${i}-${w.slice(0, 24)}`} className="break-words">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {failedSources.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          <p className="font-semibold text-ink">
            {failedSources.length} source{failedSources.length === 1 ? '' : 's'} could not be retrieved
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {failedSources.slice(0, 8).map((p, i) => (
              <li key={`${i}-${p.url ?? ''}`} title={p.reason ?? ''}>
                <Badge tone="outline">{hostnameOf(p.url) || p.url}</Badge>
              </li>
            ))}
            {failedSources.length > 8 && (
              <li className="self-center text-xs">+{failedSources.length - 8} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuestionSection({
  id,
  category,
  questions,
  requirements,
  editMode,
  savedId,
  busy,
  onRegenerate,
  onEdit,
  onDelete,
  onMove,
  onReorder,
  onAdd,
}) {
  const ids = questions.map((q) => q.id);
  return (
    <Section
      id={id}
      title={`${CATEGORY_LABEL[category] ?? category} Questions`}
      description={`${questions.length} question${questions.length === 1 ? '' : 's'}`}
      onRegenerate={onRegenerate}
      regenerating={busy}
      regenerateLabel="Regenerate questions"
      action={
        editMode ? (
          <Button size="sm" variant="secondary" onClick={onAdd}>Add question</Button>
        ) : undefined
      }
    >
      {questions.length === 0 ? (
        <EmptyState
          title={`No ${CATEGORY_LABEL[category]?.toLowerCase() ?? ''} questions yet`}
          description="Regenerate this section or add your own question."
        />
      ) : (
        <Reorder.Group
          axis="y"
          values={questions}
          onReorder={(next) => onReorder(next.map((q) => q.id))}
          className="list-none space-y-3"
          as="ul"
        >
          {questions.map((q, i) => (
            <Reorder.Item key={q.id} value={q} as="li" className="cursor-grab active:cursor-grabbing">
              <QuestionCard
                question={q}
                requirements={requirements}
                saved={savedId === q.id}
                onEdit={(patch) => onEdit(q.id, patch)}
                onDelete={() => onDelete(q.id)}
                canMoveUp={i > 0}
                canMoveDown={i < questions.length - 1}
                onMove={(dir) => onMove(ids, i, i + dir)}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}
    </Section>
  );
}

/** Editable string list with add/remove in edit mode. */
function EditableList({ items, editMode, onChange, emptyLabel }) {
  const [draft, setDraft] = useState('');

  if (!editMode) {
    return items.length ? (
      <ul className="list-disc space-y-1 pl-5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-ink">{it}</li>
        ))}
      </ul>
    ) : (
      <p className="px-2.5 text-sm text-muted italic">{emptyLabel}</p>
    );
  }

  const commit = async () => {
    const value = draft.trim();
    if (!value) return;
    setDraft('');
    await onChange([...items, value]);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 rounded-md border border-border bg-background p-2">
            <span className="min-w-0 flex-1 text-sm text-ink">{it}</span>
            <button
              type="button"
              aria-label={`Remove ${it}`}
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="rounded p-0.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Add a responsibility…"
          aria-label="Add a responsibility"
          className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button size="sm" variant="secondary" onClick={commit}>Add</Button>
      </div>
    </div>
  );
}

function RegenerateModal({ open, onClose, onPick }) {
  const options = [
    { key: 'brief', label: 'Company Brief' },
    { key: 'technical', label: 'Technical Questions' },
    { key: 'behavioural', label: 'Behavioural Questions' },
    { key: 'system-design', label: 'System Design Questions' },
    { key: 'company-fit', label: 'Company Fit Questions' },
    { key: 'flashcards', label: 'Flashcards' },
    { key: 'schedule', label: 'Study Schedule' },
  ];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Regenerate a section"
      description="Only the section you pick is rebuilt. Your edits, pinned items and anything you added by hand are kept."
    >
      <ul className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <li key={o.key}>
            <button
              type="button"
              onClick={() => onPick(o.key)}
              className="w-full rounded-md border border-border bg-card px-3.5 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:border-primary hover:bg-primary/5"
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function AddItemModal({ state, onClose, onDone, onError, addQuestion, addFlashcard }) {
  const isQuestion = state?.type === 'question';
  const [prompt, setPrompt] = useState('');
  const [outline, setOutline] = useState('');
  const [category, setCategory] = useState('technical');
  const [difficulty, setDifficulty] = useState(2);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset fields each time the modal is opened for a new item.
  useEffect(() => {
    if (!state) return;
    setPrompt('');
    setOutline('');
    setFront('');
    setBack('');
    setDifficulty(2);
    setBusy(false);
    setCategory(state.category ?? 'technical');
  }, [state]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isQuestion) {
        if (!prompt.trim()) return;
        await addQuestion({
          prompt: prompt.trim(),
          answer_outline: outline.trim(),
          category,
          difficulty: Number(difficulty),
        });
      } else {
        if (!front.trim()) return;
        await addFlashcard({ front: front.trim(), back: back.trim() });
      }
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(state)}
      onClose={onClose}
      title={isQuestion ? 'Add question' : 'Add flashcard'}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} type="button">Cancel</Button>
          <Button size="sm" type="submit" form="add-item-form" loading={busy}>
            Add
          </Button>
        </>
      }
    >
      <form id="add-item-form" onSubmit={submit} className="space-y-4" noValidate>
        {isQuestion ? (
          <>
            <Textarea
              label="Question"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Explain how the Node.js event loop handles backpressure."
              required
            />
            <Textarea
              label="Answer outline"
              rows={3}
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              placeholder="Key points to hit (optional)."
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Difficulty</span>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value={1}>Easy</option>
                  <option value={2}>Medium</option>
                  <option value={3}>Hard</option>
                </select>
              </label>
            </div>
          </>
        ) : (
          <>
            <Textarea label="Front (question)" rows={3} value={front} onChange={(e) => setFront(e.target.value)} required />
            <Textarea label="Back (answer)" rows={3} value={back} onChange={(e) => setBack(e.target.value)} />
          </>
        )}
      </form>
    </Modal>
  );
}
