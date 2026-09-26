/**
 * prompts/jd.js — prompt for extracting structured requirements from a job description.
 */

import { UNTRUSTED_CONTENT_RULE, untrustedBlock } from './safety.js';

export function buildJdExtractionPrompt(jd) {
  return `
You are an interview preparation assistant. Extract structured information from this job description.

${untrustedBlock('JOB DESCRIPTION', jd)}

${UNTRUSTED_CONTENT_RULE}

Rules:
1. Extract the role title, seniority level, responsibilities, and requirements.
2. For each requirement, assign:
   - id: sequential (r1, r2, r3, ...)
   - text: the exact or paraphrased requirement
   - kind: "technical" | "behavioural" | "domain"
     - technical = coding, tools, frameworks, systems, infrastructure
     - behavioural = communication, leadership, collaboration, mentoring
     - domain = industry knowledge, product area, business understanding
   - priority: "must" | "nice"
     - must = "required", "must have", "essential", "you will need", core responsibility
     - nice = "bonus", "nice to have", "preferred", "plus", "desirable", "advantage"
     - When unclear, default to "must" if it reads as a core expectation
3. Domain: classify the job into one of: "software" (IT/engineering roles), "marketing", "finance", "hr", "sales", "data-analyst", or "other" when it does not clearly fit any of these.
4. If the job description is very short or vague, extract what you can and note it in seniority.
5. Do not invent requirements that are not implied by the text.
6. Seniority: "Junior", "Mid-level", "Senior", "Staff", "Principal", "Lead", "Manager", or "Unknown".
7. Location: extract if mentioned, otherwise empty string.

Return JSON only:
{
  "title": "Role title",
  "seniority": "Senior",
  "domain": "software",
  "location": "",
  "responsibilities": [
    "Responsibility 1",
    "Responsibility 2"
  ],
  "requirements": [
    {
      "id": "r1",
      "text": "5+ years with React",
      "kind": "technical",
      "priority": "must"
    }
  ]
}
`.trim();
}
