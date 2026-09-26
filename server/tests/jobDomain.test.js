import { describe, it, expect, vi, beforeEach } from 'vitest';

// The LLM client is the failure point we exercise; prompt building and
// category selection run for real.
const { generateStructured } = vi.hoisted(() => ({ generateStructured: vi.fn() }));
vi.mock('../src/llm/client.js', () => ({ generateStructured }));

const { normalizeDomain, extractJd } = await import('../src/pipeline/jd.js');
const { generateQuestions } = await import('../src/pipeline/generation/questions.js');

describe('job domain detection', () => {
  beforeEach(() => generateStructured.mockReset());

  it('normalizes model output to known domain slugs', () => {
    expect(normalizeDomain('Software/IT')).toBe('software');
    expect(normalizeDomain('MARKETING')).toBe('marketing');
    expect(normalizeDomain('Data Analyst')).toBe('data-analyst');
    expect(normalizeDomain('Human Resources')).toBe('hr');
    expect(normalizeDomain('quantum basket weaving')).toBe('other');
    expect(normalizeDomain(undefined)).toBe('other');
  });

  it('extractJd carries the detected domain through', async () => {
    generateStructured.mockResolvedValue({
      title: 'Growth Marketer',
      seniority: 'Mid-level',
      domain: 'Marketing',
      location: 'Remote',
      responsibilities: [],
      requirements: [{ id: 'r1', text: 'SEO experience', kind: 'technical', priority: 'must' }],
    });

    const result = await extractJd('x'.repeat(400));

    expect(result.domain).toBe('marketing');
    expect(result.requirements).toHaveLength(1);
  });
});

describe('domain-aware category selection', () => {
  beforeEach(() => generateStructured.mockReset());

  const requirements = [
    { id: 'r1', text: 'SEO and campaign analytics', kind: 'technical', priority: 'must' },
  ];
  const research = { companyName: 'Acme', hiringProcess: null, discussionSnippets: [] };

  const categoriesAsked = () =>
    generateStructured.mock.calls.map(
      (c) => c[0].prompt.match(/generating "([^"]+)" interview questions/)?.[1],
    );

  it('skips system-design for non-software domains', async () => {
    generateStructured.mockResolvedValue({ questions: [] });

    await generateQuestions(
      requirements,
      { title: 'Marketing Manager', seniority: 'Mid-level', domain: 'marketing' },
      research, 1, [],
    );

    expect(categoriesAsked()).toContain('technical');
    expect(categoriesAsked()).toContain('company-fit');
    expect(categoriesAsked()).not.toContain('system-design');
  });

  it('keeps system-design for software and unknown domains', async () => {
    generateStructured.mockResolvedValue({ questions: [] });
    const askedSystemDesign = () =>
      generateStructured.mock.calls.some((c) =>
        c[0].prompt.includes('"system-design" interview questions'),
      );

    await generateQuestions(
      requirements,
      { title: 'Backend Engineer', seniority: 'Senior', domain: 'software' },
      research, 1, [],
    );
    expect(askedSystemDesign()).toBe(true);

    generateStructured.mockClear();

    await generateQuestions(
      requirements,
      { title: 'Engineer', seniority: 'Senior' },
      research, 1, [],
    );
    expect(askedSystemDesign()).toBe(true);
  });

  it('puts the domain focus into the technical prompt', async () => {
    generateStructured.mockResolvedValue({ questions: [] });

    await generateQuestions(
      requirements,
      { title: 'Marketing Manager', seniority: 'Mid-level', domain: 'marketing' },
      research, 1, [],
    );

    const technicalPrompt = generateStructured.mock.calls
      .map((c) => c[0].prompt)
      .find((p) => p.includes('"technical" interview questions'));

    expect(technicalPrompt).toContain('campaigns, SEO, analytics, and brand strategy');
  });
});
