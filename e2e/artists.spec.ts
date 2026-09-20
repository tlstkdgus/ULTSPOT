import { test, expect } from '@playwright/test';
import { matchesArtists, relatedArtistIds, searchArtists } from '../src/lib/trip/artists';
import { parseSavedTrip } from '../src/lib/trip/storage';
import { englishLocale } from './locale';

englishLocale();

test('artist search and membership do not expand a person into other solo members', () => {
  expect(searchArtists('스트레이키즈')[0].id).toBe('A-JYP-SKZ');
  expect(searchArtists('skz')[0].id).toBe('A-JYP-SKZ');
  expect(searchArtists('필릭스')[0].id).toBe('P-JYP-FELIX');
  expect(relatedArtistIds(['P-JYP-FELIX']).has('A-JYP-SKZ')).toBe(true);
  expect(relatedArtistIds(['P-JYP-FELIX']).has('P-JYP-HAN')).toBe(false);
  expect(matchesArtists(['P-JYP-HAN'], ['A-JYP-SKZ'])).toBe(true);
  expect(matchesArtists(['A-YG-BP'], ['A-JYP-SKZ'])).toBe(false);
  const legacy = { version: 1, input: { date: '2026-09-22', start: 660, end: 1080, stay: 60, transfer: 45 }, selected: [], personal: [] };
  expect(parseSavedTrip(legacy)?.artistIds).toEqual([]);
  expect(parseSavedTrip({ ...legacy, artistIds: ['unreviewed-id'] })).toBeNull();
});

test('artist favorites search, save and restore with an honest general-place fallback', async ({ page }) => {
  await page.goto('/plan');
  const results = page.getByRole('list', { name: 'Search results' });
  await page.getByLabel('Travel date').fill('2026-09-22');
  // 아티스트 선택은 접혀 있다 (T-016): 결과를 바꾸지 못하는 선택이 CTA를 밀어내지 않게 했다.
  await page.locator('summary').filter({ hasText: 'Who are you going for?' }).click();
  // 아티스트는 날짜와 함께 1단계에서 고른다 (T-015). 없는 아티스트 안내는 장소 단계 위에 나온다.
  await results.getByRole('button', { name: 'BLACKPINK' }).click();
  await page.getByLabel('Search artists', { exact: true }).fill('필릭스');
  await results.getByRole('button', { name: 'Felix' }).click();
  await page.getByRole('button', { name: 'Find my spots' }).click();
  await expect(page.getByText('No verified spots for', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Add HiKR Ground · K-pop floors', exact: true }).click();
  await page.getByRole('button', { name: 'Build my itinerary' }).click();
  await page.getByText('Saved plans & storage', { exact: true }).click();
  await page.getByRole('button', { name: 'Save on device', exact: true }).click();
  await page.reload();
  await page.getByText('Saved plans & storage', { exact: true }).click();
  await page.getByRole('button', { name: 'Restore device draft' }).click();
  await page.getByRole('button', { name: 'Edit day', exact: true }).click();
  // 복원 뒤에도 선택은 남아 있지만 접힌 영역 안이다. 펼쳐서 확인한다.
  await page.locator('summary').filter({ hasText: 'Who are you going for?' }).click();
  await expect(page.getByRole('button', { name: 'Remove BLACKPINK', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Felix', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explore all K-pop' }).click();
  await expect(page.getByRole('button', { name: 'Remove Felix', exact: true })).toHaveCount(0);
  await page.getByLabel('Search artists', { exact: true }).fill('unlisted-name');
  await expect(page.getByRole('status').filter({ hasText: 'verified selection' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
