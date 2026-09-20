import { expect, test } from "@playwright/test";
import { localeCookie } from "../src/i18n/config";

test("한국어가 기본이고 언어 선택이 이동·새로고침 뒤에도 유지된다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("button", { name: "English" })).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Plan my trip" })).toBeVisible();

  // 다른 페이지로 이동해도, 새로고침해도 영어가 유지된다 (쿠키를 서버가 읽는다).
  await page.getByRole("link", { name: "Plan my trip" }).click();
  // 배포 직후 첫 요청은 콜드 스타트로 느리다(프로덕션에서 17.8초를 봤다). 이동을 먼저 기다린다.
  await page.waitForURL("**/plan");
  await expect(page.getByLabel("Travel date")).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByLabel("Travel date")).toBeVisible();
  expect(await page.context().cookies().then(all => all.find(c => c.name === localeCookie)?.value)).toBe("en");
});

test("언어를 바꿔도 입력한 날짜·고른 장소·단계가 그대로 남는다", async ({ page }) => {
  await page.goto("/plan");
  await page.getByLabel("여행 날짜").fill("2026-09-22");
  await page.locator("summary").filter({ hasText: "누구를 보러 가요?" }).click();
  await page.getByRole("list", { name: "검색 결과" }).getByRole("button", { name: "블랙핑크" }).click();
  await page.getByRole("button", { name: "갈 곳 보기" }).click();
  await page.getByRole("button", { name: "담기 HiKR Ground · K-pop floors", exact: true }).click();
  await expect(page.getByText("1 / 6곳 담음")).toBeVisible();

  await page.getByRole("button", { name: "English" }).click();
  // 같은 단계, 같은 선택 상태가 유지되어야 한다.
  await expect(page.getByText("1 / 6 added")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove HiKR Ground · K-pop floors", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to day" }).click();
  await expect(page.getByLabel("Travel date")).toHaveValue("2026-09-22");
  await page.locator("summary").filter({ hasText: "Who are you going for?" }).click();
  await expect(page.getByRole("list", { name: "Search results" }).getByRole("button", { name: "BLACKPINK" }))
    .toHaveAttribute("aria-pressed", "true");
});

test("고르기 전에 운영 상태를 알리고, 일정은 캘린더 파일로 받을 수 있다", async ({ page }) => {
  await page.goto("/plan");
  await page.getByLabel("여행 날짜").fill("2026-09-22");
  await page.getByRole("button", { name: "갈 곳 보기" }).click();

  // 운영시간 미확인(K-Star Road)은 담기 전에 자동 일정 제외 사유가 보인다.
  await expect(page.getByText("운영시간 미확인").first()).toBeVisible();
  await expect(page.getByText("자동 일정에는 들어가지 않아요").first()).toBeVisible();
  await expect(page.getByText("사진 준비 중").first()).toBeVisible();

  await page.getByRole("button", { name: "담기 HiKR Ground · K-pop floors", exact: true }).click();
  await page.getByRole("button", { name: "일정 만들기" }).click();
  await expect(page.getByText("1곳 방문", { exact: false })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "캘린더에 추가 (.ics)" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("ultspot-2026-09-22.ics");
  const stream = await file.createReadStream();
  const ics = (await new Promise<Buffer>(resolve => {
    const chunks: Buffer[] = [];
    stream.on("data", chunk => chunks.push(chunk as Buffer));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  })).toString("utf8");
  expect(ics).toContain("BEGIN:VEVENT");
  // 11:00 KST = 02:00 UTC. 캘린더 앱이 어느 시간대에서 열어도 같은 시각을 가리켜야 한다.
  expect(ics).toContain("DTSTART:20260922T020000Z");
  expect(ics).toContain("END:VCALENDAR");
});

test("날짜를 바꾸면 담아둔 장소가 비워지는 것을 알려준다", async ({ page }) => {
  await page.goto("/plan");
  await page.getByLabel("여행 날짜").fill("2026-09-22");
  await page.getByRole("button", { name: "갈 곳 보기" }).click();
  await page.getByRole("button", { name: "담기 HiKR Ground · K-pop floors", exact: true }).click();
  await page.getByRole("button", { name: "하루 다시 정하기" }).click();
  await page.getByLabel("여행 날짜").fill("2026-09-23");
  await expect(page.getByRole("status").filter({ hasText: "1곳을 비웠어요" })).toBeVisible();
});
