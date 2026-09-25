import { describe, it, expect, vi, beforeEach } from 'vitest';

// The LLM client is the failure point we want to exercise, so it is mocked
// wholesale. Everything else (prompt building, normalisation) runs for real.
const { generateStructured } = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock('../src/llm/client.js', () => ({ generateStructured }));

const { generateCategoryQuestions, generateGapQuestions } = await import(
  '../src/pipeline/generation/questions.js'
);
const { generateFlashcards } = await import('../src/pipeline/generation/flashcards.js');

const requirements = [
  { id: 'r1', text: 'Five years of React', kind: 'technical', priority: 'must' },
  { id: 'r2', text: 'Mentoring junior engineers', kind: 'behavioural', priority: 'must' },
];
const role = { title: 'Frontend Engineer', seniority: 'Senior', responsibilities: [] };
const research = { companyName: 'Acme', hiringProcess: null, discussionSnippets: [] };

const validQuestion = {
  id: 'q1',
  requirement_ids: ['r1'],
  category: 'technical',
  prompt: 'How does React reconcile?',
  answer_outline: 'Diffing, keys, fibre.',
  difficulty: 2,
};

beforeEach(() => {
  generateStructured.mockReset();
});

describe('generation failures are reported, not swallowed', () => {
  it('records a failed category in warnings and returns no questions', async () => {
    generateStructured.mockRejectedValue(new Error('Gemini API error: 429'));
    const warnings = [];

    const questions = await generateCategoryQuestions(
      requirements, role, research, 'technical', 1, warnings,
    );

    expect(questions).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('questions_failed: technical');
    expect(warnings[0]).toContain('429');
  });

  it('records a category that returned nothing usable', async () => {
    generateStructured.mockResolvedValue({ questions: [] });
    const warnings = [];

    await generateCategoryQuestions(requirements, role, research, 'technical', 1, warnings);

    expect(warnings).toEqual([expect.stringContaining('questions_empty:')]);
  });

  it('retries once with a corrective prompt when the first answer is unusable', async () => {
    generateStructured
      .mockResolvedValueOnce({ questions: [{ ...validQuestion, requirement_ids: ['r9'] }] })
      .mockResolvedValueOnce({ questions: [validQuestion] });
    const warnings = [];

    const questions = await generateCategoryQuestions(
      requirements, role, research, 'company-fit', 3, warnings,
    );

    expect(questions).toHaveLength(1);
    expect(questions[0].category).toBe('company-fit');
    expect(warnings).toEqual([]);
    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect(generateStructured.mock.calls[1][0].prompt).toContain('CORRECTION');
    expect(generateStructured.mock.calls[1][0].prompt).toContain('["r1","r2"]');
    expect(generateStructured.mock.calls[0][0].prompt).not.toContain('CORRECTION');
  });

  it('gives up after one retry and says so in the warning', async () => {
    generateStructured.mockResolvedValue({ questions: [{ prompt: '', answer_outline: '' }] });
    const warnings = [];

    const questions = await generateCategoryQuestions(
      requirements, role, research, 'company-fit', 3, warnings,
    );

    expect(questions).toEqual([]);
    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect(warnings).toEqual([expect.stringContaining('retried once')]);
    expect(warnings[0]).toContain('company-fit');
  });

  it('stays quiet when the category generated questions', async () => {
    generateStructured.mockResolvedValue({ questions: [validQuestion] });
    const warnings = [];

    const questions = await generateCategoryQuestions(
      requirements, role, research, 'technical', 1, warnings,
    );

    expect(questions).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it('records a failed gap-filling pass', async () => {
    generateStructured.mockRejectedValue(new Error('Gemini API error: 503'));
    const warnings = [];

    const questions = await generateGapQuestions(
      [requirements[0]], role, research, 5, warnings,
    );

    expect(questions).toEqual([]);
    expect(warnings[0]).toContain('gap_questions_failed:');
  });

  it('records failed flashcards and invents no placeholder cards', async () => {
    generateStructured.mockRejectedValue(new Error('Gemini API error: 503'));
    const warnings = [];

    const flashcards = await generateFlashcards(requirements, [validQuestion], 1, warnings);

    expect(flashcards).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('flashcards_failed:')]);
  });

  it('works without a warnings array (callers that do not collect them)', async () => {
    generateStructured.mockRejectedValue(new Error('boom'));

    await expect(
      generateCategoryQuestions(requirements, role, research, 'technical'),
    ).resolves.toEqual([]);
  });
});
