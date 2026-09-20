import { describe, it, expect } from 'vitest';
import { makeDedupeKey, normalizeUrl } from '../src/utils/dedupe.js';

const base = { jd: 'Senior Backend Engineer\nNode.js required', company_url: 'https://Acme.com/', days: 5 };

describe('makeDedupeKey', () => {
  it('is the same for the same posting despite whitespace and URL formatting', () => {
    const other = {
      jd: '  Senior Backend   Engineer Node.js required ',
      company_url: 'https://acme.com',
      days: 5,
    };
    expect(makeDedupeKey(base)).toBe(makeDedupeKey(other));
  });

  it('differs when the number of days differs', () => {
    expect(makeDedupeKey(base)).not.toBe(makeDedupeKey({ ...base, days: 6 }));
  });

  it('differs when the job description differs', () => {
    expect(makeDedupeKey(base)).not.toBe(makeDedupeKey({ ...base, jd: 'Something else entirely' }));
  });
});

describe('normalizeUrl', () => {
  it('drops the fragment and trailing slash', () => {
    expect(normalizeUrl('http://localhost:8099/acme/#team')).toBe('http://localhost:8099/acme');
  });
});