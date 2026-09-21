

import * as cheerio from 'cheerio';
import { guardUrl } from './urlGuard.js';
import { isAllowed, USER_AGENT } from './robots.js';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 512 * 1024; // 512 KB
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


export function htmlToText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, nav, footer, header').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

/**
 * 
 * 
 *
 * @param {string} rawUrl
 * @returns {Promise<{ok:boolean, url:string, html:string, text:string, reason:string|null}>}
 */
export async function fetchPage(rawUrl) {

  let parsed;
  try {
    parsed = guardUrl(rawUrl);
  } catch (err) {
    return { ok: false, url: rawUrl, html: '', text: '', reason: err.message };
  }

  const url = parsed.href;


  const allowed = await isAllowed(url);
  if (!allowed) {
    return { ok: false, url, html: '', text: '', reason: 'Disallowed by robots.txt' };
  }


  let lastReason = '';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      clearTimeout(timer);


      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') ?? RETRY_BASE_MS / 1000);
        const delay = Math.min(retryAfter * 1000, 30_000);
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
        lastReason = 'Rate limited (429)';
        break;
      }

      if (!res.ok) {
        lastReason = `HTTP ${res.status}`;
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await sleep(RETRY_BASE_MS * 2 ** attempt);
          continue;
        }
        break;
      }


      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('html') && !ct.includes('text')) {
        return { ok: false, url, html: '', text: '', reason: `Unexpected content-type: ${ct}` };
      }


      const reader = res.body?.getReader();
      if (!reader) {
        const html = await res.text();
        const text = htmlToText(html);
        return { ok: true, url, html, text, reason: null };
      }

      const chunks = [];
      let totalBytes = 0;
      let truncated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > MAX_BYTES) {
          truncated = true;

          const remaining = MAX_BYTES - (totalBytes - value.byteLength);
          chunks.push(value.slice(0, remaining));
          reader.cancel();
          break;
        }
        chunks.push(value);
      }

      const html = new TextDecoder().decode(
        chunks.reduce((acc, c) => {
          const merged = new Uint8Array(acc.byteLength + c.byteLength);
          merged.set(acc, 0);
          merged.set(c, acc.byteLength);
          return merged;
        }, new Uint8Array(0)),
      );
      const text = htmlToText(html);
      return { ok: true, url, html, text, reason: truncated ? 'truncated at 512KB' : null };
    } catch (err) {
      lastReason = err.name === 'AbortError' ? 'Timed out after 10s' : err.message;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_MS * 2 ** attempt);
      }
    }
  }

  return { ok: false, url, html: '', text: '', reason: lastReason || 'Unknown fetch error' };
}
