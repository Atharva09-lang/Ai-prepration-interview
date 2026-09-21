

import robotsParser from 'robots-parser';

const USER_AGENT = 'InterviewPrepBot/1.0';
const FETCH_TIMEOUT_MS = 5000;
const cache = new Map();

async function fetchRobots(baseUrl) {
  const robotsUrl = new URL('/robots.txt', baseUrl).href;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(robotsUrl, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    clearTimeout(timer);
    if (!res.ok) return robotsParser(robotsUrl, '');
    const text = await res.text();
    return robotsParser(robotsUrl, text);
  } catch {

    return robotsParser(robotsUrl, '');
  }
}

/**
 * Returns true if the given URL is allowed to be crawled.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function isAllowed(url) {
  try {
    const parsed = new URL(url);
    const origin = parsed.origin;
    if (!cache.has(origin)) {
      cache.set(origin, await fetchRobots(origin));
    }
    const robots = cache.get(origin);
    return robots.isAllowed(url, USER_AGENT) !== false;
  } catch {
    return true;
  }
}

export { USER_AGENT };
