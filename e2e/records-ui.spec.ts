import { expect, test, type Page } from "@playwright/test";
import { journeyStorageKey } from "../src/lib/trip/journey";
import { twoNightJourney } from "./flow";
import { stat } from "node:fs/promises";
import { englishLocale } from "./locale";

englishLocale();

async function saveDevice(page: Page) {
  await page.getByText("Saved plans & storage", { exact: true }).click();
  await page.getByRole("button", { name: "Save on device", exact: true }).click();
}
async function restoreDevice(page: Page) {
  await page.getByText("Saved plans & storage", { exact: true }).click();
  await page.getByRole("button", { name: "Restore device draft", exact: true }).click();
}
const HIKR = "HiKR Ground · K-pop floors";
const MUSIC = "Music Korea · Myeongdong 2";

/** 여정 화면에서 두 곳을 담은 상태까지. 로그인도, 저장 버튼도 거치지 않는다. */
const journey = (page: Page) => twoNightJourney(page, [HIKR, MUSIC]);

const visitRow = (page: Page, name: string) =>
  page.getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });

async function markDone(page: Page, name: string) {
  await visitRow(page, name).getByRole("button", { name: `I was here: ${name}` }).click();
}

test("marking a place as visited needs no account and records the day, not the time", async ({ page }) => {
  await journey(page);
  const row = visitRow(page, HIKR);
  const toggle = row.getByRole("button", { name: `I was here: ${HIKR}` });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(row.getByText("We save the day only, never the time of day.")).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(row.getByText("Visited on 2026-09-22")).toBeVisible();
  await expect(page.getByText("1 of 2 places visited")).toBeVisible();

  // 저장된 기록에 시각이 없다. 날짜만 남는다.
  await saveDevice(page);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}"), journeyStorageKey);
  expect(saved.visited).toEqual([{ visitId: expect.any(String), on: "2026-09-22" }]);

  // 다시 누르면 기록이 사라진다.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("0 of 2 places visited")).toBeVisible();
});

test("a visit record survives a reload without any sign-in", async ({ page }) => {
  await journey(page);
  await markDone(page, HIKR);
  await saveDevice(page);
  await page.reload();
  await restoreDevice(page);
  // 로그인 화면이 끼어들지 않고, 기록이 그대로 돌아온다.
  await expect(page.getByRole("button", { name: /Sign in|Log in/ })).toHaveCount(0);
  await expect(page.getByText("1 of 2 places visited")).toBeVisible();
  await expect(visitRow(page, HIKR).getByText("Visited on 2026-09-22")).toBeVisible();
});

test("spending is recorded in whole won and totalled per day and per place", async ({ page }) => {
  await journey(page);
  const panel = page.getByRole("region", { name: "Money spent" });
  await expect(panel.getByText("Nothing recorded yet.")).toBeVisible();

  await panel.getByLabel("Amount in won").fill("8500");
  await panel.getByLabel("What for (optional)").fill("Cup sleeve set");
  await panel.getByLabel("By place").selectOption({ label: MUSIC });
  await panel.getByRole("button", { name: "Add spending" }).click();

  await expect(panel.getByText("₩8,500").first()).toBeVisible();
  await expect(panel.getByText("Cup sleeve set")).toBeVisible();
  // 합계는 항목에서 센다. 이 날 합계와 여행 전체 합계가 같다.
  await expect(panel.getByRole("status")).toContainText("₩8,500 on this day");
  await expect(panel.getByRole("status")).toContainText("₩8,500 for the whole trip");
  await expect(panel.getByRole("status")).toContainText("1 entry");

  // 장소를 고르지 않은 지출은 "장소 없음"으로 남고 아무 장소에 붙지 않는다.
  await panel.getByLabel("By place").selectOption("");
  await panel.getByLabel("Amount in won").fill("1350");
  await panel.getByRole("button", { name: "Add spending" }).click();
  await expect(panel.getByRole("status")).toContainText("₩9,850 for the whole trip");
  await expect(panel.locator("li").filter({ hasText: "Not tied to a place" }).first()).toBeVisible();

  await expect(panel.getByRole("heading", { name: "By day" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "By place" })).toBeVisible();
});

