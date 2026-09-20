import { test, expect } from '@playwright/test';
import { catalog } from '../src/lib/trip/catalog';
import { eventCopy } from '../src/lib/trip/event-copy';
import { artists } from '../src/lib/trip/artists';
import { isPersonalEvent } from '../src/lib/trip/storage';

test('reviewed copy switches languages without changing scheduling or personal text', () => {
  const event = catalog[0];
  const before = JSON.stringify(event);
  expect(eventCopy(event, 'ko').area).toBe('중구');
  expect(eventCopy(event, 'en').title).toBe(event.title);
  expect(JSON.stringify(event)).toBe(before);
  const personal = { ...event, id: 'personal-test', title: '내가 입력한 제목', from: '2026-09-22', to: '2026-09-22', closedDays: [], lastEntry: undefined, provenance: { ...event.provenance, mode: 'personal' as const } };
  expect(eventCopy(personal, 'ko').title).toBe(personal.title);
  expect(isPersonalEvent(personal)).toBe(false);
  const fallback = { ...event, title_ko: undefined };
  expect(eventCopy(fallback, 'ko').title).toBe(event.title);
});

test('visitor facts keep missing conditions distinct from free or unavailable', () => {
  expect(catalog.every(e => e.title_ko && e.do_ko && e.get_ko && e.area_ko)).toBe(true);
  expect(catalog[0].transit?.walk_minutes).toBe(2);
  expect(catalog[0].participation?.cash_required).toBeNull();
  expect(catalog[1].transit).toBeUndefined();
  expect(catalog.every(e => e.image_asset_id === undefined)).toBe(true);
  expect(artists.filter(a => a.birthday_mm_dd)).toHaveLength(8);
  expect(artists.filter(a => a.kind === 'group').every(a => !a.birthday_mm_dd)).toBe(true);
});
