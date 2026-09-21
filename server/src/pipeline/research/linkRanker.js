
const HIRING_KEYWORDS = [
  'hiring', 'interview', 'how-we-hire', 'recruiting', 'recruitment',
  'careers', 'jobs', 'positions', 'openings', 'work-with-us', 'join-us', 'join',
  'handbook', 'engineering-blog', 'engineering', 'blog', 'culture', 'life',
  'about', 'team', 'people', 'company', 'mission', 'values',
  'faq', 'process',
];


const KEYWORD_SCORE = Object.fromEntries(
  HIRING_KEYWORDS.map((kw, i) => [kw, HIRING_KEYWORDS.length - i]),
);


export function scoreLink(href) {
  let score = 0;
  let normalized;
  try {
    normalized = new URL(href).pathname.toLowerCase().replace(/[-_/]/g, ' ');
  } catch {
    return 0;
  }

  for (const [kw, s] of Object.entries(KEYWORD_SCORE)) {
    if (normalized.includes(kw.replace(/-/g, ' '))) {
      score += s;
    }
  }


  const depth = new URL(href).pathname.split('/').filter(Boolean).length;
  score -= depth * 0.5;

  return score;
}

/**
 * 
 *
 * @param {string[]} links   Array of absolute URL strings.
 * @param {string}   origin  The base origin — cross-origin links are deprioritised.
 * @returns {{ url: string; score: number }[]}  Sorted descending by score, score > 0 only.
 */
export function rankLinks(links, origin) {
  const seen = new Set();
  const scored = [];

  for (const href of links) {
    if (seen.has(href)) continue;
    seen.add(href);

    let s = scoreLink(href);
    if (s <= 0) continue;


    try {
      if (new URL(href).origin === origin) s += 2;
    } catch {
      // ignore
    }

    scored.push({ url: href, score: s });
  }

  return scored.sort((a, b) => b.score - a.score);
}
