import { artists } from "../src/lib/trip/artists";
import { test, expect } from '@playwright/test';
import { englishLocale } from './locale';
englishLocale();
test('browse artists without searching and keep selection across filters', async ({ page }, info) => {
 await page.goto('/plan');
 if (process.env.CAPTURE_TASK === 'T-041') { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: "docs/tasks/T-041/screenshots/plan-" + info.project.name + ".png" }); }
 const list = page.getByRole('list', { name: 'Search results' });
 await expect(list.getByRole('listitem')).toHaveCount(artists.length);
 const nav = page.getByRole('navigation', { name: 'Artist directory' });
 await nav.getByRole('button', { name: 'Members', exact: true }).click();
 await expect(list.getByRole('listitem')).toHaveCount(artists.filter(a => a.kind === 'person' && !!a.parentId).length);
 await list.getByRole('button', { name: /Seungmin/ }).click();
 await nav.getByRole('button', { name: 'Groups', exact: true }).click();
 await expect(list.getByRole('listitem')).toHaveCount(artists.filter(a => a.kind === 'group').length);
 await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Clear selection', exact: true })).toBeDisabled();
 await nav.getByRole('button', { name: 'All', exact: true }).click();
 await expect(list.getByRole('listitem')).toHaveCount(artists.length);
});
