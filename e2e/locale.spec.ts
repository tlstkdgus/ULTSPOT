import { expect, test } from "@playwright/test";
import { localeCookie } from "../src/i18n/config";
import { browseAllSpots, goToStep } from "./flow";

test("한국어 브라우저에서 언어 선택이 이동·새로고침 뒤에도 유지된다", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  // 언어는 4개라 select로 고른다 (T-022).
  const picker = page.getByLabel("언어");
  await expect(picker).toHaveValue("ko");

  await picker.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Plan my trip" })).toBeVisible();

  // 다른 페이지로 이동해도, 새로고침해도 영어가 유지된다 (쿠키를 서버가 읽는다).
  await page.getByRole("link", { name: "Plan my trip" }).click();
  // 배포 직후 첫 요청은 콜드 스타트로 느리다(프로덕션에서 17.8초를 봤다). 이동을 먼저 기다린다.
  await page.waitForURL("**/plan");
  // 첫 단계는 최애 고르기다 (T-029). 언어가 유지되는지는 이 단계의 문구로 확인한다.
  await expect(page.getByRole("button", { name: "Browse all K-pop spots" })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Browse all K-pop spots" })).toBeVisible();
  expect(await page.context().cookies().then(all => all.find(c => c.name === localeCookie)?.value)).toBe("en");
});

