/**
 * generation/brief.js — generates the company brief using research context.
 */

import { generateStructured } from '../../llm/client.js';
import { buildBriefPrompt } from '../../llm/prompts/brief.js';

/**
 * Generates the company brief section of the kit.
 *
 * @param {{ companyName: string; pages: {url,text}[]; hiringProcess: object|null; discussionSnippets: string[] }} research
 * @param {{ title: string; seniority: string }} role
 * @returns {Promise<{ summary: string; what_they_do: string; sources: string[] }>}
 */
export async function generateBrief(research, role) {
  // Compose research context — cap page text to avoid token overflow
  const pageContext = research.pages
    .slice(0, 5)
    .map((p) => `[${p.url}]\n${p.text.slice(0, 800)}`)
    .join('\n\n');

  const researchContext = {
    company: research.companyName,
    pages_summary: pageContext || 'No pages could be retrieved.',
    discussion_snippets: research.discussionSnippets?.slice(0, 3) ?? [],
    hiring_process: research.hiringProcess ?? null,
  };

  const prompt = buildBriefPrompt({
    company: research.companyName,
    role: { title: role.title, seniority: role.seniority },
    research: researchContext,
  });

  try {
    const result = await generateStructured({ type: 'companyBrief', prompt, useMock: false });
    const sources = Array.isArray(result.sources)
      ? result.sources.map((s) => (typeof s === 'string' ? s : s?.url ?? '')).filter(Boolean)
      : research.pages.slice(0, 3).map((p) => p.url);

    return {
      summary: result.summary ?? '',
      what_they_do: result.what_they_do ?? '',
      sources,
    };
  } catch {
    // Honest fallback — no fabrication
    const noInfo = !research.pages.length && !research.discussionFound;
    return {
      summary: noInfo
        ? 'No information about this company could be retrieved from the provided URL.'
        : `${research.companyName || 'This company'} — brief could not be generated. Research pages: ${research.pagesUsed?.length ?? 0}.`,
      what_they_do: '',
      sources: research.pagesUsed?.slice(0, 3) ?? [],
    };
  }
}
