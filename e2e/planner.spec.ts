import { expect, test } from "@playwright/test";
import { planTrip, type FanEvent } from "../src/lib/trip/planner";
import { catalog } from "../src/lib/trip/catalog";
import { parseSavedTrip, storageKey } from "../src/lib/trip/storage";
import { browseAllSpots, goToStep } from "./flow";
import { englishLocale } from "./locale";

englishLocale();

// 카탈로그 순서·건수를 인덱스로 쥐지 않는다. PR #48이 운영시간 미확인 생일카페 3건을 앞에
// 붙이면서 catalog[0]이 opens=null 행사로 바뀌어, 그것을 토대로 만든 편성 사례가 전부 깨졌다.
const spot = (id: string) => catalog.find(e => e.id === id)!;

test("onboarding keeps choices when moving back and guides focus", async ({ page }) => {
  await page.goto("/plan");
  // 첫 단계는 최애 고르기다. 갈 곳 단계는 아직 열리지 않았다 (T-029).
  await expect(page.getByRole("region", { name: "Your SPOTs" })).toHaveCount(0);
  await browseAllSpots(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByRole("button", { name: "Add HiKR Ground · K-pop floors", exact: true }).click();

  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByRole("button", { name: "Take it slow" }).click();
  // 담은 곳과 속도가 단계를 오가도 남는다.
  await goToStep(page, 1);
  await expect(page.getByRole("button", { name: "Remove HiKR Ground · K-pop floors", exact: true })).toBeVisible();
  await goToStep(page, 2);
  await expect(page.getByRole("button", { name: "Take it slow" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Build my itinerary" }).click();
  await expect(page.getByText("11:00–12:30", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit day", exact: true }).click();
  // 날짜를 비우면 일정을 만들 수 없다.
  await page.getByLabel("Travel date").fill("");
  await expect(page.getByRole("button", { name: "Build my itinerary" })).toBeDisabled();
});

test("guest can inspect sources, plan, save, restore, adjust and download", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Plan my trip" }).click();
  await browseAllSpots(page);
  await page.getByText("Source & visit details", { exact: true }).first().click();
  await expect(page.getByRole("link", { name: "Source notice" }).first()).toHaveAttribute("href", catalog[0].provenance.url);
  // 카탈로그 전체를 담지 않는다. 일정 선택은 최대 6곳인데 T-046으로 9곳이 됐다 — 7번째 담기
  // 버튼은 비활성이라 클릭이 60초를 기다린다. 이 검사의 뜻은 "시간이 있는 두 곳은 편성되고
  // 미확인인 한 곳은 사유와 함께 빠진다"이므로 원래의 검수 장소 3곳으로 고정한다.
  for (const id of ["hikr-ground", "music-korea", "k-star-road"])
    await page.getByRole("button", { name: `Add ${spot(id).title}`, exact: true }).click();
  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByRole("button", { name: "Build my itinerary" }).click();
  await expect(page.getByText("2 visits ·", { exact: false })).toBeVisible();
  // 미확인 안내는 여러 장소에 붙는다 (수집한 생일카페 3건 + k-star-road). 하나라도 보이면 된다.
  await expect(page.getByText("Opening hours are unconfirmed.", { exact: false }).first()).toBeVisible();
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
  await browseAllSpots(page);
  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await goToStep(page, 1);
  await page.getByText("Add an event from its notice", { exact: true }).click();
  const fields = { "Event name": "My birthday café visit", "Neighborhood": "Hongdae", "Venue address": "Test address for automated validation only", "Organizer notice URL": "https://example.com/event", "Opens": "13:00", "Closes": "16:00", "What to do": "Order a drink", "What you get": "Cup sleeve while available" };
  for (const [label, value] of Object.entries(fields)) await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Add to my places" }).click();
  await page.getByRole("button", { name: "Add My birthday café visit", exact: true }).click();
  await goToStep(page, 2);
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
  // planTrip은 6곳을 넘으면 오류를 돌려준다(planner.ts). 카탈로그가 9곳이 되자 stops가 0이 됐다.
  // 엔진 규칙 검사는 검수 장소 3곳이면 충분하다.
  const three = ["hikr-ground", "music-korea", "k-star-road"].map(spot);
  const result = planTrip(three, input);
  expect(result.stops).toHaveLength(2);
  // 순서가 아니라 사유로 확인한다. 제외 목록의 선두는 카탈로그 순서를 따라가므로 데이터가
  // 늘면 바뀐다.
  expect(result.omitted.find(o => o.event.id === "k-star-road")?.reason).toContain("unconfirmed");
  for (let i = 0; i < result.stops.length; i++) {
    const stop = result.stops[i];
    expect(stop.arrival).toBeGreaterThanOrEqual(stop.event.opens!);
    expect(stop.departure).toBeLessThanOrEqual(Math.min(stop.event.closes!, input.end));
    if (i) expect(stop.arrival).toBeGreaterThanOrEqual(result.stops[i - 1].departure + input.transfer);
  }
  const tight: FanEvent[] = [{ ...spot("hikr-ground"), id: "late", opens: 780 }, { ...spot("hikr-ground"), id: "early", closes: 720 }];
  expect(planTrip(tight, input).stops.map(s => s.event.id)).toEqual(["early", "late"]);
  expect(planTrip([spot("hikr-ground")], { ...input, date: "2026-09-21" }).stops).toHaveLength(0);
  expect(planTrip([{ ...spot("hikr-ground"), reservation: true }], input).stops).toHaveLength(0);
  expect(planTrip([{ ...spot("hikr-ground"), lastEntry: 650 }], input).stops).toHaveLength(0);
  expect(planTrip([{ ...spot("hikr-ground"), from: "2026-09-23", to: "2026-09-24" }], input).stops).toHaveLength(0);
  expect(planTrip(three, { ...input, date: "2026-02-30" }).error).toBeTruthy();
  expect(planTrip(three, { ...input, stay: NaN }).error).toBeTruthy();
  expect(planTrip(three, { ...input, transfer: -1 }).error).toBeTruthy();
  expect(planTrip(three, { ...input, end: input.start }).error).toBeTruthy();
  expect(parseSavedTrip({ version: 1, input, selected: ["unknown"], personal: [] })).toBeNull();
  expect(parseSavedTrip({ version: 1, input, selected: [], personal: [{ provenance: { url: "javascript:alert(1)" } }] })).toBeNull();
});
