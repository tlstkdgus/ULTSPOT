/**
 * Runs supabase/migrations/202609200002_on_site_records.sql on a real Postgres (PGlite) so the
 * constraints, row level security and point functions are checked before anyone applies the file
 * to the hosted project. We cannot reach the hosted database from here, so this is the evidence
 * that the SQL works; it is not a substitute for the two-browser check in docs/setup-cloud-trips.md.
 *
 * Supabase supplies auth.users and auth.uid(). Here auth.uid() reads a session setting so a test
 * can act as a specific signed-in user, which is what the policies are written against.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await db.exec(await readFile('supabase/migrations/202609190001_guest_trips.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/202609200002_on_site_records.sql', 'utf8'));
  await db.query('insert into auth.users(id) values ($1), ($2)', [ALICE, BOB]);
  return db;
}

/** Act as a signed-in user, the way a browser using the publishable key does. */
const as = (db, uid) => db.exec(`reset role; set app.uid = '${uid}'; set role authenticated;`);
const admin = db => db.exec('reset role;');
const rows = async (db, sql, params) => (await db.query(sql, params)).rows;

test('a place id must be a reviewed catalog slug, not a place that lives in one browser', async () => {
  const db = await database();
  await as(db, ALICE);
  for (const bad of ['custom-1758000000', 'personal-abc', 'HiKR-Ground', 'hikr ground', '-hikr', 'hikr--ground']) {
    await assert.rejects(
      db.query('select public.record_checkin($1, $2)', [bad, 'manual']),
      /reviewed_place_id/,
      `${bad} should not be accepted as a place id`,
    );
  }
  await db.query('select public.record_checkin($1, $2)', ['hikr-ground', 'manual']);
  assert.equal((await rows(db, 'select count(*)::int as n from public.place_checkins'))[0].n, 1);
  await db.close();
});

test('a gps check-in carries its measured distance and a manual one never invents one', async () => {
  const db = await database();
  await as(db, ALICE);
  await db.query('select public.record_checkin($1, $2, $3)', ['hikr-ground', 'gps', 180]);
  assert.deepEqual(
    await rows(db, 'select source, distance_m from public.place_checkins'),
    [{ source: 'gps', distance_m: 180 }],
  );
  // gps without a distance, and manual with one, are both refused rather than stored as a guess.
  await assert.rejects(db.query('select public.record_checkin($1, $2)', ['music-korea', 'gps']), /place_checkins_check/);
  await assert.rejects(db.query('select public.record_checkin($1, $2, $3)', ['music-korea', 'manual', 40]), /place_checkins_check/);
  await assert.rejects(db.query('select public.record_checkin($1, $2)', ['music-korea', 'teleport']), /place_checkins_source_check/);
  await db.close();
});

test('checking in pays once a day, and deleting the check-in does not reopen the payment', async () => {
  const db = await database();
  await as(db, ALICE);
  const first = (await rows(db, 'select * from public.record_checkin($1, $2)', ['hikr-ground', 'manual']))[0];
  assert.equal(first.checked_in_on.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));
  assert.equal(first.points_awarded, 10);
  assert.equal(first.balance, 10);
  // Same place, same day: the visit is already recorded and nothing more is paid.
  const again = (await rows(db, 'select * from public.record_checkin($1, $2)', ['hikr-ground', 'manual']))[0];
  assert.equal(again.points_awarded, 0);
  assert.equal(again.balance, 10);
  await db.query('delete from public.place_checkins where place_id = $1', ['hikr-ground']);
  assert.equal((await rows(db, 'select count(*)::int as n from public.place_checkins'))[0].n, 0);
  // The ledger is append-only, so the earlier award survives and cannot be earned again.
  assert.equal((await rows(db, 'select * from public.record_checkin($1, $2)', ['hikr-ground', 'manual']))[0].points_awarded, 0);
  assert.equal((await rows(db, 'select coalesce(sum(points),0)::int as n from public.point_ledger'))[0].n, 10);
  // A different place is a different award.
  assert.equal((await rows(db, 'select * from public.record_checkin($1, $2)', ['music-korea', 'manual']))[0].balance, 20);
  await db.close();
});

