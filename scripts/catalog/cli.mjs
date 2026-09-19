import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readBundle, validate, prepare } from './intake.mjs';

const [command, path, batchId] = process.argv.slice(2);
try {
  if (!['check', 'prepare'].includes(command) || !path || (command === 'prepare' && !batchId)) throw new Error('Usage: pnpm data:check <JSON file or CSV folder> | pnpm data:prepare <path> <batch-id>');
  const bundle = await readBundle(path);
  const result = validate(bundle);
  console.log(JSON.stringify({ errors: result.errors, warnings: result.warnings, counts: Object.fromEntries(Object.entries(result.bundle).map(([name, rows]) => [name, rows.length])) }, null, 2));
  if (result.errors.length) process.exitCode = 1;
  else if (command === 'prepare') {
    const prepared = prepare(bundle, batchId);
    await mkdir('.local-data/prepared', { recursive: true });
    const file = join('.local-data/prepared', `${batchId}-${prepared.digest.slice(0, 12)}.sql`);
    await writeFile(file, prepared.sql, { flag: 'wx' });
    console.log(`Private staging SQL: ${file}\nSHA256: ${prepared.digest}\nHuman review required. Nothing was uploaded or published.`);
  }
} catch (error) {
  // Parser errors may quote private input. Keep terminal output free of row contents.
  console.error(`Intake failed (${error.code || error.name}). Check input format, path and command arguments. No upload performed.`);
  process.exitCode = 1;
}
