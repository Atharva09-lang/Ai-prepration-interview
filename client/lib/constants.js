// Canonical pipeline stages, mirroring server/src/pipeline/runPipeline.js STAGES.
// The timeline is driven by job.progress entries whose `stage` matches these keys.

export const PIPELINE_STAGES = [
  { key: 'research', label: 'Researching the company', detail: 'Crawling the site and finding the hiring process.' },
  { key: 'extract', label: 'Extracting requirements', detail: 'Pulling responsibilities and skills from the description.' },
  { key: 'brief', label: 'Writing the company brief', detail: 'Summarising what the company does and how they hire.' },
  { key: 'questions', label: 'Generating interview questions', detail: 'Creating technical, behavioural and fit questions.' },
  { key: 'coverage', label: 'Checking requirement coverage', detail: 'Making sure every requirement is practised.' },
  { key: 'flashcards', label: 'Building flashcards', detail: 'Condensing key material into review cards.' },
  { key: 'schedule', label: 'Creating the study schedule', detail: 'Spreading the work across your available days.' },
  { key: 'validate', label: 'Validating the kit', detail: 'Final consistency checks before it is ready.' },
];

export const QUESTION_CATEGORIES = [
  'technical',
  'behavioural',
  'system-design',
  'company-fit',
];

// Confidence scale used by the practice endpoint (1 hard, 2 good, 3 easy).
export const CONFIDENCE = {
  AGAIN: 1,
  GOOD: 2,
  EASY: 3,
};

export const POLL_INTERVAL_MS = 1500;
