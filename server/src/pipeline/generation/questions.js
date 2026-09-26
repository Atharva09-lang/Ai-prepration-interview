/**
 * generation/questions.js — generates interview questions, one LLM call per category.
 *
 * This deliberate sequencing means:
 * - Technical requirements → technical questions (not mixed with behavioural)
 * - Each prompt can give category-specific guidance
 * - A company that describes a system-design round gets those questions
 *   only if relevant requirements exist
 */

import { generateStructured } from '../../llm/client.js';
import { buildCategoryQuestionsPrompt } from '../../llm/prompts/question.js';
import { filterValidRequirementIds } from '../coverage.js';

const CATEGORIES = ['technical', 'behavioural', 'system-design', 'company-fit'];

const validDifficulty = (d) => (Number.isInteger(d) && d >= 1 && d <= 3 ? d : 2);

/**
 * Category generation is best-effort — a failed call must not abort the run.
 * But a swallowed failure produces a kit with a silently empty section, which
 * looks identical to "this category had nothing to say". Recording it in the
 * kit's `warnings` keeps the failure visible to the user.
 *
 * @param {string[]|null} warnings  Kit warnings array, when the caller has one
 * @param {string} message
 */
function pushWarning(warnings, message) {
  if (Array.isArray(warnings)) warnings.push(message);
}

/**
 * Turns raw LLM output into schema-safe question objects.
 *
 * The model is untrusted: it can emit requirement ids that do not exist, an
 * empty id list, or a blank prompt/answer_outline. Any of those would make the
 * finished kit fail structural validation (INVALID_KIT) and be marked failed.
 * Instead we repair what we can and drop what we cannot:
 *  - requirement_ids are filtered to ids that actually exist (de-duplicated)
 *  - if none remain, fall back to `fallbackRequirementId` when given, else drop
 *  - items with an empty prompt or answer_outline are dropped
 *  - ids are reassigned sequentially from `startId` so they stay contiguous
 *  - category is forced to the one we asked for (never trust the model's)
 *
 * Exported for unit testing.
 *
 * @param {object[]} rawList             Raw `questions` array from the model
 * @param {object[]} validRequirements   Requirements whose ids are acceptable
 * @param {string}   category            Forced category for every question
 * @param {number}   startId             First numeric id suffix to use
 * @param {string|null} fallbackRequirementId  Id to use when the model gave none
 * @returns {object[]}
 */
export function normalizeQuestions(rawList, validRequirements, category, startId, fallbackRequirementId = null) {
  const validIds = new Set(validRequirements.map((r) => r.id));
  const out = [];
  let n = startId;

  for (const q of Array.isArray(rawList) ? rawList : []) {
    const prompt = typeof q?.prompt === 'string' ? q.prompt.trim() : '';
    const answer_outline = typeof q?.answer_outline === 'string' ? q.answer_outline.trim() : '';
    if (!prompt || !answer_outline) continue; // incomplete — drop rather than ship an invalid kit

    let ids = filterValidRequirementIds(q?.requirement_ids, validIds);
    if (!ids.length && fallbackRequirementId && validIds.has(fallbackRequirementId)) {
      ids = [fallbackRequirementId];
    }
    if (!ids.length) continue; // no valid requirement link — drop

    out.push({
      id: `q${n++}`,
      requirement_ids: ids,
      category,
      prompt,
      answer_outline,
      difficulty: validDifficulty(q?.difficulty),
    });
  }

  return out;
}

// Domains whose interviews have no system-design round. Unknown domains
// ('' from old kits, 'other' from unclear JDs) keep the previous behaviour
// and do generate it.
const NON_SOFTWARE_DOMAINS = new Set(['marketing', 'finance', 'hr', 'sales', 'data-analyst']);

/**
 * Maps requirement kinds to the categories that should cover them.
 * A requirement may be covered by more than one category.
 * System-design only applies to software-ish domains — a marketing JD should
 * not get architecture questions.
 */
function categoriesToGenerate(requirements, domain) {
  const kinds = new Set(requirements.map((r) => r.kind));
  const cats = new Set();

  if (kinds.has('technical')) {
    cats.add('technical');
    if (!NON_SOFTWARE_DOMAINS.has(domain)) cats.add('system-design');
  }
  if (kinds.has('behavioural') || kinds.has('domain')) {
    cats.add('behavioural');
  }
  // Always include company-fit
  cats.add('company-fit');

  return [...cats].filter((c) => CATEGORIES.includes(c));
}

/**
 * Returns requirements relevant to a given category.
 * company-fit always gets all requirements for context.
 */
