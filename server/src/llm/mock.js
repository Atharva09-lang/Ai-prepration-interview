const mockResponses = {
  companyBrief: {
    summary: 'Mock company summary for development and testing.',
    what_they_do: 'Mock description of what the company does.',
    sources: [],
  },

  requirements: {
    title: 'Backend Engineer',
    seniority: 'Entry-level',
    domain: 'software',
    responsibilities: [
      'Develop and maintain backend services',
      'Work with APIs and databases',
    ],
    requirements: [
      {
        id: 'r1',
        text: 'Experience with Node.js',
        kind: 'technical',
        priority: 'must',
      },
      {
        id: 'r2',
        text: 'Experience with databases',
        kind: 'technical',
        priority: 'must',
      },
    ],
  },

  questions: [
    {
      id: 'q1',
      requirement_ids: ['r1'],
      category: 'technical',
      prompt: 'How does Node.js handle asynchronous operations?',
      answer_outline:
        'Explain the event loop, callbacks, promises, async/await, and non-blocking I/O.',
      difficulty: 2,
    },
    {
      id: 'q2',
      requirement_ids: ['r2'],
      category: 'technical',
      prompt: 'How would you design a database for a backend application?',
      answer_outline:
        'Discuss entities, relationships, indexes, normalization, transactions, and query performance.',
      difficulty: 2,
    },
  ],

  flashcards: [
    {
      id: 'f1',
      front: 'What is the Node.js event loop?',
      back: 'It allows Node.js to perform non-blocking asynchronous operations by coordinating callbacks and I/O tasks.',
      requirement_ids: ['r1'],
    },
    {
      id: 'f2',
      front: 'Why are database indexes useful?',
      back: 'Indexes allow the database to find rows more efficiently without scanning the entire table.',
      requirement_ids: ['r2'],
    },
  ],
};

export async function mockGenerate(type) {
  if (!(type in mockResponses)) {
    throw new Error(`Unknown mock generation type: ${type}`);
  }

  return structuredClone(mockResponses[type]);
}