test("언어를 바꿔도 입력한 날짜·고른 장소·단계가 그대로 남는다", async ({ page }) => {
  await page.goto("/plan");
  // 1단계: 최애 고르기. 아티스트 선택이 언어를 바꿔도 유지되어야 한다.
  // 228명이 들어오면서 "지수 Jisoo · 블랙핑크 멤버" 같은 멤버 버튼 4개도 "블랙핑크"를 품는다.
  // 그룹 버튼은 이름이 그룹명으로 시작한다 (artist-directory.spec.ts와 같은 방식, T-045).
  await page.getByRole("list", { name: "검색 결과" }).getByRole("button", { name: /^블랙핑크 / }).click();
  await page.getByRole("button", { name: "이 최애의 장소 보기" }).click();
  await page.getByRole("button", { name: "담기 하이커 그라운드 · K팝 체험 공간", exact: true }).click();
  await expect(page.getByText("1 / 6곳 담음")).toBeVisible();
  // 3단계에서 날짜를 넣는다.
  await goToStep(page, 2, "ko");
  await page.getByLabel("여행 날짜").fill("2026-09-22");

  await page.getByLabel("언어").selectOption("en");
  // 같은 단계, 같은 입력이 유지되어야 한다.
  await expect(page.getByLabel("Travel date")).toHaveValue("2026-09-22");
  await goToStep(page, 1, "en");
  await expect(page.getByText("1 / 6 added")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove HiKR Ground · K-pop floors", exact: true })).toBeVisible();
  await goToStep(page, 0, "en");
  await expect(page.getByRole("list", { name: "Search results" }).getByRole("button", { name: /^BLACKPINK / }))
    .toHaveAttribute("aria-pressed", "true");
});

test("고르기 전에 운영 상태를 알리고, 일정은 캘린더 파일로 받을 수 있다", async ({ page }) => {
  await page.goto("/plan");
  await browseAllSpots(page, "ko");

  // 운영시간 미확인(K-Star Road)은 담기 전에 자동 일정 제외 사유가 보인다.
  await expect(page.getByText("운영시간 미확인").first()).toBeVisible();
  await expect(page.getByText("자동 일정에는 들어가지 않아요").first()).toBeVisible();
  // PR #48로 카탈로그 6곳이 모두 이미지를 갖게 돼 "사진 준비 중" 자리표시자는 더 이상 나오지
  // 않는다. 자리표시자 대신 실제 사진이 붙었는지를 본다 (자리표시자 자체는 개인 행사에 남아 있다).
  await expect(page.getByRole("img", { name: "하이커 그라운드 · K팝 체험 공간" })).toBeVisible();

  await page.getByRole("button", { name: "담기 하이커 그라운드 · K팝 체험 공간", exact: true }).click();
  await goToStep(page, 2, "ko");
  await page.getByLabel("여행 날짜").fill("2026-09-22");
  await page.getByRole("button", { name: "일정 만들기" }).click();
  // T-036이 요약 타일을 넣으면서 "1곳 방문"이 타일과 요약 줄 두 곳에 나온다. 여기서 보는 것은
  // 편성 결과가 한 곳이라는 사실이므로 첫 번째면 충분하다.
  await expect(page.getByText("1곳 방문", { exact: false }).first()).toBeVisible();

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

test("날짜를 바꾸면 그날 열지 않는 곳을 알려주되 담아둔 것을 지우지 않는다", async ({ page }) => {
  await page.goto("/plan");
  await browseAllSpots(page, "ko");
  // 하이커 그라운드는 월요일 휴관이다. 2026-09-28이 월요일.
  // 오늘 날짜를 쓰지 않는다: 여행 날짜 입력의 기본값이 오늘이라 같은 값을 fill하면 change가
  // 일어나지 않고 changeDate()가 돌지 않는다. 2026-09-21을 쓰던 이 검사는 그날이 오자 깨졌다.
  await page.getByRole("button", { name: "담기 하이커 그라운드 · K팝 체험 공간", exact: true }).click();
  await goToStep(page, 2, "ko");
  await page.getByLabel("여행 날짜").fill("2026-09-28");
  await expect(page.getByRole("status").filter({ hasText: "이 날짜에 열지 않아요" })).toBeVisible();
  // 담은 것은 그대로 남아 있다 (T-029: 날짜가 장소 뒤로 내려가서 조용히 지우면 안 된다).
  await goToStep(page, 1, "ko");
  await expect(page.getByRole("button", { name: "빼기 하이커 그라운드 · K팝 체험 공간", exact: true })).toBeVisible();
  // 여는 날짜로 바꾸면 안내가 사라진다.
  await goToStep(page, 2, "ko");
  await page.getByLabel("여행 날짜").fill("2026-09-29");
  await expect(page.getByRole("status").filter({ hasText: "이 날짜에 열지 않아요" })).toHaveCount(0);
  // 일정에서는 제외 사유로 설명한다.
  await page.getByLabel("여행 날짜").fill("2026-09-28");
  await page.getByRole("button", { name: "일정 만들기" }).click();
  await expect(page.getByText("이 요일은 휴무예요", { exact: false })).toBeVisible();
});

// 언어마다 새 컨텍스트를 열어야 해서 테스트를 나눈다. 한 테스트에서 4번 열면 30초 제한에 걸린다.
for (const [browserLocale, lang, heading] of [
  ["ja-JP", "ja", "使い方"],
  ["zh-CN", "zh-Hans", "使用方式"],
  ["en-GB", "en", "How it works"],
  ["fr-FR", "en", "How it works"],
] as const) {
  test(`쿠키가 없으면 ${browserLocale} 브라우저는 ${lang} 화면을 받는다`, async ({ browser, baseURL }) => {
    // 브라우저 컨텍스트를 새로 여는 테스트라 병렬 실행에서는 기본 30초로 부족하다.
    test.slow();
    // 설정의 locale(ko-KR)이 헤더를 덮으므로 컨텍스트 로케일로 지정한다.
    const context = await browser.newContext({ locale: browserLocale, baseURL });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.getByText(heading)).toBeVisible();
    await context.close();
  });
}

test("고른 언어는 브라우저 언어보다 우선한다", async ({ browser, baseURL }) => {
  test.slow();
  const context = await browser.newContext({ locale: "ja-JP", baseURL });
  const page = await context.newPage();
  await page.goto("/plan");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await page.getByLabel("言語").selectOption("zh");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
  await context.close();
});
