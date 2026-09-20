import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

const { values } = parseArgs({
  options: { input: { type: 'string' }, output: { type: 'string' } },
});

if (!values.input || !values.output) {
  console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
  process.exit(2);
}

const cases = JSON.parse(await readFile(values.input, 'utf8'));
if (!Array.isArray(cases)) {
  console.error('Input must be a JSON array of cases');
  process.exit(2);
}

const kits = cases.map((c) => ({
  id: c.id,
  status: 'failed',
  kit: null,
  error: { code: 'NOT_IMPLEMENTED', message: 'Pipeline not wired yet' },
}));

await writeFile(
  values.output,
  JSON.stringify({ version: '1.0', generated_at: new Date().toISOString(), kits }, null, 2),
);
console.log(`[evaluate] wrote ${kits.length} entries to ${values.output}`);