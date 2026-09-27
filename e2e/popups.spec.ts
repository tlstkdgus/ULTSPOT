import { expect, test } from '@playwright/test';
import { popups } from '../src/lib/trip/popups';
import { catalog } from '../src/lib/trip/catalog';
import { categoryCounts, isArtistSpecific, spotCategory } from '../src/lib/trip/categories';
import { matchesArtists } from '../src/lib/trip/artists';
import { unavailableReason } from '../src/lib/trip/planner';
import { browseAllSpots } from './flow';
import { englishLocale } from './locale';
englishLocale();

/** T-078: 보도로 확인한 공식 팝업. 운영시간이 발표되지 않아 자동 편성하지 않는다. */
test('official pop-ups come from news reports, link to their artist and are never auto-scheduled', () => {
  expect(popups.length).toBeGreaterThan(0);
  for (const event of popups) {
    expect(catalog.filter(row => row.id === event.id)).toHaveLength(1);
    expect(spotCategory(event)).toBe('popup');
    // 팝업은 아티스트 전용 분류가 아니다 — 최애를 안 고른 사람에게도 보인다. 다른 아티스트를 고르면 숨는다.
    expect(isArtistSpecific(event)).toBe(false);
    expect(matchesArtists(event.artistIds, [], false)).toBe(true);
    expect(matchesArtists(event.artistIds, ['P-SOLO-YENA'], false)).toBe(false);
    expect(event.provenance.url).toMatch(/^https:\/\//);
    expect(event.coord?.source).toMatch(/^https:\/\/place\.map\.kakao\.com\/\d+$/);
    expect(unavailableReason(event, event.from!)).toContain('unconfirmed');
    expect(unavailableReason(event, '2026-10-13')).toBe('Not running on this date.');
  }
  // 10/2 행사는 사전 응모 당첨자만이라는 걸 문구가 말한다.
  expect(popups[0].do).toMatch(/pre-application/);
  expect(categoryCounts(catalog).popup).toBe(popups.length);
});

test('the Pop-up filter shows the Superdry × Park Jihoon pop-up', async ({ page }) => {
  await page.goto('/plan');
  await browseAllSpots(page);
  await page.getByRole('button', { name: /^Pop-up/ }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Superdry × Park Jihoon pop-up · Seongsu', exact: true }) });
  await expect(card).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HiKR Ground · K-pop floors' })).toHaveCount(0);
});
