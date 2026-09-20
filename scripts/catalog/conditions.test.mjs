import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partialDateBounds, validate, prepare } from './intake.mjs';
import { tabs, optionalTabs } from './schema.mjs';

test('partial relationship dates preserve precision, validate leap months and reject invented dates', () => {
  assert.equal(partialDateBounds('2024').precision, 'year');
  assert.equal(partialDateBounds('2024-02').max, '2024-02-29');
  assert.equal(partialDateBounds('2023-02').max, '2023-02-28');
  assert.equal(partialDateBounds('2026-02-30'), null);
  assert.equal(partialDateBounds('2026-13'), null);
  const b = Object.fromEntries(tabs.filter(t => !optionalTabs.includes(t)).map(t => [t, []]));
  assert.deepEqual(validate(b).bundle, b);
  assert.doesNotThrow(() => prepare(b, 'legacy'));
});
test('session and booking conditions retain unknown ends and reject cross-event references', () => {
  const b = Object.fromEntries(tabs.map(t => [t, []]));
  b.event_sessions = [{ session_id: 's', event_id: 'e', date: '2026-09-21', starts_at: '2026-09-21T20:00:00+09:00', ends_at: '미확인', source_ids: ['src'] }];
  b.booking_windows = [{ booking_id: 'b', event_id: 'other', session_id: 's', booking_type: 'presale', opens_at: '2026-09-20T12:00:00+09:00', closes_at: '미확인', reservation_status: 'required', source_ids: ['src'] }];
  let r = validate(b);
  assert.ok(r.errors.some(e => e.code === 'session_event_mismatch'));
  assert.ok(!r.errors.some(e => e.code === 'invalid_timestamp'));
  assert.equal(r.bundle.event_sessions[0].ends_at, '미확인');
  b.event_sessions[0].starts_at = 'invalid';
  r = validate(b);
  assert.ok(r.errors.some(e => e.code === 'invalid_timestamp'));
});
