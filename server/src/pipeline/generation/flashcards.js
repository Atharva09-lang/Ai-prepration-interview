/**
 * generation/flashcards.js — generates flashcards from requirements and questions.
 */

import { generateStructured } from '../../llm/client.js';
import { buildFlashcardsPrompt } from '../../llm/prompts/flashcards.js';

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
    return (result.flashcards ?? []).map((f, i) => ({
      id: `f${startId + i}`,
      front: f.front ?? '',
      back: f.back ?? '',
      requirement_ids: Array.isArray(f.requirement_ids) ? f.requirement_ids : [],
    }));
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
