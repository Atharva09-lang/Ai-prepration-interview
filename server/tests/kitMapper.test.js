import { describe, it, expect } from 'vitest';
import { kitToDocFields } from '../src/services/kitMapper.js';
import { makeKit } from './helpers/makeKit.js';

describe('kitToDocFields', () => {
  it('marks generated content as generated, unpinned and ordered', () => {
    const fields = kitToDocFields(makeKit());
    expect(fields.questions.map((q) => [q.origin, q.pinned, q.order])).toEqual([
      ['generated', false, 0],
      ['generated', false, 1],
      ['generated', false, 2],
    ]);
    expect(fields.company_brief.origin).toBe('generated');
  });

  it('sets id counters from the highest existing id so ids are never reused', () => {
    const kit = makeKit();
    kit.questions[2].id = 'q7';
    expect(kitToDocFields(kit).counters).toEqual({ r: 3, q: 7, f: 1 });
  });

  it('starts counters at zero for an empty kit', () => {
    const kit = makeKit();
    kit.role.requirements = [];
    kit.questions = [];
    kit.flashcards = [];
    expect(kitToDocFields(kit).counters).toEqual({ r: 0, q: 0, f: 0 });
  });
});