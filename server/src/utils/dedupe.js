import crypto from 'node:crypto';

export const normalizeJd = (jd) => jd.replace(/\s+/g, ' ').trim();

export function normalizeUrl(raw) {
  const url = new URL(raw.trim());
  url.hash = '';
  return url.href.replace(/\/$/, '');
}


export function makeDedupeKey({ jd, company_url, days }) {
  const payload = [normalizeJd(jd), normalizeUrl(company_url), String(days)].join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}