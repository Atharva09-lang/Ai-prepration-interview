export function makeKit() {
  const url = 'http://localhost:8099/acme/';
  return {
    source: {
      company: 'Acme',
      company_url: url,
      role: 'Backend Engineer',
      location: 'Remote',
      jd_chars: 120,
      researched_at: '2026-09-20T10:00:00.000Z',
      pages_used: [url],
    },
    company_brief: { summary: 'Acme builds widgets.', what_they_do: 'Widgets for teams.', sources: [url] },
    role: {
      title: 'Backend Engineer',
      seniority: 'senior',
      responsibilities: ['Build APIs'],
      requirements: [
        { id: 'r1', text: '5+ years Node.js', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'Mentor junior engineers', kind: 'behavioural', priority: 'must' },
        { id: 'r3', text: 'Kubernetes is a plus', kind: 'technical', priority: 'nice' },
      ],
    },
    questions: [
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'Explain the event loop.', answer_outline: 'Phases, microtasks.', difficulty: 2 },
      { id: 'q2', requirement_ids: ['r2'], category: 'behavioural', prompt: 'Tell me about mentoring.', answer_outline: 'STAR story.', difficulty: 1 },
      { id: 'q3', requirement_ids: ['r3'], category: 'technical', prompt: 'What is a Pod?', answer_outline: 'Smallest deployable unit.', difficulty: 3 },
    ],
    flashcards: [{ id: 'f1', front: 'Event loop?', back: 'Single-threaded scheduler.', requirement_ids: ['r1'] }],
    schedule: {
      days_available: 2,
      days: [
        { day: 1, focus: 'Node.js', question_ids: ['q1', 'q3'], minutes: 60 },
        { day: 2, focus: 'Mentoring', question_ids: ['q2'], minutes: 30 },
      ],
    },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
    research: {
      pages_failed: [],
      hiring_page_found: false,
      discussion_found: false,
      discussion_sources: [],
      hiring_process: null,
    },
    warnings: [],
  };
}