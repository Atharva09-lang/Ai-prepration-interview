/**
 * scripts/evaluate.js — mandatory batch entry point (brief §9).
 *
 *   npm run evaluate -- --input <cases.json> --output <kits.json>
 *
 * Reads an array of cases ({ id, jd, company_url, days }), runs the SAME
 * retrieval → generation → validation pipeline the web app uses
 * (pipeline/runPipeline.js, invoked here exactly as services/jobRunner.js
 * does), and writes one Appendix B document.
 *
 * Guarantees required by the brief:
 *  - Uses each case's own `days` when building the schedule.
 *  - Continues after a case fails, recording the failure instead of aborting.
 *  - A case we could only partially research is still "ok" (runPipeline treats
 *    an unreachable site / missing hiring page as non-fatal and reports it
 *    honestly inside the kit). "failed" is reserved for cases that produced no
 *    kit at all.
 *  - Reads credentials from env (see .env.example); with no key it falls back
 *    to the deterministic mock, so it runs from a clean clone.
 *  - Retrieval never assumes a host: company_url may be a local address, and
 *    relative links are followed by the crawler.
 */

import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

import { runPipeline } from '../src/pipeline/runPipeline.js';
import { AppError } from '../src/utils/AppError.js';

const { values } = parseArgs({
  options: { input: { type: 'string' }, output: { type: 'string' } },
});

if (!values.input || !values.output) {
  console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
  process.exit(2);
}

/** Returns a human-readable problem with the case, or null if it is well-formed. */
function validateCase(c) {
  if (!c || typeof c !== 'object') return 'case must be an object';
  if (typeof c.id !== 'string' || c.id.length === 0) return 'case.id must be a non-empty string';
  if (typeof c.jd !== 'string') return 'case.jd must be a string';
  if (typeof c.company_url !== 'string' || c.company_url.length === 0) {
    return 'case.company_url must be a non-empty string';
  }
  if (!Number.isInteger(c.days) || c.days < 1) return 'case.days must be a positive integer';
  return null;
}

/** Normalises a thrown value into the Appendix B error shape. */
function toError(err) {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  return { code: 'PIPELINE_FAILED', message: err?.message ?? 'Unknown error' };
}

async function runCase(c) {
  const problem = validateCase(c);
  if (problem) {
    return {
      id: typeof c?.id === 'string' ? c.id : null,
      status: 'failed',
      kit: null,
      error: { code: 'INVALID_CASE', message: problem },
    };
  }

  try {
    const kit = await runPipeline({ jd: c.jd, company_url: c.company_url, days: c.days });
    return { id: c.id, status: 'ok', kit, error: null };
  } catch (err) {
    return { id: c.id, status: 'failed', kit: null, error: toError(err) };
  }
}

let cases;
try {
  cases = JSON.parse(await readFile(values.input, 'utf8'));
} catch (err) {
  console.error(`[evaluate] could not read/parse input "${values.input}": ${err.message}`);
  process.exit(2);
}

if (!Array.isArray(cases)) {
  console.error('[evaluate] input must be a JSON array of cases');
  process.exit(2);
}

// Run sequentially, not in parallel: free-tier LLM providers limit tokens per
// minute, so fanning cases out at once is the quickest way to trip 429s. One at
// a time keeps the run inside the 5-cases-in-15-minutes budget even with the
// client's built-in retries.
const kits = [];
for (let i = 0; i < cases.length; i++) {
  const label = typeof cases[i]?.id === 'string' ? cases[i].id : `#${i}`;
  console.log(`[evaluate] (${i + 1}/${cases.length}) running ${label}`);
  const result = await runCase(cases[i]);
  console.log(`[evaluate] (${i + 1}/${cases.length}) ${label} → ${result.status}`);
  kits.push(result);
}

const output = {
  version: '1.0',
  generated_at: new Date().toISOString(),
  kits,
};

await writeFile(values.output, JSON.stringify(output, null, 2));

const ok = kits.filter((k) => k.status === 'ok').length;
console.log(`[evaluate] wrote ${kits.length} entries (${ok} ok, ${kits.length - ok} failed) to ${values.output}`);
