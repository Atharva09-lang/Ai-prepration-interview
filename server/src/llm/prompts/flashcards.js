export function buildFlashcardsPrompt({
  requirements,
  questions,
}) {
  return `
You are an interview preparation assistant.

Create concise interview flashcards based on the requirements and interview questions below.

REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

QUESTIONS:
${JSON.stringify(questions, null, 2)}

Rules:
1. Flashcards must help the candidate revise important interview concepts quickly.
2. Each flashcard must reference one or more requirement IDs.
3. Keep the front concise and answerable from memory.
4. The back should contain the key answer or explanation.
5. Avoid duplicate flashcards.
6. Focus on concepts, facts, approaches, and interview-relevant knowledge.
7. Do not invent requirements that are not present in the input.
8. Use sequential IDs: f1, f2, f3, etc.

Return JSON only in this format:

{
  "flashcards": [
    {
      "id": "f1",
      "front": "What is ...?",
      "back": "Concise explanation...",
      "requirement_ids": ["r1"]
    }
  ]
}
`.trim();
}