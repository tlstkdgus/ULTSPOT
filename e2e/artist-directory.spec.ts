import { artists } from "../src/lib/trip/artists";
import { test, expect } from '@playwright/test';
import { englishLocale } from './locale';
englishLocale();
test('browse artists without searching and keep selection across filters', async ({ page }, info) => {
 await page.goto('/plan');
 if (process.env.CAPTURE_TASK === 'T-041') { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: "docs/tasks/T-041/screenshots/plan-" + info.project.name + ".png" }); }
 const list = page.getByRole('list', { name: 'Search results' });
 // 첫 화면은 그룹만이다. 228명 전체는 "All" 필터나 모달로 간다 (T-045, 첫 로딩 무게).
 const groups = artists.filter(a => a.kind === 'group').length;
 await expect(list.getByRole('listitem')).toHaveCount(groups);
 const nav = page.getByRole('navigation', { name: 'Artist directory' });
 await expect(nav.getByRole('button', { name: 'Groups', exact: true })).toHaveAttribute('aria-pressed', 'true');
 await nav.getByRole('button', { name: 'Members', exact: true }).click();
 await expect(list.getByRole('listitem')).toHaveCount(artists.filter(a => a.kind === 'person' && !!a.parentId).length);
 await list.getByRole('button', { name: /Seungmin/ }).click();
 await nav.getByRole('button', { name: 'Groups', exact: true }).click();
 await expect(list.getByRole('listitem')).toHaveCount(artists.filter(a => a.kind === 'group').length);
 await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
 await expect(page.getByRole('button', { name: 'Clear selection', exact: true })).toBeDisabled();
 await nav.getByRole('button', { name: 'All', exact: true }).click();
 await expect(list.getByRole('listitem')).toHaveCount(artists.length);
 // 검색어가 있으면 필터와 무관하게 전체에서 찾고, 필터 칩은 숨는다.
 await nav.getByRole('button', { name: 'Groups', exact: true }).click();
 await page.getByRole('textbox', { name: 'Search artists', exact: true }).fill('Felix');
 await expect(nav).toHaveCount(0);
 await expect(list.getByRole('button', { name: /^Felix / })).toBeVisible();
 await page.getByRole('textbox', { name: 'Search artists', exact: true }).fill('');
 await expect(nav.getByRole('button', { name: 'Groups', exact: true })).toHaveAttribute('aria-pressed', 'true');
 await expect(list.getByRole('listitem')).toHaveCount(groups);
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
