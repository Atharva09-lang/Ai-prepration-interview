/**
 * generation/flashcards.js — generates flashcards from requirements and questions.
 */

import { generateStructured } from '../../llm/client.js';
import { buildFlashcardsPrompt } from '../../llm/prompts/flashcards.js';
import { filterValidRequirementIds } from '../coverage.js';

function pushWarning(warnings, message) {
  if (Array.isArray(warnings)) warnings.push(message);
}

/**
 * Turns raw LLM output into schema-safe flashcards.
 *
 * Drops any card whose front/back is blank or whose requirement_ids contain no
 * id that actually exists — those would otherwise fail structural validation
 * and mark the whole kit failed. Ids are reassigned sequentially from startId.
 *
 * Exported for unit testing.
 *
 * @param {object[]} rawList           Raw `flashcards` array from the model
 * @param {object[]} validRequirements Requirements whose ids are acceptable
 * @param {number}   startId           First numeric id suffix to use
 * @returns {object[]}
 */
export function normalizeFlashcards(rawList, validRequirements, startId) {
  const validIds = new Set(validRequirements.map((r) => r.id));
  const out = [];
  let n = startId;

  for (const f of Array.isArray(rawList) ? rawList : []) {
    const front = typeof f?.front === 'string' ? f.front.trim() : '';
    const back = typeof f?.back === 'string' ? f.back.trim() : '';
    const requirement_ids = filterValidRequirementIds(f?.requirement_ids, validIds);
    if (!front || !back || !requirement_ids.length) continue;
    out.push({ id: `f${n++}`, front, back, requirement_ids });
  }

  return out;
}

/**
 * Generates flashcards for the kit.
 *
 * @param {object[]} requirements
 * @param {object[]} questions
 * @param {number}   [startId=1]  Starting numeric suffix for flashcard IDs
 * @param {string[]} [warnings]   Kit warnings array — a failed/empty section is recorded here
 * @returns {Promise<object[]>}
 */
export async function generateFlashcards(requirements, questions, startId = 1, warnings = null) {
  if (!requirements.length) return [];

  const prompt = buildFlashcardsPrompt({ requirements, questions });

  try {
    const result = await generateStructured({ type: 'flashcards', prompt, useMock: false });
    const cards = normalizeFlashcards(result.flashcards ?? [], requirements, startId);
    if (!cards.length) {
      pushWarning(warnings, 'flashcards_empty: no usable flashcards were generated');
    }
    return cards;
  } catch (err) {
    console.warn('[flashcards] generation failed:', err.message);
    // Fabricated placeholder cards would look like real content, so an empty
    // section plus a recorded warning is the honest outcome. The kit schema
    // allows zero flashcards, so this does not invalidate the kit.
    pushWarning(
      warnings,
      `flashcards_failed: flashcards could not be generated (${err.message})`,
    );
    return [];
  }
}
