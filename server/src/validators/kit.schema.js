import { z } from 'zod';

export const REQUIREMENT_KINDS = ['technical', 'behavioural', 'domain'];
export const REQUIREMENT_PRIORITIES = ['must', 'nice'];
export const QUESTION_CATEGORIES = ['technical', 'behavioural', 'system-design', 'company-fit'];

const text = z.string().trim().min(1);
// Ids are created by our code (r1, q1, f1...), so we can be strict about their shape.
const idOf = (prefix) => z.string().regex(new RegExp(`^${prefix}\\d+$`), `id must look like ${prefix}1`);
const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'must be an ISO date');

export const requirementSchema = z.object({
  id: idOf('r'),
  text,
  kind: z.enum(REQUIREMENT_KINDS),
  priority: z.enum(REQUIREMENT_PRIORITIES),
});

export const questionSchema = z.object({
  id: idOf('q'),
  requirement_ids: z.array(idOf('r')).min(1),
  category: z.enum(QUESTION_CATEGORIES),
  prompt: text,
  answer_outline: text,
  difficulty: z.number().int().min(1).max(3),
});

export const flashcardSchema = z.object({
  id: idOf('f'),
  front: text,
  back: text,
  requirement_ids: z.array(idOf('r')).min(1),
});

export const scheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: text,
  question_ids: z.array(idOf('q')),
  minutes: z.number().int().min(0),
});

// Extension (allowed by the brief): records honestly what research could and could not find.
export const researchSchema = z.object({
  pages_failed: z.array(z.object({ url: z.string(), reason: z.string() })),
  hiring_page_found: z.boolean(),
  discussion_found: z.boolean(),
  discussion_sources: z.array(z.string()),
  hiring_process: z
    .object({ found: z.boolean(), summary: z.string(), stages: z.array(z.string()) })
    .nullable(),
});

export const kitSchema = z.object({
  source: z.object({
    // Plain strings (empty allowed): when the JD/site does not say, we do not invent it.
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().min(0),
    researched_at: isoDate,
    pages_used: z.array(z.string()),
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string()),
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(requirementSchema),
  }),
  questions: z.array(questionSchema),
  flashcards: z.array(flashcardSchema),
  schedule: z.object({
    days_available: z.number().int().min(1),
    days: z.array(scheduleDaySchema),
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(idOf('r')),
    passes: z.number().int().min(1),
  }),
  research: researchSchema,
  warnings: z.array(z.string()),
});