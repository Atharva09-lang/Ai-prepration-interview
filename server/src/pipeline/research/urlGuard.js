

import { isProduction } from '../../config/env.js';


const BLOCKED_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./, // link-local
  /^0\./, // this network
];

const BLOCKED_HOSTS = new Set(['localhost', '::1', '0.0.0.0', '[::1]']);

function isPrivateIp(hostname) {
  if (BLOCKED_HOSTS.has(hostname)) return true;
  return BLOCKED_RANGES.some((re) => re.test(hostname));
}

/**
 * Validates and normalises a URL string.
 * Returns the parsed URL or throws with a descriptive message.
 *
 * @param {string} raw  The raw URL string.
 * @returns {URL}
 */
export function guardUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  const { protocol, hostname } = parsed;

  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${protocol}" — only http/https allowed`);
  }


  if (isProduction && isPrivateIp(hostname)) {
    throw new Error(`Blocked private/loopback address: ${hostname}`);
  }

  return parsed;
}


export function isSafeUrl(raw) {
  try {
    guardUrl(raw);
    return true;
  } catch {
    return false;
  }
}
