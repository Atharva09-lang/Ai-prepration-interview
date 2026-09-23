/**
 * services/regenerate.service.js
 *
 * Regenerates a single section of an existing kit without touching:
 *  - Items the user wrote by hand  (origin === 'user')
 *  - Items the user explicitly pinned  (pinned === true)
 *  - Items soft-deleted by the user  (deleted === true → tombstones)
 *
 * Supported sections:
 *  'brief'      — regenerates company_brief only
 *  'technical'  | 'behavioural' | 'system-design' | 'company-fit'
 *               — regenerates questions of that category
 *  'flashcards' — regenerates all flashcards
 *  'schedule'   — rebuilds the schedule from current questions
 */

import { Kit } from '../models/Kit.js';
import { AppError } from '../utils/AppError.js';
import { assertObjectId } from '../utils/objectId.js';
import { generateBrief } from '../pipeline/generation/brief.js';
import { generateCategoryQuestions } from '../pipeline/generation/questions.js';
import { generateFlashcards } from '../pipeline/generation/flashcards.js';
import { buildSchedule } from '../pipeline/schedule.js';
import { runResearch } from '../pipeline/research/index.js';
import { findUncoveredRequirements } from '../pipeline/coverage.js';

const QUESTION_CATEGORIES = ['technical', 'behavioural', 'system-design', 'company-fit'];

/**
 * Regenerates one section of a kit.
 *
 * @param {string} userId
 * @param {string} kitId
 * @param {string} section  'brief' | category name | 'flashcards' | 'schedule'
 * @returns {Promise<object>}  Updated kit as plain object
 */
export async function regenerateSection(userId, kitId, section) {
  assertObjectId(kitId, 'Kit');
  const kit = await Kit.findOne({ _id: kitId, userId });
  if (!kit) throw new AppError('NOT_FOUND', 'Kit not found', 404);
  if (kit.status !== 'ready') {
    throw new AppError('KIT_NOT_READY', 'Kit must be in ready state to regenerate a section', 409);
  }

  const { requirements } = kit.role;

  if (section === 'brief') {
    return regenerateBrief(kit, userId);
  }

  if (QUESTION_CATEGORIES.includes(section)) {
    return regenerateQuestionCategory(kit, section);
  }

  if (section === 'flashcards') {
    return regenerateFlashcardsSection(kit);
  }

  if (section === 'schedule') {
    return regenerateScheduleSection(kit);
  }

  throw new AppError('INVALID_SECTION', `Unknown section: ${section}`, 400);
}

// ─── Brief ───────────────────────────────────────────────────────────────────

async function regenerateBrief(kit) {
  if (kit.company_brief?.pinned) {
    throw new AppError('SECTION_PINNED', 'Company brief is pinned and cannot be regenerated', 409);
  }

  // Re-run research to get fresh context (or use cached pages_used)
  let research;
  try {
    research = await runResearch(kit.input.company_url);
  } catch {
    research = { companyName: kit.source.company, pages: [], pagesUsed: [], pagesFailed: [], hiringPageFound: false, hiringProcess: null, discussionFound: false, discussionSources: [], discussionSnippets: [] };
  }

  const brief = await generateBrief(research, { title: kit.role.title, seniority: kit.role.seniority });

  await Kit.updateOne(
    { _id: kit._id },
    { $set: { company_brief: { ...brief, origin: 'generated', pinned: false } } },
  );

  return (await Kit.findById(kit._id)).toJSON();
}

// ─── Questions (one category) ─────────────────────────────────────────────────

async function regenerateQuestionCategory(kit, category) {
  const { requirements } = kit.role;

  // Keep items the user touched: hand-authored, edited, or pinned — plus
  // tombstones so a deleted question can never be resurrected. Only the
  // AI-generated, untouched questions of THIS category are replaced.
  const survivingQuestions = kit.questions.filter(
    (q) => q.category !== category || q.pinned || q.origin === 'user' || q.origin === 'edited' || q.deleted,
  );

  // Start new IDs after the highest existing ID
  const maxId = kit.questions.reduce((max, q) => Math.max(max, Number(q.id.slice(1)) || 0), 0);
  const nextId = maxId + 1;

  const research = buildResearchContext(kit);
  // Single-category call — regenerating 'technical' must not also append
  // system-design / company-fit questions.
  const newQuestions = await generateCategoryQuestions(requirements, kit.role, research, category, nextId);

  const merged = [
    ...survivingQuestions.filter((q) => !q.deleted),
    ...newQuestions.map((q, i) => ({ ...q, origin: 'generated', pinned: false, deleted: false, order: survivingQuestions.length + i })),
  ];

  // Rebuild schedule to reflect new question set
  const activeQuestions = merged.filter((q) => !q.deleted);
  const schedule = buildSchedule(activeQuestions, requirements, kit.input.days);

  // Recompute coverage
  const uncovered = findUncoveredRequirements(requirements, activeQuestions);
  const coverage = { uncovered_requirement_ids: uncovered, passes: (kit.coverage?.passes ?? 1) };

  await Kit.updateOne(
    { _id: kit._id },
    { $set: { questions: merged, schedule, coverage } },
  );

  return (await Kit.findById(kit._id)).toJSON();
}

// ─── Flashcards ───────────────────────────────────────────────────────────────

async function regenerateFlashcardsSection(kit) {
  const { requirements } = kit.role;

  // Keep pinned, user-authored, and hand-edited flashcards (plus tombstones)
  const surviving = kit.flashcards.filter((f) => f.pinned || f.origin === 'user' || f.origin === 'edited' || f.deleted);
  const maxId = kit.flashcards.reduce((max, f) => Math.max(max, Number(f.id.slice(1)) || 0), 0);

  const activeQuestions = kit.questions.filter((q) => !q.deleted);
  const newFlashcards = await generateFlashcards(requirements, activeQuestions, maxId + 1);

  const merged = [
    ...surviving.filter((f) => !f.deleted),
    ...newFlashcards.map((f, i) => ({ ...f, origin: 'generated', pinned: false, deleted: false, order: surviving.length + i })),
  ];

  await Kit.updateOne({ _id: kit._id }, { $set: { flashcards: merged } });
  return (await Kit.findById(kit._id)).toJSON();
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

async function regenerateScheduleSection(kit) {
  const { requirements } = kit.role;
  const activeQuestions = kit.questions.filter((q) => !q.deleted);
  const schedule = buildSchedule(activeQuestions, requirements, kit.input.days);

  await Kit.updateOne({ _id: kit._id }, { $set: { schedule } });
  return (await Kit.findById(kit._id)).toJSON();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildResearchContext(kit) {
  return {
    companyName: kit.source?.company ?? '',
    hiringProcess: kit.research?.hiring_process ?? null,
    discussionSnippets: [],
    discussionFound: kit.research?.discussion_found ?? false,
    discussionSources: kit.research?.discussion_sources ?? [],
    pages: [],
  };
}
