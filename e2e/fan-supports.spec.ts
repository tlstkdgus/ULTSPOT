import { expect, test } from '@playwright/test';
import { fanSupports } from '../src/lib/trip/fan-supports';
import { catalog } from '../src/lib/trip/catalog';
import { categoryCounts, isArtistSpecific, spotCategory } from '../src/lib/trip/categories';
import { matchesArtists } from '../src/lib/trip/artists';
import { unavailableReason } from '../src/lib/trip/planner';
import { browseAllSpots } from './flow';
import { englishLocale } from './locale';
englishLocale();

/** T-070: 생일 광고·서포트 분류. 보도로 확인한 광고만, 확정 일정처럼 보이지 않게. */
test('birthday ads are their own category, tied to an artist, and never auto-scheduled', () => {
  expect(fanSupports.length).toBeGreaterThan(0);
  for (const event of fanSupports) {
    expect(catalog.filter(row => row.id === event.id)).toHaveLength(1);
    expect(spotCategory(event)).toBe('support');
    expect(isArtistSpecific(event)).toBe(true);
    expect(event.artistIds?.length).toBeGreaterThan(0);
    expect(event.provenance.mode).toBe('reported');
    expect(event.provenance.url).toMatch(/^https:\/\//);
    // 좌표 출처는 카카오 장소 페이지(역). 광고판 자체가 아니라는 걸 문구가 말한다.
    expect(event.coord?.source).toMatch(/^https:\/\/place\.map\.kakao\.com\/\d+$/);
    expect(event.do).toMatch(/do not say which line or exit/);
    // 송출 시간을 모르니 자동 편성하지 않는다.
    expect(unavailableReason(event, event.from!)).toContain('unconfirmed');
    expect(unavailableReason(event, '2026-10-01')).toBe('Not running on this date.');
  }
  expect(spotCategory({ ...fanSupports[0], category: undefined })).toBe('support');
  expect(categoryCounts(catalog).support).toBe(fanSupports.length);
  // 다른 아티스트를 고른 팬에게는 보이지 않는다.
  expect(matchesArtists(fanSupports[0].artistIds, ['P-JYP-FELIX'], true)).toBe(true);
  expect(matchesArtists(fanSupports[0].artistIds, ['P-SOLO-YENA'], true)).toBe(false);
});

test('the Birthday ad filter shows the ad with its source link', async ({ page }) => {
  await page.goto('/plan');
  await browseAllSpots(page);
  await page.getByRole('button', { name: /Birthday ad/ }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Felix birthday ad · Hapjeong Station', exact: true }) });
  await expect(card).toBeVisible();
  await expect(card).toContainText('2026-09-15');
  await expect(page.getByRole('heading', { name: 'HiKR Ground · K-pop floors' })).toHaveCount(0);
});
