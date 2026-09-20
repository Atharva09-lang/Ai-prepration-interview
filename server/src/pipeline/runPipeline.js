import { AppError } from '../utils/AppError.js';
import { assertValidKit } from './validate.js';


export const STAGES = [
  { key: 'research', label: 'Researching the company' },
  { key: 'extract', label: 'Extracting job requirements' },
  { key: 'brief', label: 'Writing the company brief' },
  { key: 'questions', label: 'Generating questions' },
  { key: 'coverage', label: 'Checking requirement coverage' },
  { key: 'flashcards', label: 'Creating flashcards' },
  { key: 'schedule', label: 'Building the study schedule' },
  { key: 'validate', label: 'Validating the kit' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


export async function runPipeline(input, { onProgress = () => {} } = {}) {
  let current = null;
  try {
    for (const { key } of STAGES) {
      current = key;
      onProgress({ stage: key, status: 'running' });
      await sleep(500);
      // Test hook to exercise the failure flow; removed when the real pipeline lands.
      if (key === 'research' && input.company_url.includes('fail.invalid')) {
        throw new AppError('STUB_FAILURE', 'Simulated failure (stub pipeline)', 502);
      }
      onProgress({ stage: key, status: 'done' });
    }
    return assertValidKit(buildStubKit(input));
  } catch (err) {
    onProgress({ stage: current, status: 'failed', detail: err.message });
    throw err;
  }
}

function buildStubKit({ jd, company_url, days }) {
  return {
    source: {
      company: '',
      company_url,
      role: '',
      location: '',
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: {
      summary: 'Placeholder: real research is not wired in yet.',
      what_they_do: '',
      sources: [],
    },
    role: {
      title: '',
      seniority: '',
      responsibilities: [],
      requirements: [
        { id: 'r1', text: 'Placeholder requirement (stub pipeline)', kind: 'technical', priority: 'must' },
      ],
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Placeholder question',
        answer_outline: 'Placeholder outline',
        difficulty: 1,
      },
    ],
    flashcards: [{ id: 'f1', front: 'Placeholder front', back: 'Placeholder back', requirement_ids: ['r1'] }],
    schedule: {
      days_available: days,
      days: Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        focus: i === 0 ? 'Placeholder study day' : 'Review',
        question_ids: i === 0 ? ['q1'] : [],
        minutes: i === 0 ? 30 : 0,
      })),
    },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
    research: {
      pages_failed: [],
      hiring_page_found: false,
      discussion_found: false,
      discussion_sources: [],
      hiring_process: null,
    },
    warnings: ['stub_pipeline'],
  };
}