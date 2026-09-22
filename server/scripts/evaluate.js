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