

import { fetchPage } from './fetcher.js';
import * as cheerio from 'cheerio';

const MAX_RESULTS = 3;
const SEARCH_TIMEOUT_MS = 8000;


function buildSearchUrl(companyName) {
  const query = encodeURIComponent(
    `"${companyName}" interview process site:glassdoor.com OR site:reddit.com OR site:blind.app OR site:levels.fyi`,
  );
  return `https://html.duckduckgo.com/html/?q=${query}`;
}


function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const links = [];
  $('a.result__url, a.result__a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    try {
      const parsed = new URL(href, 'https://html.duckduckgo.com');
      const uddg = parsed.searchParams.get('uddg');
      if (uddg) {
        links.push(decodeURIComponent(uddg));
      } else if (href.startsWith('http')) {
        links.push(href);
      }
    } catch {
    }
  });
  return [...new Set(links)].slice(0, MAX_RESULTS);
}

/**
 * 
 *
 * @param {string} companyName  Company name extracted from research or URL hostname
 * @returns {Promise<{ found: boolean; sources: string[]; snippets: string[] }>}
 */
export async function searchDiscussion(companyName) {
  if (!companyName) return { found: false, sources: [], snippets: [] };

  const searchUrl = buildSearchUrl(companyName);

  let searchResult;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SEARCH_TIMEOUT_MS);
    const res = await fetch(searchUrl, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; InterviewPrepBot/1.0)',
        Accept: 'text/html',
      },
    });
    clearTimeout(timer);
    if (!res.ok) return { found: false, sources: [], snippets: [] };
    searchResult = await res.text();
  } catch {
    return { found: false, sources: [], snippets: [] };
  }

  const resultUrls = parseSearchResults(searchResult);
  if (resultUrls.length === 0) return { found: false, sources: [], snippets: [] };


  const sources = [];
  const snippets = [];

  for (const url of resultUrls) {
    const page = await fetchPage(url);
    if (!page.ok || !page.text) continue;
    sources.push(url);

    snippets.push(page.text.slice(0, 500).trim());
  }

  return {
    found: sources.length > 0,
    sources,
    snippets,
  };
}
