import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schema, tabs } from './schema.mjs';
import { auditCollection } from './audit.mjs';
import { readBundle } from './intake.mjs';

test('receipt preserves raw notes and ambiguous dates, normalizes only explicit aliases', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ultspot-audit-'));
  try {
    for (const tab of tabs) await writeFile(join(dir, `${tab}.csv`), schema[tab].required.join(',') + '\n');
    const path = join(dir, 'artist_relations.csv');
    const csv = schema.artist_relations.required.join(',') + ',status,valid_from,row_note\nr1,g,p,member_of,s1,현재,2026,"한글, 메모"\n';
    await writeFile(path, csv);
    const extra = '\uFEFFtab,before,after\r\nartists,old,new\r\n';
    await writeFile(join(dir, 'changelog.csv'), extra);
    const { report, original, candidate, sidecar } = await auditCollection(dir, '2026-09-19');
    assert.equal(original.artist_relations[0].status, '현재');
    assert.equal(candidate.artist_relations[0].status, 'current');
    assert.equal(candidate.artist_relations[0].valid_from, '2026');
    assert.equal(sidecar.artist_relations[0].fields.row_note, '한글, 메모');
    assert.ok(!report.errors.some((e) => e.code === 'invalid_partial_date'));
    assert.equal(report.publication, 'hold');
    assert.equal(report.files.find((f) => f.tab === 'artist_relations').sha256.length, 64);
    assert.equal(await readFile(path, 'utf8'), csv);
    assert.equal(Buffer.from(sidecar.supplementalFiles[0].content, 'base64').toString('utf8'), extra);
    assert.equal(report.supplementalFiles[0].sha256.length, 64);
    assert.equal(candidate.changelog, undefined);
    await assert.rejects(readBundle(dir), /Unsupported CSV/);
    assert.deepEqual((await auditCollection(dir, '2026-09-19')).report, report);
  } finally { await rm(dir, { recursive: true }); }
});

test('invalid audit date and duplicate headers reject the receipt', async () => {
  await assert.rejects(auditCollection('unused', '2026-02-30'));
  const dir = await mkdtemp(join(tmpdir(), 'ultspot-audit-'));
  try {
    await writeFile(join(dir, 'artists.csv'), 'artist_id,artist_id\na,b\n');
    await assert.rejects(auditCollection(dir, '2026-09-19'));
  } finally { await rm(dir, { recursive: true }); }
});
