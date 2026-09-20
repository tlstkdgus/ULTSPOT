import { expect, test, type Page } from "@playwright/test";
import { journeyStorageKey } from "../src/lib/trip/journey";
import { browseAllSpots, fixTravelLookups, goToStep } from "./flow";
import { englishLocale } from "./locale";

englishLocale();

/**
 * 이 파일은 **여정 화면**을 검사한다. 이동시간 조회 자체는 검사하지 않으므로 /api/travel 응답을
 * 고정한다 (이유는 flow.ts의 fixTravelLookups 주석 참조).
 */

test("moving the last travel leg away clears a pending lookup", async ({ page }) => {
  await twoNightTrip(page);
  await page.unroute("**/api/travel");
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/travel", async route => {
    await held;
    await route.fulfill({ json: { configured: true, estimates: {} } }).catch(() => {});
  });
  try {
    const first = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "HiKR Ground · K-pop floors" }) });
    const request = page.waitForRequest("**/api/travel");
    await first.getByLabel("Time here").selectOption("120");
    await request;
    await expect(page.getByText("Checking travel times…", { exact: true })).toBeVisible();
    const second = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Music Korea · Myeongdong 2" }) });
    await second.getByRole("button", { name: "Move to Day 2" }).click();
    await expect(page.getByText("Checking travel times…", { exact: true })).toHaveCount(0);
  } finally {
    release();
  }
});

/** 2박 3일 여정을 만들고 Day 1에 검수 장소 2곳을 담은 상태까지 간다. */
async function twoNightTrip(page: Page) {
  await fixTravelLookups(page);
  await page.goto("/plan");
  await browseAllSpots(page);
  for (const name of ["HiKR Ground · K-pop floors", "Music Korea · Myeongdong 2"]) {
    await page.getByRole("button", { name: `Add ${name}`, exact: true }).click();
  }
  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByLabel("Last day").fill("2026-09-24");
  await expect(page.getByText("2 nights, 3 days")).toBeVisible();
  await page.getByRole("button", { name: "Build my itinerary" }).click();
}

