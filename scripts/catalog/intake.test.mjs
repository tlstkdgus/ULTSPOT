import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { schema, tabs } from './schema.mjs';
import { validate, readBundle, prepare } from './intake.mjs';

function fixture() {
  const b = Object.fromEntries(tabs.map((t) => [t, []]));
  b.artists.push({ artist_id: 'test-artist', entity_type: 'group', name_ko: '검증용 가상 데이터', name_en: "Test'); DROP SCHEMA public CASCADE; --", official_url: 'https://example.com', source_ids: ['test-source'] });
  b.sources.push({ source_id: 'test-source', target_type: 'artist', target_id: 'test-artist', supported_fields: ['name_ko'], url: 'https://example.com', publisher: 'Test', checked_at: '2026-09-19T12:00:00+09:00', review_status: 'pending', collection_method: 'manual', reuse_status: '미확인' });
  return b;
}
test('valid bundle preserves Korean, unknown facts and source arrays', () => {
  const b = fixture(), result = validate(b);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.bundle, b);
  assert.equal(result.warnings.length, 1);
});
test('missing tabs, unexpected fields, duplicate IDs and unresolved refs fail', () => {
  const b = fixture(); delete b.hours;
  b.artists.push({ ...b.artists[0], source_ids: ['absent'], private_phone: 'do not print' });
  const codes = validate(b).errors.map((e) => e.code);
  for (const code of ['expected_array_max_10000', 'unexpected_field', 'duplicate_id', 'unresolved_reference']) assert.ok(codes.includes(code));
  assert.ok(!JSON.stringify(validate(b).errors).includes('do not print'));
  b.sources[0].target_type = 'constructor';
  assert.ok(validate(b).errors.some((e) => e.code === 'invalid_target'));
});
test('invalid dates, timezones, unsafe URLs and enum values fail', () => {
  const b = fixture(); Object.assign(b.artists[0], { debut_date: '2026-02-30', official_url: 'https://user:password@example.com', entity_type: 'fake' });
  b.sources[0].checked_at = '2026-09-19';
  assert.equal(validate(b).errors.length, 4);
});
test('hours require explicit positive interval and valid schedule', () => {
  const b = fixture();
  b.hours.push({ hours_id: 'h', target_type: 'event', target_id: 'absent', schedule_type: 'date', date: '2026-02-29', state: 'open', opens: '22:00', closes: '02:00', timezone: 'Asia/Seoul', source_ids: ['test-source'] });
  assert.ok(validate(b).errors.some((e) => e.code === 'nonpositive_interval'));
  b.hours[0].close_day_offset = 1;
  assert.ok(!validate(b).errors.some((e) => e.code === 'nonpositive_interval'));
  b.hours[0].opens = '미확인';
  assert.ok(validate(b).errors.some((e) => e.code === 'open_requires_times'));
});
test('artist relationship cycles fail', () => {
  const b = fixture(); b.artists.push({ ...b.artists[0], artist_id: 'second' });
  b.artist_relations.push(...[['test-artist', 'second'], ['second', 'test-artist']].map(([parent_artist_id, child_artist_id], i) => ({ relation_id: `r${i}`, parent_artist_id, child_artist_id, relation_type: 'unit_of', source_ids: ['test-source'] })));
  assert.ok(validate(b).errors.some((e) => e.code === 'relation_cycle'));
});
test('digest is stable across object key ordering; changes produce new versions', () => {
  const b = fixture(), first = prepare(b, 'test');
  assert.equal(prepare(Object.fromEntries(Object.entries(b).reverse()), 'test').digest, first.digest);
  b.artists[0].name_en = 'Changed';
  assert.notEqual(prepare(b, 'test').digest, first.digest);
  assert.throws(() => prepare(b, "x'); --"));
});
test('CSV accepts BOM, quotes and multiline Korean; rejects duplicate headers', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ultspot-intake-'));
  try {
    for (const name of tabs) await writeFile(join(dir, `${name}.csv`), schema[name].required.join(',') + '\n');
    const path = join(dir, 'artists.csv');
    await writeFile(path, '\uFEFF' + schema.artists.required.join(',') + '\r\ntest,group,"한글,\n이름","A ""B""",https://example.com,s1|s2\r\n');
    const b = await readBundle(dir);
    assert.equal(b.artists[0].name_ko, '한글,\n이름');
    assert.deepEqual(validate(b).bundle.artists[0].source_ids, ['s1', 's2']);
    await writeFile(path, 'artist_id,artist_id\nx,x\n');
    await assert.rejects(readBundle(dir));
  } finally { await rm(dir, { recursive: true }); }
});
test('PostgreSQL stores exact data, idempotently stages, denies API roles and ties reviews to versions', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    await db.exec(await readFile('supabase/migrations/202609190002_catalog_intake.sql', 'utf8'));
    const b = fixture(), first = prepare(b, 'test');
    await db.exec(first.sql); await db.exec(first.sql);
    assert.equal((await db.query('select * from catalog_private.intake_versions')).rows.length, 1);
    assert.deepEqual((await db.query('select payload from catalog_private.intake_versions')).rows[0].payload, b);
    await db.query('insert into catalog_private.intake_reviews(batch_id,digest,decision,reviewer_alias,notes) values ($1,$2,$3,$4,$5)', ['test', first.digest, 'reviewed', 'tester', 'Test only']);
    b.artists[0].name_en = 'Changed'; await db.exec(prepare(b, 'test').sql);
    assert.equal((await db.query('select * from catalog_private.intake_versions')).rows.length, 2);
    assert.equal((await db.query('select * from catalog_private.intake_reviews')).rows.length, 1);
    await assert.rejects(db.query("insert into catalog_private.intake_reviews(batch_id,digest,decision,reviewer_alias,notes) values ('missing',$1,'reviewed','tester','test')", [first.digest]));
    await assert.rejects(db.exec("insert into catalog_private.intake_versions(batch_id,digest,payload_text) values ('tampered',repeat('0',64),'{}')"));
    for (const role of ['anon', 'authenticated', 'service_role']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from catalog_private.intake_versions'));
      await assert.rejects(db.query('select * from catalog_private.intake_reviews'));
      await db.exec('reset role');
    }
    assert.ok((await db.query("select schema_name from information_schema.schemata where schema_name='public'")).rows.length);
  } finally { await db.close(); }
});
