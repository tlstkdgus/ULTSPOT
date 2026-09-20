import { expect, test } from "@playwright/test";
import { planTrip, type FanEvent } from "../src/lib/trip/planner";
import { catalog } from "../src/lib/trip/catalog";
import { parseSavedTrip, storageKey } from "../src/lib/trip/storage";
import { englishLocale } from "./locale";

englishLocale();

test("onboarding keeps choices when moving back and guides focus", async ({ page }) => {
  await page.goto("/plan");
  await expect(page.getByRole("region", { name: "Your spots" })).toHaveCount(0);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByRole("button", { name: "Take it slow" }).click();
  await page.getByRole("button", { name: "Find my spots" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.getByRole("button", { name: "Build my itinerary" })).toBeDisabled();
  await page.getByRole("button", { name: "Add HiKR Ground · K-pop floors", exact: true }).click();
  await page.getByRole("button", { name: "Back to day" }).click();
  await expect(page.getByRole("button", { name: "Take it slow" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Find my spots" }).click();
  // 담은 곳은 버튼 문구가 Remove로 바뀐다. 보이는 문구와 접근성 이름이 같은 동작을 가리킨다 (T-015).
  await expect(page.getByRole("button", { name: "Remove HiKR Ground · K-pop floors", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Build my itinerary" }).click();
  await expect(page.getByText("11:00–12:30", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit day", exact: true }).click();
  await page.getByLabel("Travel date").fill("");
  await expect(page.getByRole("button", { name: "Find my spots" })).toBeDisabled();
});

test("guest can inspect sources, plan, save, restore, adjust and download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Plan my trip" }).click();
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByRole("button", { name: "Find my spots" }).click();
  await page.getByText("Source & visit details", { exact: true }).first().click();
  await expect(page.getByRole("link", { name: "Source notice" }).first()).toHaveAttribute("href", catalog[0].provenance.url);
  for (const event of catalog) await page.getByRole("button", { name: `Add ${event.title}`, exact: true }).click();
  await page.getByRole("button", { name: "Build my itinerary" }).click();
  await expect(page.getByText("2 visits ·", { exact: false })).toBeVisible();
  await expect(page.getByText("Opening hours are unconfirmed.", { exact: false })).toBeVisible();
  await page.getByText("Saved plans & storage", { exact: true }).click();
  await page.getByRole("button", { name: "Save on device", exact: true }).click();
  await page.reload();
  await page.getByText("Saved plans & storage", { exact: true }).click();
  await page.getByRole("button", { name: "Restore device draft" }).click();
  await expect(page.getByText("2 visits ·", { exact: false })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download itinerary" }).click();
  expect((await download).suggestedFilename()).toBe("ultspot-2026-09-22.txt");
  await page.getByRole("button", { name: "Edit day", exact: true }).click();
  await page.getByLabel("End time", { exact: true }).fill("12:00");
  await expect(page.getByText("2 visits ·", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Find my spots" }).click();
  await page.getByRole("button", { name: "Build my itinerary" }).click();
  await expect(page.getByText("1 visit ·", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Edit day", exact: true }).click();
  await page.getByLabel("End time", { exact: true }).fill("10:00");
  await expect(page.getByRole("alert").filter({ hasText: "End time must be later than start time." })).toBeVisible();
  await page.getByRole("button", { name: "Delete device draft" }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
});

test("personal event can be added and restored without publishing", async ({ page }) => {
  await page.goto("/plan");
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByRole("button", { name: "Find my spots" }).click();
  await page.getByText("Add an event from its notice", { exact: true }).click();
  const fields = { "Event name": "My birthday café visit", "Neighborhood": "Hongdae", "Venue address": "Test address for automated validation only", "Organizer notice URL": "https://example.com/event", "Opens": "13:00", "Closes": "16:00", "What to do": "Order a drink", "What you get": "Cup sleeve while available" };
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Add to my places" }).click();
  await page.getByRole("button", { name: "Add My birthday café visit", exact: true }).click();
  await page.getByRole("button", { name: "Build my itinerary" }).click();
  await expect(page.getByText("13:00–14:00", { exact: true })).toBeVisible();
  await page.getByText("Saved plans & storage", { exact: true }).click();
  await page.getByRole("button", { name: "Save on device", exact: true }).click();
  await page.reload();
  await page.getByText("Saved plans & storage", { exact: true }).click();
  await page.getByRole("button", { name: "Restore device draft" }).click();
  await expect(page.getByText("13:00–14:00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit spots", exact: true }).click();
  await page.getByText("Manage my events (1/12)", { exact: true }).click();
  await page.getByRole("button", { name: "Delete My birthday café visit", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add My birthday café visit", exact: true })).toHaveCount(0);
});

test("engine enforces dates, hours, closures, reservations and non-greedy ordering", () => {
  const input = { date: "2026-09-22", start: 660, end: 1080, stay: 60, transfer: 45 };
  const result = planTrip(catalog, input);
  expect(result.stops).toHaveLength(2);
  expect(result.omitted[0].event.id).toBe("k-star-road");
  for (let i = 0; i < result.stops.length; i++) {
    const stop = result.stops[i];
    expect(stop.arrival).toBeGreaterThanOrEqual(stop.event.opens!);
    expect(stop.departure).toBeLessThanOrEqual(Math.min(stop.event.closes!, input.end));
    if (i) expect(stop.arrival).toBeGreaterThanOrEqual(result.stops[i - 1].departure + input.transfer);
  }
  const tight: FanEvent[] = [{ ...catalog[0], id: "late", opens: 780 }, { ...catalog[0], id: "early", closes: 720 }];
  expect(planTrip(tight, input).stops.map(s => s.event.id)).toEqual(["early", "late"]);
  expect(planTrip([catalog[0]], { ...input, date: "2026-09-21" }).stops).toHaveLength(0);
  expect(planTrip([{ ...catalog[0], reservation: true }], input).stops).toHaveLength(0);
  expect(planTrip([{ ...catalog[0], lastEntry: 650 }], input).stops).toHaveLength(0);
  expect(planTrip([{ ...catalog[0], from: "2026-09-23", to: "2026-09-24" }], input).stops).toHaveLength(0);
  expect(planTrip(catalog, { ...input, date: "2026-02-30" }).error).toBeTruthy();
  expect(planTrip(catalog, { ...input, stay: NaN }).error).toBeTruthy();
  expect(planTrip(catalog, { ...input, transfer: -1 }).error).toBeTruthy();
  expect(planTrip(catalog, { ...input, end: input.start }).error).toBeTruthy();
  expect(parseSavedTrip({ version: 1, input, selected: ["unknown"], personal: [] })).toBeNull();
  expect(parseSavedTrip({ version: 1, input, selected: [], personal: [{ provenance: { url: "javascript:alert(1)" } }] })).toBeNull();
});
