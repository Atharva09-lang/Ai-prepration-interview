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
/**
 * Maps requirement kinds to the categories that should cover them.
 * A requirement may be covered by more than one category.
 */
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

/**
 * Returns requirements relevant to a given category.
 * company-fit always gets all requirements for context.
 */
function requirementsForCategory(requirements, category) {
  if (category === 'company-fit') return requirements;
  if (category === 'system-design') return requirements.filter((r) => r.kind === 'technical');
  if (category === 'behavioural') return requirements.filter((r) => r.kind === 'behavioural' || r.kind === 'domain');
  if (category === 'technical') return requirements.filter((r) => r.kind === 'technical');
  return requirements;
}

/**
 * Generates questions for all relevant categories.
 * Each category is a separate LLM call.
 *
 * @param {object[]} requirements   Array of requirement objects with id, text, kind, priority
 * @param {object}   role           { title, seniority, responsibilities }
 * @param {object}   research       Research result with hiringProcess + discussionSnippets
 * @param {number}   [startId=1]    Starting numeric suffix for question IDs
 * @returns {Promise<object[]>}     Flat array of question objects
 */
export async function generateQuestions(requirements, role, research, startId = 1) {
  if (!requirements.length) return [];

  const categories = categoriesToGenerate(requirements);
  const allQuestions = [];
  let nextId = startId;

  for (const category of categories) {
    const reqs = requirementsForCategory(requirements, category);
    if (!reqs.length && category !== 'company-fit') continue;

    const prompt = buildCategoryQuestionsPrompt({
      category,
      requirements: reqs,
      role,
      research,
      idPrefix: `q${nextId}`,
    });

    try {
      const result = await generateStructured({ type: 'questions', prompt, useMock: false });
       const questions = normalizeQuestions(result.questions ?? [], requirements, category, nextId);
      nextId += questions.length;
      allQuestions.push(...questions);
    } catch (err) {
      
      console.warn(`[questions] failed to generate ${category} questions:`, err.message);
    }
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
 * @returns {Promise<object[]>}
 */
export async function generateGapQuestions(gapRequirements, role, research, startId) {
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
    }
  }

  return allQuestions;
}