test('sharing a place update pays once, and correcting it the same day pays nothing extra', async () => {
  const db = await database();
  await as(db, ALICE);
  assert.deepEqual(
    await rows(db, 'select * from public.record_status_report($1, $2, $3)', ['hikr-ground', 'short', 'few']),
    [{ points_awarded: 20, balance: 20 }],
  );
  assert.deepEqual(
    (await rows(db, 'select * from public.record_status_report($1, $2, $3)', ['hikr-ground', 'long', 'none']))[0],
    { points_awarded: 0, balance: 20 },
  );
  await assert.rejects(db.query('select public.record_status_report($1, $2, $3)', ['hikr-ground', 'busy', 'few']), /waiting_check/);
  await assert.rejects(db.query('select public.record_status_report($1, $2, $3)', ['hikr-ground', 'short', 'maybe']), /perks_check/);
  // The correction is kept; only the payment is refused. Read as an administrator, because a
  // signed-in client has no select privilege on this table at all.
  await admin(db);
  assert.deepEqual(
    await rows(db, 'select waiting, perks from public.place_status_reports'),
    [{ waiting: 'long', perks: 'none' }],
  );
  await db.close();
});

test('a browser cannot write its own points and cannot read anyone else\'s', async () => {
  const db = await database();
  await as(db, ALICE);
  await db.query('select public.record_checkin($1, $2)', ['hikr-ground', 'manual']);
  // No insert privilege at all: the reward values live in the functions, not in the client.
  await assert.rejects(
    db.query("insert into public.point_ledger(owner_id, reason, points, place_id) values ($1, 'checkin', 500, 'music-korea')", [ALICE]),
    /permission denied/,
  );
  await assert.rejects(db.query('update public.point_ledger set points = 500'), /permission denied/);
  await assert.rejects(db.query('delete from public.point_ledger'), /permission denied/);
  await as(db, BOB);
  assert.deepEqual(await rows(db, 'select * from public.point_ledger'), []);
  await db.close();
});

test('status reports are never read row by row, only as counts for places open to you', async () => {
  const db = await database();
  await as(db, ALICE);
  await db.query('select public.record_status_report($1, $2, $3)', ['hikr-ground', 'short', 'few']);
  await as(db, BOB);
  // Bob may write his own row but has no select privilege, so owner_id cannot leak.
  await assert.rejects(db.query('select * from public.place_status_reports'), /permission denied/);
  await db.query('select public.record_status_report($1, $2, $3)', ['hikr-ground', 'short', 'few']);
  await db.query('select public.record_checkin($1, $2)', ['hikr-ground', 'manual']);
  // Bob checked in at hikr-ground, so it is open to him and he sees both reports as one count.
  assert.deepEqual(
    await rows(db, 'select * from public.place_status_summary($1)', [['hikr-ground']]),
    [{ place_id: 'hikr-ground', open_to_me: true, waiting: 'short', perks: 'few', reports: 2 }],
  );
  // He has not been to k-star-road, so it comes back locked rather than looking empty.
  assert.deepEqual(
    await rows(db, 'select * from public.place_status_summary($1)', [['k-star-road']]),
    [{ place_id: 'k-star-road', open_to_me: false, waiting: null, perks: null, reports: 0 }],
  );
  await assert.rejects(db.query('select * from public.place_status_summary($1)', [[]]), /1 to 50 places/);
  await assert.rejects(
    db.query('select * from public.place_status_summary($1)', [[...Array(51).keys()].map(n => `place-${n}`)]),
    /1 to 50 places/,
  );
  await db.close();
});

test('yesterday counts and older reports do not, so a stale queue length is never shown', async () => {
  const db = await database();
  await as(db, ALICE);
  await db.query('select public.record_checkin($1, $2)', ['hikr-ground', 'manual']);
  await admin(db);
  await db.query(
    `insert into public.place_status_reports(owner_id, place_id, reported_on, waiting, perks)
     values ($1, 'hikr-ground', current_date - 1, 'long', 'none'), ($1, 'hikr-ground', current_date - 3, 'none', 'plenty')`,
    [BOB],
  );
  await as(db, ALICE);
  assert.deepEqual(
    await rows(db, 'select * from public.place_status_summary($1)', [['hikr-ground']]),
    [{ place_id: 'hikr-ground', open_to_me: true, waiting: 'long', perks: 'none', reports: 1 }],
  );
  await db.close();
});

