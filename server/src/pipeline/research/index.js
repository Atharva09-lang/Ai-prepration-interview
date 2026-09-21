

import { crawlSite } from './crawler.js';
import { extractHiringProcess } from './hiringProcess.js';
import { searchDiscussion } from './discussion.js';
import { fetchPage } from './fetcher.js';


function companyNameFromUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname
      .replace(/^www\./, '')
      .split('.')[0]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return '';
  }
}

/**
 *
 *
 * @param {string} companyUrl
 * @param {{ onProgress?: (msg: string) => void }} opts
 * @returns {Promise<ResearchResult>}
 */
export async function runResearch(companyUrl, { onProgress = () => { } } = {}) {
  const companyName = companyNameFromUrl(companyUrl);


  onProgress('Fetching company homepage');
  const homePage = await fetchPage(companyUrl);
  if (!homePage.ok) {

    return buildEmptyResult(companyUrl, companyName, [{ url: companyUrl, reason: homePage.reason }]);
  }


  onProgress('Crawling company site');
  const { pages, failed, hiringPageUrl, hiringPageText } = await crawlSite(companyUrl);

  const pagesUsed = [homePage.url, ...pages.map((p) => p.url)];


  onProgress('Looking for hiring process page');
  let hiringProcess = null;
  let hiringPageFound = false;
  if (hiringPageText) {
    const hp = await extractHiringProcess(hiringPageText, hiringPageUrl);
    if (hp.found) {
      hiringProcess = hp;
      hiringPageFound = true;
    }
  }


  const allPageTexts = [
    { url: homePage.url, text: homePage.text },
    ...pages.slice(0, 8),
  ];


  onProgress('Searching for interview discussion');
  const discussion = await searchDiscussion(companyName);

  return {
    companyName,
    companyUrl,
    pages: allPageTexts,
    pagesUsed,
    pagesFailed: failed,
    hiringPageFound,
    hiringPageUrl: hiringPageUrl ?? null,
    hiringProcess,
    discussionFound: discussion.found,
    discussionSources: discussion.sources,
    discussionSnippets: discussion.snippets,
  };
}

function buildEmptyResult(companyUrl, companyName, pagesFailed) {
  return {
    companyName,
    companyUrl,
    pages: [],
    pagesUsed: [],
    pagesFailed,
    hiringPageFound: false,
    hiringPageUrl: null,
    hiringProcess: null,
    discussionFound: false,
    discussionSources: [],
    discussionSnippets: [],
  };
}

/**
 * @typedef {Object} ResearchResult
 * @property {string} companyName
 * @property {string} companyUrl
 * @property {{ url: string; text: string }[]} pages
 * @property {string[]} pagesUsed
 * @property {{ url: string; reason: string }[]} pagesFailed
 * @property {boolean} hiringPageFound
 * @property {string|null} hiringPageUrl
 * @property {{ found: boolean; summary: string; stages: string[] }|null} hiringProcess
 * @property {boolean} discussionFound
 * @property {string[]} discussionSources
 * @property {string[]} discussionSnippets
 */
