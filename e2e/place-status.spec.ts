import { expect, test, type Page } from "@playwright/test";
import { twoNightJourney } from "./flow";
import { englishLocale } from "./locale";

englishLocale();

const HIKR = "HiKR Ground · K-pop floors";
const MUSIC = "Music Korea · Myeongdong 2";
const journey = (page: Page) => twoNightJourney(page, [HIKR, MUSIC]);

/** 익명 로그인으로 나가는 요청만 센다. 세션 읽기는 네트워크를 타지 않는다. */
function watchSignups(page: Page) {
  const calls: string[] = [];
  page.on("request", request => {
    if (/\/auth\/v1\/(signup|token)/.test(request.url())) calls.push(request.url());
  });
  return calls;
}

const panel = (page: Page) => page.getByRole("region", { name: "Live place updates" });

test("the panel is there but sends nothing before you agree", async ({ page }) => {
  const signups = watchSignups(page);
  await journey(page);
  await expect(panel(page)).toBeVisible();
  // 집계 자리에는 잠김 안내만 있고, 남의 기록은 보이지 않는다.
  await expect(panel(page).getByText("Checking in here opens them for free.", { exact: false }).first()).toBeVisible();
  // 게스트가 없으므로 포인트 잔액을 내걸지 않는다. 잔액만 role=status로 나오므로 그걸로 좁힌다
  // ("points"로 찾으면 아래 안내문의 "...adds it to your points."까지 걸린다).
  await expect(panel(page).getByRole("status")).toHaveCount(0);
  expect(signups).toEqual([]);
});

test("sharing an update asks before it creates a guest record, and cancel sends nothing", async ({ page }) => {
  const signups = watchSignups(page);
  await journey(page);
  await panel(page).getByRole("button", { name: "Share update" }).click();

  // 익명 계정이 조용히 생기지 않는다. 무엇이 만들어지는지 먼저 읽게 한다.
  const dialog = page.getByRole("dialog", { name: "Create a guest record?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("no email, no password, no name");
  expect(signups).toEqual([]);

  await dialog.getByRole("button", { name: "Not now" }).click();
  await expect(dialog).toHaveCount(0);
  expect(signups).toEqual([]);
});

test("Escape closes the consent dialog without creating anything", async ({ page }) => {
  const signups = watchSignups(page);
  await journey(page);
  await panel(page).getByRole("button", { name: "Share update" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(signups).toEqual([]);
});

test("the reporting form offers only the four documented levels", async ({ page }) => {
  await journey(page);
  const waiting = panel(page).getByLabel("Queue", { exact: true });
  await expect(waiting.locator("option")).toHaveText(["No queue", "Short", "Medium", "Long"]);
  const perks = panel(page).getByLabel("Gifts left", { exact: true });
  await expect(perks.locator("option")).toHaveText(["Plenty", "A few", "All gone", "Not sure"]);
});

test("everything else on the journey screen still works without a guest record", async ({ page }) => {
  const signups = watchSignups(page);
  await journey(page);
  // 체크인·가계부는 기기 저장이라 게스트 없이 그대로 된다.
  await page.getByRole("button", { name: `I was here: ${HIKR}` }).click();
  await expect(page.getByText("1 of 2 places visited")).toBeVisible();
  const spend = page.getByRole("region", { name: "Money spent" });
  await spend.getByLabel("Amount in won").fill("7000");
  await spend.getByRole("button", { name: "Add spending" }).click();
  await expect(spend.getByRole("status")).toContainText("₩7,000");
  expect(signups).toEqual([]);
});