test("a fraction, a zero and an empty amount are refused instead of becoming a number", async ({ page }) => {
  await journey(page);
  const panel = page.getByRole("region", { name: "Money spent" });
  for (const bad of ["0", "-100", "12.5", ""]) {
    await panel.getByLabel("Amount in won").fill(bad);
    await panel.getByRole("button", { name: "Add spending" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Enter a whole number of won, at least 1." })).toBeVisible();
  }
  await expect(panel.getByText("Nothing recorded yet.")).toBeVisible();
  await expect(panel.getByRole("status").first()).toContainText("₩0 on this day");
});

test("spending can be removed and the totals follow", async ({ page }) => {
  await journey(page);
  const panel = page.getByRole("region", { name: "Money spent" });
  await panel.getByLabel("Amount in won").fill("4000");
  await panel.getByRole("button", { name: "Add spending" }).click();
  await expect(panel.getByRole("status")).toContainText("₩4,000 for the whole trip");
  await panel.getByRole("button", { name: "Remove this entry: ₩4,000" }).click();
  await expect(panel.getByText("Nothing recorded yet.")).toBeVisible();
  await expect(panel.getByRole("status").first()).toContainText("₩0 on this day");
});

test("the footprint is empty until you mark a place, and never shows a distance", async ({ page }) => {
  await journey(page);
  const panel = page.getByRole("region", { name: "Your footprint" });
  await expect(panel.getByText("Mark a place as visited and it shows up here.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Download card" })).toHaveCount(0);

  await markDone(page, HIKR);
  await expect(panel.getByRole("listitem").filter({ hasText: /^1 place$/ })).toBeVisible();
  await expect(panel.getByText("1 visit", { exact: true })).toBeVisible();
  // 거리 문구가 없고, 없는 이유를 화면이 직접 말한다.
  await expect(panel).toContainText("No distance here.");
  await expect(panel).not.toContainText("km");
  await expect(panel.getByRole("button", { name: "Download card" })).toBeEnabled();
});

test("the footprint counts what you marked, not what you planned", async ({ page }) => {
  await journey(page);
  await markDone(page, HIKR);
  await markDone(page, MUSIC);
  const panel = page.getByRole("region", { name: "Your footprint" });
  await expect(panel.getByRole("listitem").filter({ hasText: /^2 places$/ })).toBeVisible();
  await expect(panel.getByText("2 visits", { exact: true })).toBeVisible();
  await expect(panel.getByText("1 day", { exact: true })).toBeVisible();
  // 다녀온 순서대로 번호가 붙는다.
  const rows = panel.locator("ol").getByRole("listitem");
  await expect(rows.first()).toContainText("2026-09-22");
});

test("spending reaches the footprint card only when something was recorded", async ({ page }) => {
  await journey(page);
  await markDone(page, HIKR);
  const panel = page.getByRole("region", { name: "Your footprint" });
  // 0원은 "쓰지 않음"이 아니라 "기록하지 않음"이므로 카드에 넣지 않는다.
  await expect(panel).not.toContainText("Spent");
  await page.getByRole("region", { name: "Money spent" }).getByLabel("Amount in won").fill("21850");
  await page.getByRole("region", { name: "Money spent" }).getByRole("button", { name: "Add spending" }).click();
  await expect(panel).toContainText("Spent ₩21,850");
});

test("checking in and recording spending do not look up travel times again", async ({ page }) => {
  // 체크인·지출은 여정 객체를 바꾸지만 이동 구간은 그대로다. 예전엔 누를 때마다 /api/travel을
  // 다시 불러 카카오 경로 쿼터를 썼고, 발자취 카드 검사가 그 요청을 잡아 간헐적으로 깨졌다(T-048).
  await journey(page);
  // 첫 조회가 끝난 뒤부터 센다. networkidle은 첫 조회보다 먼저 올 수 있어 mobile에서 한 번 샜다.
  await expect(page.getByText("1 leg looked up", { exact: false }).first()).toBeVisible();
  const lookups: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/travel")) lookups.push(request.url()); });
  await markDone(page, HIKR);
  const spend = page.getByRole("region", { name: "Money spent" });
  await spend.getByLabel("Amount in won").fill("3000");
  await spend.getByRole("button", { name: "Add spending" }).click();
  await expect(spend.getByRole("status")).toContainText("₩3,000");
  await page.waitForTimeout(500);
  expect(lookups).toEqual([]);
});

test("the share card is drawn in the browser and downloaded, with no server and no link", async ({ page }) => {
  await journey(page);
  // 여정 화면은 빈 시간 추천(/api/recommend)을 스스로 부른다(T-063). 그 첫 조회가 끝난 뒤부터 센다.
  // 이 대기 전에는 모바일 check:prod에서 늦게 나간 첫 추천 요청이 카드 요청으로 잡혀 한 번 깨졌다(2026-09-25).
  // 추천 요청은 고정 응답(twoNightJourney)이라 카드 내용과 무관하다. 대기 뒤에는 추천 요청도 세므로,
  // 다녀왔어요·카드 만들기가 추천을 다시 부르는 회귀도 잡는다.
  await expect(page.getByText("nothing nearby fits this gap", { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  // 카드를 만드는 동안 **우리 서버로** 나가는 요청이 없어야 한다. 카드 내용이 서버로 가지 않는다는 검사다.
  // Google Analytics(T-053)는 다운로드 클릭을 google-analytics.com으로 POST할 수 있는데(향상된 측정),
  // 카드 이미지가 아니라 "다운로드가 있었다"는 이벤트라 우리 서버 요청만 센다.
  const calls: string[] = [];
  const ours = new URL(page.url()).origin;
  page.on("request", request => {
    if (new URL(request.url()).origin !== ours) return;
    if (request.method() === "POST" || request.url().includes("/api/")) calls.push(request.url());
  });
  await markDone(page, HIKR);

  const download = page.waitForEvent("download");
  await page.getByRole("region", { name: "Your footprint" }).getByRole("button", { name: "Download card" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("ultspot-footprint-2026-09-22.png");

  const path = await file.path();
  expect(path).toBeTruthy();
  expect((await stat(path!)).size).toBeGreaterThan(100);
  expect(calls).toEqual([]);
});

test("everything on this screen works with cloud storage switched off", async ({ page }) => {
  await journey(page);
  await markDone(page, HIKR);
  await page.getByRole("region", { name: "Money spent" }).getByLabel("Amount in won").fill("5000");
  await page.getByRole("region", { name: "Money spent" }).getByRole("button", { name: "Add spending" }).click();

  // 익명 로그인을 포함해 어떤 인증 요청도 일어나지 않는다.
  const auth: string[] = [];
  page.on("request", request => { if (request.url().includes("/auth/")) auth.push(request.url()); });
  await saveDevice(page);
  await page.reload();
  await restoreDevice(page);
  await expect(page.getByText("1 of 2 places visited")).toBeVisible();
  await expect(page.getByRole("region", { name: "Money spent" }).getByRole("status")).toContainText("₩5,000");
  expect(auth).toEqual([]);
});
