import { expect, test } from '@playwright/test';
import { fanCafes } from '../src/lib/trip/fan-cafes';
import { catalog } from '../src/lib/trip/catalog';
import { unavailableReason } from '../src/lib/trip/planner';
import { browseAllSpots } from './flow';
import { englishLocale } from './locale';
import { matchesArtists } from '../src/lib/trip/artists';
englishLocale();

test('fan cafes are linked without promoting collector reports to confirmed schedules', () => {
  expect(fanCafes).toHaveLength(3);
  expect(matchesArtists(undefined, ['P-JYP-SEUNGMIN'], true)).toBe(false);
  expect(matchesArtists(undefined, [], true)).toBe(true);
  expect(matchesArtists(undefined, ['P-JYP-SEUNGMIN'])).toBe(true);
  for (const event of fanCafes) {
    expect(catalog.filter(row => row.id === event.id)).toHaveLength(1);
    expect(event.provenance.mode).toBe('reported');
    expect(event.provenance.url).toMatch(/^https:\/\/x.com\/[^/]+\/status\/\d+$/);
    expect(event.image_asset_id).toBeUndefined();
    expect(unavailableReason(event, event.from!)).toContain('unconfirmed');
    expect(unavailableReason(event, '2026-11-01')).toBe('Not running on this date.');
  }
});

test('birthday cafe discovery shows collected events and organizer links', async ({ page }, info) => {
  await page.goto('/plan');
  await browseAllSpots(page);
  await page.getByRole('button', { name: /Birthday café/ }).click();
  for (const event of fanCafes) {
    const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: event.title, exact: true }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Collected listing');
    const poster = card.getByRole('img', { name: event.title, exact: true });
    await poster.scrollIntoViewIfNeeded();
    // 기본 5초로는 부족하다. mobile은 deviceScaleFactor 2라 포스터를 2배 크기로 받는데,
    // 세 뷰포트를 병렬로 돌리면 생일카페 포스터 3장이 5초를 넘긴다. 2026-09-21에 두 번 깨졌다.
    // 기다리는 시간만 늘리고 검사는 그대로 둔다 — 이미지가 실제로 디코딩됐는지를 계속 본다.
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
      { timeout: 20_000 }).toBe(true);
  }
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (process.env.CAPTURE_TASK === 'T-037') await page.screenshot({ path: `docs/tasks/T-037/screenshots/fan-cafes-${info.project.name}.png`, fullPage: true });
});