/**
 * Requirements relevant to a given category. company-fit always gets the
 * full list; the other categories prefer their own kinds but fall back to
 * the full list when the JD has none of that kind — the UI renders every
 * section with a regenerate button, so a category must never be a dead end.
 */
function requirementsForCategory(requirements, category) {
  const pick = (predicate) => {
    const own = requirements.filter(predicate);
    return own.length ? own : requirements;
  };
  if (category === 'technical' || category === 'system-design') return pick((r) => r.kind === 'technical');
  if (category === 'behavioural') return pick((r) => r.kind === 'behavioural' || r.kind === 'domain');
  return requirements;
}

/**
 * Picks the requirement a category falls back to when the model gives no
 * usable requirement links — or no questions at all. company-fit prefers a
 * behavioural/domain requirement (culture and motivation live there);
 * technical and system-design prefer a technical one.
 */
function anchorRequirement(requirements, category) {
  if (category === 'technical' || category === 'system-design') {
    return requirements.find((r) => r.kind === 'technical') ?? requirements[0] ?? null;
  }
  if (category === 'behavioural') {
    return requirements.find((r) => r.kind === 'behavioural' || r.kind === 'domain') ?? requirements[0] ?? null;
  }
  if (category === 'company-fit') {
    return requirements.find((r) => r.kind === 'behavioural' || r.kind === 'domain') ?? requirements[0] ?? null;
  }
  return requirements[0] ?? null;
}

/**
 * Builds the requirement-linked question used when the model failed twice.
 * Templates are intentionally plain: they only run after a real failure, and
 * a generic-but-linked question beats an empty section in a finished kit.
 */
function buildFallbackQuestion(category, requirement, role, research, startId) {
  const text = (requirement.text ?? '').trim().replace(/[.;]+$/, '');
  const companyName = research?.companyName || role?.title || 'this company';

  const templates = {
    technical: {
      prompt: `Walk me through your hands-on experience with: ${text}. What have you built with it, and what problems did you run into?`,
      answer_outline: 'Concrete projects and tools used; depth of ownership; problems solved and lessons learned; how the skill was applied in practice.',
      difficulty: 2,
    },
    behavioural: {
      prompt: `Tell me about a time you demonstrated: ${text}. Describe the situation, what you did, and the outcome.`,
      answer_outline: 'Use a STAR structure: set the situation and task, describe your specific actions, and quantify the result or lesson learned.',
      difficulty: 1,
    },
    'system-design': {
      prompt: `Design a system that would put this requirement to use: ${text}. Cover the architecture, how it scales, and the trade-offs you would weigh.`,
      answer_outline: 'Clarify requirements and constraints; sketch the components and data flow; discuss scaling and failure modes; justify the key design decisions.',
      difficulty: 2,
    },
    'company-fit': {
      prompt: `What motivates you to join ${companyName}, and how does this role align with your career goals?`,
      answer_outline: 'Discuss specific aspects of the company mission or culture that resonate; connect to personal career trajectory and what you hope to learn or contribute.',
      difficulty: 1,
    },
  };

  const template = templates[category];
  if (!template) return null;

  return {
    id: `q${startId}`,
    requirement_ids: [requirement.id],
    category,
    prompt: template.prompt,
    answer_outline: template.answer_outline,
    difficulty: template.difficulty,
  };
}

/**
 * Generates questions for a single category in one LLM call.
 *
 * Exported separately from `generateQuestions` so callers that only want one
 * category (e.g. single-section regeneration) do not accidentally pull in the
 * other categories that `generateQuestions` derives from the requirement kinds.
 *
 * @param {object[]} requirements   Full requirement set — used to validate ids
 * @param {object}   role           { title, seniority, responsibilities }
 * @param {object}   research       Research result with hiringProcess + discussionSnippets
 * @param {string}   category       One of CATEGORIES
 * @param {number}   [startId=1]    Starting numeric suffix for question IDs
 * @param {string[]} [warnings]     Kit warnings array — failed/empty categories are recorded here
 * @returns {Promise<object[]>}     Questions for this category only
 */
