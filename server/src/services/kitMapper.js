

const maxSuffix = (items) =>
  items.reduce((max, item) => Math.max(max, Number(item.id.slice(1)) || 0), 0);

export function kitToDocFields(kit) {
  const state = (i) => ({ origin: 'generated', pinned: false, deleted: false, order: i });
  return {
    source: kit.source,
    company_brief: { ...kit.company_brief, origin: 'generated', pinned: false },
    role: kit.role,
    questions: kit.questions.map((q, i) => ({ ...q, ...state(i) })),
    flashcards: kit.flashcards.map((f, i) => ({ ...f, ...state(i) })),
    schedule: kit.schedule,
    coverage: kit.coverage,
    research: kit.research,
    warnings: kit.warnings,
    counters: {
      r: maxSuffix(kit.role.requirements),
      q: maxSuffix(kit.questions),
      f: maxSuffix(kit.flashcards),
    },
  };
}