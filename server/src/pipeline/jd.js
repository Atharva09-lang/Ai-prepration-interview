

import { generateStructured } from '../llm/client.js';
import { buildJdExtractionPrompt } from '../llm/prompts/jd.js';

/**
 * 
 *
 * @param {string} jd  
 * @returns {Promise<{
 *   title: string;
 *   seniority: string;
 *   location: string;
 *   responsibilities: string[];
 *   requirements: { id: string; text: string; kind: string; priority: string }[];
 *   warnings: string[];
 * }>}
 */
export async function extractJd(jd) {
  const warnings = [];

  const isThin = jd.trim().length < 150;
  if (isThin) {
    warnings.push('thin_jd: job description is very short — requirements may be incomplete');
  }

  const prompt = buildJdExtractionPrompt(jd);
  let result;
  try {
    result = await generateStructured({ type: 'jd', prompt, useMock: false });
  } catch (err) {

    warnings.push(`jd_extraction_failed: ${err.message}`);
    return {
      title: '',
      seniority: 'Unknown',
      location: '',
      responsibilities: [],
      requirements: isThin
        ? [{ id: 'r1', text: 'Specific requirements not extractable from the description provided', kind: 'technical', priority: 'must' }]
        : [],
      warnings,
    };
  }


  const seen = new Set();
  let counter = 1;
  const requirements = (result.requirements ?? []).map((r) => {
    const id = seen.has(r.id) ? `r${counter++}` : r.id;
    seen.add(id);
    counter = Math.max(counter, Number(id.slice(1)) + 1);
    return {
      id,
      text: r.text ?? '',
      kind: ['technical', 'behavioural', 'domain'].includes(r.kind) ? r.kind : 'technical',
      priority: r.priority === 'nice' ? 'nice' : 'must',
    };
  });

  if (requirements.length === 0 && !isThin) {
    warnings.push('no_requirements_extracted: LLM returned no requirements');
  }

  return {
    title: result.title ?? '',
    seniority: result.seniority ?? 'Unknown',
    location: result.location ?? '',
    responsibilities: result.responsibilities ?? [],
    requirements,
    warnings,
  };
}