export async function generateCategoryQuestions(
  requirements,
  role,
  research,
  category,
  startId = 1,
  warnings = null,
) {
  const reqs = requirementsForCategory(requirements, category);
  if (!reqs.length && category !== 'company-fit') return [];

  // When the model returns questions with invented or empty requirement_ids,
  // normalizeQuestions drops them. For the categories where the link is weaker
  // (company-fit, system-design), let it repair them onto an anchor
  // requirement; the same anchor lets us synthesize a question if both
  // attempts come back empty.
  const anchor = anchorRequirement(requirements, category);
  const fallbackId =
    category === 'company-fit' || category === 'system-design' ? (anchor?.id ?? null) : null;

  const promptFor = (correction) =>
    buildCategoryQuestionsPrompt({
      category,
      requirements: reqs,
      role,
      research,
      idPrefix: `q${startId}`,
      correction,
    });

  try {
    let result = await generateStructured({ type: 'questions', prompt: promptFor(false), useMock: false });
    let questions = normalizeQuestions(result?.questions ?? [], requirements, category, startId, fallbackId);

    // The model occasionally answers with an empty list, invented requirement
    // ids, or blank prompts. Previously one such answer emptied the whole
    // section. Retry once with the allowed ids spelled out before giving up.
    if (!questions.length) {
      console.warn(`[questions] ${category} returned nothing usable — retrying with a corrective prompt`);
      result = await generateStructured({ type: 'questions', prompt: promptFor(true), useMock: false });
      questions = normalizeQuestions(result?.questions ?? [], requirements, category, startId, fallbackId);
    }

    if (!questions.length) {
      // Last resort: both attempts returned nothing usable (empty array, blank
      // fields, or ids that could not be repaired). Ship one requirement-linked
      // question rather than an empty section — a warning still fires when
      // there is no requirement to anchor to.
      const synthetic = anchor ? buildFallbackQuestion(category, anchor, role, research, startId) : null;
      if (synthetic) {
        questions = [synthetic];
      } else {
        pushWarning(warnings, `questions_empty: no usable ${category} questions were generated (retried once)`);
      }
    }
    return questions;
  } catch (err) {
    // Skip a failed category rather than aborting the whole pipeline — but say so
    console.warn(`[questions] failed to generate ${category} questions:`, err.message);
    pushWarning(warnings, `questions_failed: ${category} questions could not be generated (${err.message})`);
    return [];
  }
}

/**
 * Generates questions for all relevant categories.
 * Each category is a separate LLM call.
 *
 * @param {object[]} requirements   Array of requirement objects with id, text, kind, priority
 * @param {object}   role           { title, seniority, responsibilities }
 * @param {object}   research       Research result with hiringProcess + discussionSnippets
 * @param {number}   [startId=1]    Starting numeric suffix for question IDs
 * @param {string[]} [warnings]     Kit warnings array, forwarded to each category call
 * @returns {Promise<object[]>}     Flat array of question objects
 */
export async function generateQuestions(requirements, role, research, startId = 1, warnings = null) {
  if (!requirements.length) return [];

  const categories = categoriesToGenerate(requirements, role?.domain);
  const allQuestions = [];
  let nextId = startId;

  for (const category of categories) {
    const questions = await generateCategoryQuestions(
      requirements,
      role,
      research,
      category,
      nextId,
      warnings,
    );
    nextId += questions.length;
    allQuestions.push(...questions);
  }

  return allQuestions;
}

/**
 * Generates gap-filling questions for specific uncovered requirements.
 * Used in the second-pass coverage loop.
 *
 * @param {object[]} gapRequirements  Requirements with no questions yet
 * @param {object}   role
 * @param {object}   research
 * @param {number}   startId          Next available question ID number
 * @param {string[]} [warnings]       Kit warnings array — a failed pass is recorded here
 * @returns {Promise<object[]>}
 */
export async function generateGapQuestions(gapRequirements, role, research, startId, warnings = null) {
  if (!gapRequirements.length) return [];

  // Group by kind to maintain per-category calling discipline
  const byKind = {};
  for (const r of gapRequirements) {
    const category = r.kind === 'behavioural' || r.kind === 'domain' ? 'behavioural' : 'technical';
    (byKind[category] ??= []).push(r);
  }

  const allQuestions = [];
  let nextId = startId;

  for (const [category, reqs] of Object.entries(byKind)) {
    const prompt = buildCategoryQuestionsPrompt({
      category,
      requirements: reqs,
      role,
      research,
      idPrefix: `q${nextId}`,
    });

    try {
      const result = await generateStructured({ type: 'questions', prompt, useMock: false });
      const questions = normalizeQuestions(
        result.questions ?? [],
        gapRequirements,
        category,
        nextId,
        reqs[0].id,
      );
      nextId += questions.length;
      allQuestions.push(...questions);
    } catch (err) {
      console.warn(`[gap-questions] failed for category ${category}:`, err.message);
      pushWarning(
        warnings,
        `gap_questions_failed: could not fill ${reqs.length} uncovered must-have requirement(s) (${err.message})`,
      );
    }
  }

  return allQuestions;
}