test('opening another place costs points once, and a place you visited is already open', async () => {
  const db = await database();
  await as(db, ALICE);
  await db.query('select public.record_checkin($1, $2)', ['hikr-ground', 'manual']);
  await assert.rejects(db.query('select public.unlock_place($1)', ['k-star-road']), /need 20 more points/);
  await assert.rejects(db.query('select public.unlock_place($1)', ['hikr-ground']), /already open to you/);
  await db.query('select public.record_status_report($1, $2, $3)', ['hikr-ground', 'short', 'few']);
  assert.equal((await rows(db, 'select public.unlock_place($1) as balance', ['k-star-road']))[0].balance, 0);
  assert.equal((await rows(db, 'select * from public.place_status_summary($1)', [['k-star-road']]))[0].open_to_me, true);
  // Charged once ever, even with plenty of points to spare.
  await db.query('select public.record_checkin($1, $2)', ['music-korea', 'manual']);
  await db.query('select public.record_status_report($1, $2, $3)', ['music-korea', 'none', 'plenty']);
  assert.equal((await rows(db, 'select coalesce(sum(points),0)::int as n from public.point_ledger'))[0].n, 30);
  await assert.rejects(db.query('select public.unlock_place($1)', ['k-star-road']), /already open to you/);
  assert.equal((await rows(db, 'select coalesce(sum(points),0)::int as n from public.point_ledger'))[0].n, 30);
  // The unique index is the hard guarantee behind that message, not the message itself.
  await admin(db);
  await assert.rejects(
    db.query("insert into public.point_ledger(owner_id, reason, points, place_id) values ($1, 'unlock', -30, 'k-star-road')", [ALICE]),
    /point_ledger_one_unlock_per_place/,
  );
  await db.close();
});

test('spending stays with its owner, in whole won, and cannot grow without limit', async () => {
  const db = await database();
  await as(db, ALICE);
  await db.query(
    "insert into public.expenses(owner_id, place_id, spent_on, amount_krw, label) values ($1, 'hikr-ground', current_date, 8500, 'Cup sleeve set')",
    [ALICE],
  );
  // Writing a row for somebody else is refused by the insert policy, not just by convention.
  await assert.rejects(
    db.query("insert into public.expenses(owner_id, spent_on, amount_krw) values ($1, current_date, 1000)", [BOB]),
    /row-level security/,
  );
  for (const bad of [0, -100, 100000001, 1.5]) {
    await assert.rejects(
      db.query('insert into public.expenses(owner_id, spent_on, amount_krw) values ($1, current_date, $2)', [ALICE, bad]),
      /amount_krw|invalid input syntax/,
    );
  }
  await as(db, BOB);
  assert.deepEqual(await rows(db, 'select * from public.expenses'), []);
  await as(db, ALICE);
  const before = (await rows(db, 'select updated_at from public.expenses'))[0].updated_at;
  await db.query("update public.expenses set amount_krw = 9000 where place_id = 'hikr-ground'");
  const after = (await rows(db, 'select amount_krw, updated_at from public.expenses'))[0];
  assert.equal(after.amount_krw, 9000);
  assert.ok(after.updated_at >= before, 'updating an expense should touch updated_at');
  await db.close();
});

test('the spending ceiling is enforced by the database, not by the screen', async () => {
  const db = await database();
  await admin(db);
  await db.query(
    `insert into public.expenses(owner_id, spent_on, amount_krw)
     select $1, current_date, 1000 from generate_series(1, 1999)`,
    [ALICE],
  );
  await as(db, ALICE);
  await db.query('insert into public.expenses(owner_id, spent_on, amount_krw) values ($1, current_date, 1000)', [ALICE]);
  await assert.rejects(
    db.query('insert into public.expenses(owner_id, spent_on, amount_krw) values ($1, current_date, 1000)', [ALICE]),
    /2000 spending entries/,
  );
  await db.close();
});

test('the anonymous role reaches none of these tables or functions', async () => {
  const db = await database();
  await db.exec(`reset role; set app.uid = '${ALICE}'; set role anon;`);
  for (const sql of [
    'select * from public.place_checkins',
    'select * from public.place_status_reports',
    'select * from public.point_ledger',
    'select * from public.expenses',
  ]) {
    await assert.rejects(db.query(sql), /permission denied/, sql);
  }
  await assert.rejects(db.query('select public.record_checkin($1, $2)', ['hikr-ground', 'manual']), /permission denied/);
  await assert.rejects(db.query('select public.place_status_summary($1)', [['hikr-ground']]), /permission denied/);
  await db.close();
});

test('a signed-out caller is refused before anything is written', async () => {
  const db = await database();
  await db.exec("reset role; set app.uid = ''; set role authenticated;");
  await assert.rejects(db.query('select public.record_checkin($1, $2)', ['hikr-ground', 'manual']), /Sign in before checking in/);
  await assert.rejects(db.query('select public.record_status_report($1, $2, $3)', ['hikr-ground', 'short', 'few']), /Sign in before sharing/);
  await assert.rejects(db.query('select public.unlock_place($1)', ['hikr-ground']), /Sign in before opening/);
  await assert.rejects(db.query('select public.place_status_summary($1)', [['hikr-ground']]), /Sign in to read/);
  await admin(db);
  assert.equal((await rows(db, 'select count(*)::int as n from public.point_ledger'))[0].n, 0);
  await db.close();
});
