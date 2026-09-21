

import * as cheerio from 'cheerio';
import { fetchPage } from './fetcher.js';
import { rankLinks } from './linkRanker.js';

const MAX_PAGES = 20;
const MAX_QUEUE = 60;
const PAGE_DELAY_MS = 300;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 
 * @param {string} html  Raw HTML string
 * @param {string} base  Base URL for resolving relative links
 * @returns {string[]}   Absolute URLs
 */
function extractLinks(html, base) {
  const $ = cheerio.load(html);
  const links = [];
  $('a[href]').each((_, el) => {
    try {
      const href = new URL($(el).attr('href'), base).href;

      const clean = new URL(href);
      clean.search = '';
      clean.hash = '';
      links.push(clean.href);
    } catch {

    }
  });
  return links;
}

/**
 * 
 */
const HIRING_PAGE_SIGNALS = [
  'interview process', 'hiring process', 'how we hire', 'application process',
  'recruitment process', 'interview stages', 'how to apply', 'selection process',
];

function looksLikeHiringPage(text, url) {
  const lower = (text + ' ' + url).toLowerCase();
  return HIRING_PAGE_SIGNALS.some((sig) => lower.includes(sig));
}

/**
 * 
 *
 * @param {string} startUrl  
 * @returns {Promise<{
 *   pages: { url: string; text: string }[];
 *   failed: { url: string; reason: string }[];
 *   hiringPageUrl: string | null;
 *   hiringPageText: string | null;
 * }>}
 */
export async function crawlSite(startUrl) {
  const pages = [];
  const failed = [];
  const seen = new Set();
  let hiringPageUrl = null;
  let hiringPageText = null;

  let origin;
  try {
    origin = new URL(startUrl).origin;
  } catch {
    return { pages, failed: [{ url: startUrl, reason: 'Invalid start URL' }], hiringPageUrl, hiringPageText };
  }


  const queue = [{ url: startUrl, score: 999 }];
  seen.add(startUrl);

  let fetched = 0;

  while (queue.length > 0 && fetched < MAX_PAGES) {

    const { url } = queue.shift();

    if (fetched > 0) await sleep(PAGE_DELAY_MS);

    const result = await fetchPage(url);
    fetched++;

    if (!result.ok) {
      failed.push({ url, reason: result.reason });
      continue;
    }

    pages.push({ url, text: result.text });


    if (!hiringPageUrl && looksLikeHiringPage(result.text, url)) {
      hiringPageUrl = url;
      hiringPageText = result.text;
    }


    const links = extractLinks(result.html, url);
    const ranked = rankLinks(links, origin);

    for (const { url: linkUrl, score } of ranked) {
      if (seen.has(linkUrl)) continue;
      if (queue.length >= MAX_QUEUE) break;
      seen.add(linkUrl);
      queue.push({ url: linkUrl, score });
      queue.sort((a, b) => b.score - a.score);
    }
  }

  return { pages, failed, hiringPageUrl, hiringPageText };
}
