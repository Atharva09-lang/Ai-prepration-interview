

import { generateStructured } from '../../llm/client.js';


const STAGE_PATTERNS = [
  { label: 'Application / CV review', patterns: ['application', 'cv review', 'resume review', 'apply'] },
  { label: 'Recruiter screen', patterns: ['recruiter', 'phone screen', 'initial call', 'intro call'] },
  { label: 'Hiring manager call', patterns: ['hiring manager', 'manager call', 'manager interview'] },
  { label: 'Technical screen', patterns: ['technical screen', 'coding screen', 'take-home', 'take home', 'homework'] },
  { label: 'Technical interview', patterns: ['technical interview', 'coding interview', 'pair programming'] },
  { label: 'System design', patterns: ['system design', 'architecture', 'design interview'] },
  { label: 'Behavioural interview', patterns: ['behavioural', 'behavioral', 'values interview', 'culture fit'] },
  { label: 'Panel / On-site', patterns: ['panel', 'on-site', 'onsite', 'virtual on-site', 'loop'] },
  { label: 'Reference check', patterns: ['reference check', 'references'] },
  { label: 'Offer', patterns: ['offer', 'compensation', 'salary negotiation'] },
];


function extractStagesFromText(text) {
  const lower = text.toLowerCase();
  return STAGE_PATTERNS
    .filter(({ patterns }) => patterns.some((p) => lower.includes(p)))
    .map(({ label }) => label);
}

const MIN_CHARS_FOR_LLM = 200;

/**
 * Given the text of a potential hiring page, returns structured hiring process info.
 *
 * @param {string} text  Plain text from the hiring page
 * @param {string} url   Source URL (for context)
 * @returns {Promise<{ found: boolean; summary: string; stages: string[] }>}
 */
export async function extractHiringProcess(text, url) {
  if (!text || text.length < 50) {
    return { found: false, summary: '', stages: [] };
  }

  const stages = extractStagesFromText(text);


  if (text.length >= MIN_CHARS_FOR_LLM) {
    try {
      const prompt = buildHiringProcessPrompt(text.slice(0, 4000), url);
      const result = await generateStructured({ type: 'hiringProcess', prompt, useMock: false });
      if (result && result.summary) {
        return {
          found: true,
          summary: result.summary,
          stages: result.stages?.length ? result.stages : stages,
        };
      }
    } catch {

    }
  }


  if (stages.length === 0) {
    return { found: false, summary: '', stages: [] };
  }

  return {
    found: true,
    summary: `Interview process found at ${url}. Detected stages: ${stages.join(', ')}.`,
    stages,
  };
}

function buildHiringProcessPrompt(text, url) {
  return `
You are an interview preparation assistant.

Extract the interview/hiring process from the text below. Focus on stages, format, and any tips mentioned.

SOURCE URL: ${url}

PAGE TEXT:
${text}

Rules:
1. Only use information present in the text. Do not invent stages.
2. If the page does not describe an interview process, return found: false.
3. Keep the summary concise (2–4 sentences).
4. List stages in the order they appear.

Return JSON only:
{
  "found": true,
  "summary": "Brief description of the interview process",
  "stages": ["Stage 1", "Stage 2"]
}
`.trim();
}
