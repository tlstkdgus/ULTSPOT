import { expect, test } from "@playwright/test";
import path from "node:path";
import { englishLocale } from "./locale";

englishLocale();

// Explicit opt-in: this suite creates real anonymous Auth users and removes their drafts.
// Never record network traces containing guest access/refresh tokens.
test.use({ trace: "off", video: "off", screenshot: "off" });
test.skip(process.env.E2E_LIVE_CLOUD !== "true", "Requires an explicitly enabled test Supabase project and cloud-enabled build");

test("guest cloud draft survives reload, updates and deletes through the UI", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/plan");
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByRole("button", { name: "Find my spots" }).click();
  await page.getByRole("button", { name: "Add HiKR Ground · K-pop floors", exact: true }).click();
  const openCloud = async () => {
    const storage = page.getByText("Saved plans & storage", { exact: true });
    if (!(await storage.evaluate(el => el.parentElement?.hasAttribute("open")))) await storage.click();
    const summary = page.getByText("Optional private cloud draft", { exact: true });
    await expect(summary).toBeVisible();
    if (!(await summary.evaluate(el => el.parentElement?.hasAttribute("open")))) await summary.click();
  };
  await openCloud();
  try {
    await page.getByRole("button", { name: "Save cloud draft", exact: true }).click();
    await expect(page.getByText("Saved your private cloud draft.", { exact: false })).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await openCloud();
    await page.getByRole("button", { name: "Restore cloud draft", exact: true }).click();
    await expect(page.getByText("Cloud draft restored and recalculated.", { exact: true })).toBeVisible();
    await expect(page.getByText("1 visit ·", { exact: false })).toBeVisible();
    await expect(page.getByText("1 visit ·", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Edit day", exact: true }).click();
    await page.getByLabel("End time", { exact: true }).fill("17:00");
    await page.getByRole("button", { name: "Save cloud draft", exact: true }).click();
    await expect(page.getByText("Saved your private cloud draft.", { exact: false })).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await openCloud();
    await page.getByRole("button", { name: "Restore cloud draft", exact: true }).click();
    await expect(page.getByText("Cloud draft restored and recalculated.", { exact: true })).toBeVisible();
    await expect(page.getByText("Your day: 11:00–17:00", { exact: false })).toBeVisible();
    await page.route("**/rest/v1/guest_trips*", route => route.abort());
    await page.getByRole("button", { name: "Restore cloud draft", exact: true }).click();
    // Supabase retries transient network failures before returning an error.
    await expect(page.getByText("Cloud restore failed.", { exact: false })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText("Your day: 11:00–17:00", { exact: false })).toBeVisible();
    await page.unroute("**/rest/v1/guest_trips*");
    if (process.env.CAPTURE_TASK === "T-007") {
      await page.getByRole("button", { name: "Restore cloud draft", exact: true }).click();
      await expect(page.getByText("Cloud draft restored and recalculated.", { exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join("docs/tasks/T-007/screenshots", `cloud-restored-${testInfo.project.name}.png`), fullPage: true });
    }
  } finally {
    await page.unroute("**/rest/v1/guest_trips*");
    await page.getByRole("button", { name: "Delete cloud draft", exact: true }).click();
    await expect(page.getByText("Cloud draft deleted.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Restore cloud draft", exact: true }).click();
    await expect(page.getByText("No cloud draft for this browser session.", { exact: true })).toBeVisible();
  }
});
