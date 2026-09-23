import { describe, it, expect } from 'vitest';
import { filterValidRequirementIds } from '../src/pipeline/coverage.js';
import { normalizeQuestions } from '../src/pipeline/generation/questions.js';
import { normalizeFlashcards } from '../src/pipeline/generation/flashcards.js';
import { questionSchema, flashcardSchema } from '../src/validators/kit.schema.js';

const reqs = [
  { id: 'r1', text: 'Node.js', kind: 'technical', priority: 'must' },
  { id: 'r2', text: 'Databases', kind: 'technical', priority: 'must' },
];

describe('filterValidRequirementIds', () => {
  const valid = new Set(['r1', 'r2']);

  it('keeps only existing ids, de-duplicated and in order', () => {
    expect(filterValidRequirementIds(['r2', 'r9', 'r1', 'r2'], valid)).toEqual(['r2', 'r1']);
  });

  it('returns [] for a non-array', () => {
    expect(filterValidRequirementIds(undefined, valid)).toEqual([]);
    expect(filterValidRequirementIds('r1', valid)).toEqual([]);
  });

  it('ignores non-string entries', () => {
    expect(filterValidRequirementIds(['r1', 42, null, { id: 'r2' }], valid)).toEqual(['r1']);
  });
});

describe('normalizeQuestions', () => {
  it('drops a question whose requirement_ids are all invalid', () => {
    const out = normalizeQuestions(
      [{ prompt: 'P', answer_outline: 'A', requirement_ids: ['r99'], difficulty: 2 }],
      reqs, 'technical', 1,
    );
    expect(out).toEqual([]);
  });

  it('filters invalid ids out of a mixed list but keeps the question', () => {
    const out = normalizeQuestions(
      [{ prompt: 'P', answer_outline: 'A', requirement_ids: ['r1', 'nope', 'r2'], difficulty: 2 }],
      reqs, 'technical', 1,
    );
    expect(out[0].requirement_ids).toEqual(['r1', 'r2']);
  });

  it('drops questions with an empty prompt or answer_outline', () => {
    const out = normalizeQuestions(
      [
        { prompt: '   ', answer_outline: 'A', requirement_ids: ['r1'] },
        { prompt: 'P', answer_outline: '', requirement_ids: ['r1'] },
        { prompt: 'P', answer_outline: 'A', requirement_ids: ['r1'] },
      ],
      reqs, 'technical', 1,
    );
    expect(out).toHaveLength(1);
  });

  it('uses the fallback id when the model gave none (gap questions)', () => {
    const out = normalizeQuestions(
      [{ prompt: 'P', answer_outline: 'A', requirement_ids: [], difficulty: 3 }],
      reqs, 'technical', 1, 'r2',
    );
    expect(out[0].requirement_ids).toEqual(['r2']);
  });

  it('forces the category, clamps difficulty, and assigns sequential ids from startId', () => {
    const out = normalizeQuestions(
      [
        { prompt: 'P1', answer_outline: 'A', requirement_ids: ['r1'], category: 'behavioural', difficulty: 9 },
        { prompt: 'P2', answer_outline: 'A', requirement_ids: ['r2'], difficulty: 0 },
      ],
      reqs, 'technical', 5,
    );
    expect(out.map((q) => q.id)).toEqual(['q5', 'q6']);
    expect(out.every((q) => q.category === 'technical')).toBe(true);
    expect(out.map((q) => q.difficulty)).toEqual([2, 2]);
  });

  it('produces items that pass the kit question schema', () => {
    const out = normalizeQuestions(
      [{ prompt: 'P', answer_outline: 'A', requirement_ids: ['r1', 'bogus'], difficulty: 2 }],
      reqs, 'technical', 1,
    );
    expect(questionSchema.safeParse(out[0]).success).toBe(true);
  });
});

describe('normalizeFlashcards', () => {
  it('drops cards with no valid requirement id', () => {
    const out = normalizeFlashcards(
      [{ front: 'F', back: 'B', requirement_ids: ['r404'] }],
      reqs, 1,
    );
    expect(out).toEqual([]);
  });

  it('drops cards with a blank front or back', () => {
    const out = normalizeFlashcards(
      [
        { front: '', back: 'B', requirement_ids: ['r1'] },
        { front: 'F', back: '  ', requirement_ids: ['r1'] },
      ],
      reqs, 1,
    );
    expect(out).toEqual([]);
  });

  it('assigns sequential ids from startId and passes the flashcard schema', () => {
    const out = normalizeFlashcards(
      [
        { front: 'F1', back: 'B1', requirement_ids: ['r1'] },
        { front: 'F2', back: 'B2', requirement_ids: ['r2', 'r2'] },
      ],
      reqs, 3,
    );
    expect(out.map((f) => f.id)).toEqual(['f3', 'f4']);
    expect(out[1].requirement_ids).toEqual(['r2']);
    expect(flashcardSchema.safeParse(out[0]).success).toBe(true);
  });
});
