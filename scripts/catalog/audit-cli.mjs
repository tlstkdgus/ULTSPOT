import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { auditCollection } from './audit.mjs';

try {
  const [input, name, asOf] = process.argv.slice(2);
  if (!input || !name || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(name) || !asOf) throw new Error('Usage: pnpm data:audit <CSV directory> <receipt-id> <YYYY-MM-DD>');
  const result = await auditCollection(input, asOf);
  const parent = resolve('.local-data/audits');
  await mkdir(parent, { recursive: true });
  const output = join(parent, name);
  await mkdir(output); // Refuse to overwrite earlier receipts.
  for (const [key, value] of Object.entries(result)) await writeFile(join(output, `${key}.json`), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, counts: result.report.counts, errors: result.report.errors.length, errorCounts: result.report.errorCounts, publication: 'hold' }, null, 2));
} catch (error) {
  console.error(`Audit failed (${error.code || error.name}). Check CSV headers, arguments and output directory. No upload performed.`);
  process.exitCode = 1;
}
