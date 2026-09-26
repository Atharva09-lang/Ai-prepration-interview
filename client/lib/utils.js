import { clsx } from 'clsx';

/** Tailwind-friendly conditional class joiner. */
export function cn(...inputs) {
  return clsx(inputs);
}

// In production the browser calls this app's own origin and Next.js proxies
// /api/* to the API (see next.config.mjs) so the session cookie stays
// first-party. In development we hit the API host directly.
export const API_URL =
  process.env.NODE_ENV === 'production'
    ? ''
    : process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function relativeTime(value) {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function minutesLabel(minutes) {
  if (!minutes) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const CATEGORY_LABEL = {
  technical: 'Technical',
  behavioural: 'Behavioural',
  'system-design': 'System design',
  'company-fit': 'Company fit',
};

export const KIND_LABEL = {
  technical: 'Technical',
  behavioural: 'Behavioural',
  domain: 'Domain',
};

export const DOMAIN_LABEL = {
  software: 'Software / IT',
  marketing: 'Marketing',
  finance: 'Finance',
  hr: 'HR',
  sales: 'Sales',
  'data-analyst': 'Data Analyst',
};

// Domains with no system-design interview round — the section is hidden for them.
export const NON_SOFTWARE_DOMAINS = new Set(['marketing', 'finance', 'hr', 'sales', 'data-analyst']);

export const DIFFICULTY_LABEL = {
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
};

export function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url || '';
  }
}

/** Greeting based on local time, used on the dashboard header. */
export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Consecutive days with at least one flashcard review, ending today or
 * yesterday. Day keys are UTC `YYYY-MM-DD` strings, matching the ones the API
 * sends in each kit's `progress.practice_days`.
 */
export function practiceStreak(kits) {
  const days = new Set();
  for (const kit of kits ?? []) {
    for (const day of kit.progress?.practice_days ?? []) days.add(day);
  }
  if (days.size === 0) return 0;

  const DAY = 86400000;
  const key = (ms) => new Date(ms).toISOString().slice(0, 10);

  let cursor = Date.now();
  if (!days.has(key(cursor))) {
    cursor -= DAY; // a streak stays alive until the end of the day after the last review
    if (!days.has(key(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(key(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}
