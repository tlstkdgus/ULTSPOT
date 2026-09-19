import { test, expect } from '@playwright/test';
import { matchesArtists, relatedArtistIds, searchArtists } from '../src/lib/trip/artists';
import { parseSavedTrip } from '../src/lib/trip/storage';

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
  await page.getByLabel('Travel date').fill('2026-09-22');
  await page.getByRole('button', { name: 'Find my spots' }).click();
  await page.getByRole('button', { name: 'Choose artist BLACKPINK', exact: true }).click();
  await page.getByLabel('Search artists', { exact: true }).fill('필릭스');
  await page.getByRole('button', { name: 'Choose artist Felix', exact: true }).click();
  await expect(page.getByText('No verified artist-specific spots', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Select HiKR Ground · K-pop floors', exact: true }).click();
  await page.getByRole('button', { name: 'Build my itinerary' }).click();
  await page.getByText('Saved plans & storage', { exact: true }).click();
  await page.getByRole('button', { name: 'Save on device', exact: true }).click();
  await page.reload();
  await page.getByText('Saved plans & storage', { exact: true }).click();
  await page.getByRole('button', { name: 'Restore device draft' }).click();
  await page.getByRole('button', { name: 'Edit spots', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove artist BLACKPINK', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove artist Felix', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Explore all K-pop' }).click();
  await expect(page.getByRole('button', { name: 'Remove artist Felix', exact: true })).toHaveCount(0);
  await page.getByLabel('Search artists', { exact: true }).fill('unlisted-name');
  await expect(page.getByRole('status').filter({ hasText: 'verified selection' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
