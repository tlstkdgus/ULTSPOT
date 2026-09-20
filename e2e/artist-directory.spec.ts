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

test('artist modal lists entries, preserves picks and closes with Escape', async ({ page }, info) => {
 await page.goto('/plan');
 const open = page.getByRole('button', { name: /Browse artists/ });
 await open.click();
 const modal = page.getByRole('dialog', { name: 'Browse artists' });
 await expect(modal).toBeVisible();
 await expect(modal.getByRole('listitem')).toHaveCount(artists.length);
 await modal.getByRole('button', { name: /^Seungmin / }).click();
 await expect(modal.getByRole('button', { name: 'Done · 1/5' })).toBeVisible();
 if (process.env.CAPTURE_TASK === 'T-041') await page.screenshot({ path: `docs/tasks/T-041/screenshots/modal-${info.project.name}.png` });
 await page.keyboard.press('Escape');
 await expect(modal).not.toBeVisible();
 await expect(open).toBeFocused();
 await open.click();
 await expect(modal.getByRole('button', { name: /^Seungmin / })).toHaveAttribute('aria-pressed', 'true');
 await modal.getByRole('button', { name: 'Done · 1/5' }).click();
 await expect(modal).not.toBeVisible();
});
