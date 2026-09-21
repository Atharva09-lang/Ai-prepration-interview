export function buildBriefPrompt({
  company,
  role,
  research,
}) {
  return `
You are an interview preparation assistant.

Create a concise company brief for a candidate preparing for an interview.

COMPANY:
${JSON.stringify(company, null, 2)}

ROLE:
${JSON.stringify(role, null, 2)}

RESEARCH:
${JSON.stringify(research, null, 2)}

Rules:
1. Use only information supported by the provided research.
2. Do not invent company facts.
3. Keep the summary concise and interview-focused.
4. Explain what the company does in simple terms.
5. Highlight information that can help the candidate understand the company before an interview.
6. Include sources when they are available in the research.

Return JSON only in this format:

{
  "summary": "Concise company summary",
  "what_they_do": "What the company does",
  "sources": [
    {
      "title": "Source title",
      "url": "https://example.com"
    }
  ]
}
`.trim();
}