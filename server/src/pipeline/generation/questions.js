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

const CATEGORIES = ['technical', 'behavioural', 'system-design', 'company-fit'];

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
      const questions = (result.questions ?? []).map((q) => ({
        id: `q${nextId++}`,
        requirement_ids: Array.isArray(q.requirement_ids) ? q.requirement_ids : [],
        category,
        prompt: q.prompt ?? '',
        answer_outline: q.answer_outline ?? '',
        difficulty: Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 3
          ? q.difficulty
          : 2,
      }));
      // Reassign IDs to ensure sequential continuity regardless of LLM output
      questions.forEach((q, i) => {
        q.id = `q${nextId - questions.length + i}`;
      });
      allQuestions.push(...questions);
    } catch (err) {
      // Skip a failed category rather than aborting the whole pipeline
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
      const questions = (result.questions ?? []).map((q, i) => ({
        id: `q${nextId + i}`,
        requirement_ids: Array.isArray(q.requirement_ids) ? q.requirement_ids : [reqs[0].id],
        category,
        prompt: q.prompt ?? '',
        answer_outline: q.answer_outline ?? '',
        difficulty: Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 3
          ? q.difficulty
          : 2,
      }));
      nextId += questions.length;
      allQuestions.push(...questions);
    } catch (err) {
      console.warn(`[gap-questions] failed for category ${category}:`, err.message);
    }
  }

  return allQuestions;
}
