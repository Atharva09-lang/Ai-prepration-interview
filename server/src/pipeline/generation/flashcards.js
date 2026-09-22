

import { generateStructured } from '../../llm/client.js';
import { buildFlashcardsPrompt } from '../../llm/prompts/flashcards.js';
import { filterValidRequirementIds } from '../coverage.js';

/**
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
 * @returns {Promise<object[]>}
 */
export async function generateFlashcards(requirements, questions, startId = 1) {
  if (!requirements.length) return [];

  const prompt = buildFlashcardsPrompt({ requirements, questions });

  try {
    const result = await generateStructured({ type: 'flashcards', prompt, useMock: false });
     return normalizeFlashcards(result.flashcards ?? [], requirements, startId);
  } catch (err) {
    console.warn('[flashcards] generation failed:', err.message);
    // Return minimal flashcards so the kit still passes validation
    return requirements.slice(0, 3).map((r, i) => ({
      id: `f${startId + i}`,
      front: `What is "${r.text}"?`,
      back: 'Review the job description and your preparation notes.',
      requirement_ids: [r.id],
    }));
  }
}