test("a multi-day trip gets day tabs and keeps every pick on day one", async ({ page }) => {
  await twoNightTrip(page);
  // Day 탭 3개. 담은 곳은 첫날에 고른 순서대로 들어간다 (자동으로 흩뿌리지 않는다).
  for (const day of ["Day 1", "Day 2", "Day 3"]) {
    await expect(page.getByRole("button", { name: new RegExp(`^${day}`) })).toBeVisible();
  }
  const list = page.getByRole("listitem");
  await expect(page.getByRole("heading", { name: "HiKR Ground · K-pop floors" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Music Korea · Myeongdong 2" })).toBeVisible();
  expect(await list.count()).toBeGreaterThan(0);

  // Day 2는 비어 있고 그 사실을 말한다.
  await page.getByRole("button", { name: /^Day 2/ }).click();
  await expect(page.getByText("Nothing planned for this day yet.")).toBeVisible();
});

test("visits move between days and to the unassigned list without being deleted", async ({ page }) => {
  await twoNightTrip(page);
  // 2번째 방문을 Day 2로 옮긴다.
  const second = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Music Korea · Myeongdong 2" }) });
  await second.getByRole("button", { name: "Move to Day 2" }).click();
  await expect(page.getByRole("heading", { name: "Music Korea · Myeongdong 2" })).toHaveCount(0);
  await page.getByRole("button", { name: /^Day 2/ }).click();
  await expect(page.getByRole("heading", { name: "Music Korea · Myeongdong 2" })).toBeVisible();

  // 이 날에서 빼면 미배정으로 간다. 삭제가 아니다.
  await page.getByRole("button", { name: "Take off this day" }).click();
  await expect(page.getByRole("heading", { name: "Not on a day yet" })).toContainText("1");
  // 미배정에서 다시 Day 3으로 넣을 수 있다.
  await page.getByRole("button", { name: "Add to Day 3" }).click();
  await page.getByRole("button", { name: /^Day 3/ }).click();
  await expect(page.getByRole("heading", { name: "Music Korea · Myeongdong 2" })).toBeVisible();
});

test("shrinking the trip moves visits to unassigned instead of silently dropping them", async ({ page }) => {
  await twoNightTrip(page);
  const second = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Music Korea · Myeongdong 2" }) });
  await second.getByRole("button", { name: "Move to Day 3" }).click();
  // 기간을 2박에서 당일로 줄인다.
  await page.getByLabel("Last day").fill("2026-09-22");
  await expect(page.getByRole("button", { name: /^Day 2/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Not on a day yet" })).toContainText("1");
  await expect(page.getByText("Shortening your trip moves visits here")).toBeVisible();
});

test("stay length and a fixed arrival time are the user's to set, and conflicts are reported", async ({ page }) => {
  await twoNightTrip(page);
  const first = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "HiKR Ground · K-pop floors" }) });
  await first.getByLabel("Time here").selectOption("120");
  // 두 번째 방문의 도착 시각을 10:30으로 고정하면 첫 방문(10:00 + 120분) 뒤에 도달할 수 없다.
  const second = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Music Korea · Myeongdong 2" }) });
  await second.getByLabel("Fix the arrival time").fill("10:30");
  await expect(second.getByText("Needs a look")).toBeVisible();
  await expect(second.getByText("Cannot reach the locked time.")).toBeVisible();
  // 사용자가 고정한 시각을 조용히 바꾸지 않는다.
  await expect(second.getByLabel("Fix the arrival time")).toHaveValue("10:30");
  await second.getByRole("button", { name: "Unfix" }).click();
  await expect(second.getByLabel("Fix the arrival time")).toHaveValue("");
});

test("the map shows pins only and says it does not draw the route", async ({ page }) => {
  await twoNightTrip(page);
  const map = page.getByRole("region", { name: "Where you'll be" });
  await expect(map).toBeVisible();
  // 직선을 경로로 보이게 하지 않는다는 것을 화면이 직접 말한다.
  await expect(map).toContainText("a straight line is not the real route");
  // 번호가 붙은 목록이 그날 장소와 연결된다.
  await expect(map.getByRole("link", { name: "HiKR Ground · K-pop floors" })).toHaveAttribute("href", /map\.kakao\.com\/link\/map\//);
});

test("a multi-day trip saves and restores after a reload", async ({ page }) => {
  await twoNightTrip(page);
  const second = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Music Korea · Myeongdong 2" }) });
  await second.getByRole("button", { name: "Move to Day 2" }).click();

  await page.getByText("Saved plans & storage", { exact: true }).click();
  await page.getByRole("button", { name: "Save on device", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Trip saved on this device." })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key) !== null, journeyStorageKey)).toBe(true);

  await page.reload();
  await page.getByText("Saved plans & storage", { exact: true }).click();
  await page.getByRole("button", { name: "Restore device draft" }).click();
  // 3일 여정과 Day 2로 옮긴 방문이 그대로 돌아온다.
  await expect(page.getByRole("button", { name: /^Day 3/ })).toBeVisible();
  await page.getByRole("button", { name: /^Day 2/ }).click();
  await expect(page.getByRole("heading", { name: "Music Korea · Myeongdong 2" })).toBeVisible();

  await page.getByRole("button", { name: "Delete device draft" }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), journeyStorageKey)).toBeNull();
});

test("a single-day trip still uses the day plan, not the journey screen", async ({ page }) => {
  await fixTravelLookups(page);
  await page.goto("/plan");
  await browseAllSpots(page);
  await page.getByRole("button", { name: "Add HiKR Ground · K-pop floors", exact: true }).click();
  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  // 마지막날을 비워 두면 당일이다.
  await page.getByRole("button", { name: "Build my itinerary" }).click();
  await expect(page.getByText("1 visit ·", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Day 1/ })).toHaveCount(0);
});
