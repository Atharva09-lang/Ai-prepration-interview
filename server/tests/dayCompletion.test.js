import { describe, it, expect } from 'vitest';
import { normalizeCompletedDays } from '../src/services/practice.service.js';

describe('normalizeCompletedDays', () => {
  it('sorts and de-duplicates day numbers', () => {
    expect(normalizeCompletedDays([3, 1, 3, 2], 5)).toEqual([1, 2, 3]);
  });

  it('drops days beyond the current schedule length', () => {
    // Day numbers go stale when the schedule is rebuilt with fewer days
    expect(normalizeCompletedDays([1, 4, 9], 3)).toEqual([1]);
  });

  it('drops values that are not positive integers', () => {
    expect(normalizeCompletedDays([0, -1, 1.5, '2', null, 2], 4)).toEqual([2]);
  });

  it('returns [] for a missing value or an unknown schedule length', () => {
    expect(normalizeCompletedDays(undefined, 3)).toEqual([]);
    expect(normalizeCompletedDays([1, 2], undefined)).toEqual([]);
  });
});
