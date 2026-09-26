

import { generateStructured } from '../../llm/client.js';
import { buildCategoryQuestionsPrompt } from '../../llm/prompts/question.js';
import { filterValidRequirementIds } from '../coverage.js';

const CATEGORIES = ['technical', 'behavioural', 'system-design', 'company-fit'];

const validDifficulty = (d) => (Number.isInteger(d) && d >= 1 && d <= 3 ? d : 2);

/**
 *
 * @param {string[]|null} warnings  Kit warnings array, when the caller has one
 * @param {string} message
 */
function pushWarning(warnings, message) {
  if (Array.isArray(warnings)) warnings.push(message);
}

/**
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


function categoriesToGenerate(requirements) {
  const kinds = new Set(requirements.map((r) => r.kind));
  const cats = new Set();

  if (kinds.has('technical')) {
    cats.add('technical');
    // Only generate system-design if there's a senior-ish role or explicit system req
    cats.add('system-design');
  }
  if (kinds.has('behavioural') || kinds.has('domain')) {
    cats.add('behavioural');
  }
  // Always include company-fit
  cats.add('company-fit');

  return [...cats].filter((c) => CATEGORIES.includes(c));
}


function requirementsForCategory(requirements, category) {
  if (category === 'company-fit') return requirements;
  if (category === 'system-design') return requirements.filter((r) => r.kind === 'technical');
  if (category === 'behavioural') return requirements.filter((r) => r.kind === 'behavioural' || r.kind === 'domain');
  if (category === 'technical') return requirements.filter((r) => r.kind === 'technical');
  return requirements;
}

/**
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
    let questions = normalizeQuestions(result?.questions ?? [], requirements, category, startId);

    // The model occasionally answers with an empty list, invented requirement
    // ids, or blank prompts. Previously one such answer emptied the whole
    // section. Retry once with the allowed ids spelled out before giving up.
    if (!questions.length) {
      console.warn(`[questions] ${category} returned nothing usable — retrying with a corrective prompt`);
      result = await generateStructured({ type: 'questions', prompt: promptFor(true), useMock: false });
      questions = normalizeQuestions(result?.questions ?? [], requirements, category, startId);
    }

    if (!questions.length) {
      const synthId = fallbackId ?? requirements[0]?.id ?? null;
      if (synthId && category === 'company-fit') {
        const companyName = research?.companyName || role?.title || 'this company';
        questions = [{
          id: `q${startId}`,
          requirement_ids: [synthId],
          category,
          prompt: `What motivates you to join ${companyName}, and how does this role align with your career goals?`,
          answer_outline: 'Discuss specific aspects of the company mission or culture that resonate; connect to personal career trajectory and what you hope to learn or contribute.',
          difficulty: 1,
        }];
      } else {
      pushWarning(warnings, `questions_empty: no usable ${category} questions were generated (retried once)`);
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

  const categories = categoriesToGenerate(requirements);
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