import { describe, it, expect } from 'vitest';
import { findUncoveredRequirements } from '../src/pipeline/coverage.js';

const reqs = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
const q = (id, requirement_ids) => ({ id, requirement_ids });

describe('findUncoveredRequirements', () => {
  it('returns requirements that no question references', () => {
    expect(findUncoveredRequirements(reqs, [q('q1', ['r1'])])).toEqual(['r2', 'r3']);
  });

  it('counts a question that covers several requirements', () => {
    expect(findUncoveredRequirements(reqs, [q('q1', ['r1', 'r3'])])).toEqual(['r2']);
  });

  it('treats everything as uncovered when there are no questions', () => {
    expect(findUncoveredRequirements(reqs, [])).toEqual(['r1', 'r2', 'r3']);
  });

  it('returns nothing when there are no requirements', () => {
    expect(findUncoveredRequirements([], [q('q1', ['r1'])])).toEqual([]);
  });
});