import { UNTRUSTED_CONTENT_RULE } from './safety.js';

export function buildQuestionsPrompt({
  role,
  requirements,
  research,
}) {
  return `
You are an interview preparation assistant.

Generate interview questions for the given role and requirements.

ROLE:
${JSON.stringify(role, null, 2)}

REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

RESEARCH:
${JSON.stringify(research, null, 2)}

${UNTRUSTED_CONTENT_RULE}


Rules:
1. Generate questions directly from the requirements.
2. Every question must reference one or more requirement IDs.
3. Use only these categories:
   - technical
   - behavioural
   - system-design
   - company-fit
4. Difficulty must be an integer from 1 to 3.
5. Questions should be realistic interview questions.
6. Include an answer outline for every question.
7. Avoid duplicate or nearly identical questions.

Return JSON only in this format:

{
  "questions": [
    {
      "id": "q1",
      "requirement_ids": ["r1"],
      "category": "technical",
      "prompt": "Question here",
      "answer_outline": "Expected answer points",
      "difficulty": 2
    }
  ]
}
`.trim();
}

/**
 * Builds a focused prompt for one specific question category.
 * Called once per category so the LLM can specialise its output.
 *
 * @param {string} category   'technical' | 'behavioural' | 'system-design' | 'company-fit'
 * @param {object[]} requirements  Requirements relevant to this category
 * @param {object} role       Extracted role info
 * @param {object} research   Research context (hiring process, discussion snippets)
 * @param {string} idPrefix   Starting id prefix (e.g. 'q3') to avoid collisions
 */
export function buildCategoryQuestionsPrompt({ category, requirements, role, research, idPrefix = 'q1' }) {
  const startNum = Number(idPrefix.slice(1)) || 1;

  const categoryGuidance = {
    technical:
      'Focus on hands-on technical skills, tools, frameworks, languages, and problem-solving. Include at least one question per must-have technical requirement.',
    behavioural:
      'Focus on past experience, soft skills, leadership, collaboration, and communication. Use STAR-style prompts where appropriate.',
    'system-design':
      'Focus on architecture, scalability, trade-offs, and design decisions relevant to the role seniority. Avoid trivial toy problems.',
    'company-fit':
      'Focus on alignment with the company mission, culture, values, and any specifics from the research. If little is known about the company, ask about general motivations for the role.',
  };

  const researchContext = research?.hiringProcess
    ? `The company uses the following interview process: ${research.hiringProcess.summary}`
    : research?.discussionSnippets?.length
    ? `Interview discussion snippets: ${research.discussionSnippets.slice(0, 2).join(' | ')}`
    : 'No specific company interview process information available.';

  return `
You are an interview preparation assistant generating "${category}" interview questions.

CATEGORY FOCUS:
${categoryGuidance[category] ?? 'Generate relevant interview questions.'}

ROLE:
${JSON.stringify({ title: role.title, seniority: role.seniority }, null, 2)}

REQUIREMENTS (relevant to this category):
${JSON.stringify(requirements, null, 2)}

RESEARCH CONTEXT:
${researchContext}


${UNTRUSTED_CONTENT_RULE}

Rules:
1. Every question MUST reference at least one requirement ID from the list above.
2. All questions must have category: "${category}".
3. Difficulty is an integer 1 (easy) to 3 (hard). Match seniority: Senior/Staff roles should have mostly 2–3.
4. Include a concrete answer_outline: key points, not a full answer.
5. Generate 2–4 questions. More requirements = more questions, but avoid padding.
6. Do not generate questions for requirements that are not in the list.
7. IDs must be sequential starting from q${startNum}.

Return JSON only:
{
  "questions": [
    {
      "id": "q${startNum}",
      "requirement_ids": ["r1"],
      "category": "${category}",
      "prompt": "Question here",
      "answer_outline": "Key points to cover",
      "difficulty": 2
    }
  ]
}
`.trim();
}
