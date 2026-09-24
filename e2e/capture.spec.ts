import { expect, test } from "@playwright/test";
import path from "node:path";
import { browseAllSpots, goToStep } from "./flow";
import { captureRoutes } from "./routes";

/**
 * `pnpm capture <TASK-ID>` 로 실행한다 (scripts/capture.mjs).
 * 결과: docs/tasks/<TASK-ID>/screenshots/<route>-<viewport>.png
 * 일반 `pnpm test:e2e` 에서는 @capture 태그로 제외된다.
 */
const taskId = process.env.CAPTURE_TASK;
const only = process.env.CAPTURE_ROUTES?.split(",").filter(Boolean);

test.describe("screenshots", { tag: "@capture" }, () => {
  test.skip(!taskId, "CAPTURE_TASK가 없으면 캡처하지 않는다 — pnpm capture <TASK-ID> 로 실행");

  const routes = only?.length ? captureRoutes.filter((r) => only.includes(r.name)) : captureRoutes;

  test("home-fallback", async ({ browser, baseURL, page: referencePage }, testInfo) => {
    test.skip(!!only?.length && !only.includes("home-fallback"), "fallback capture not requested");
    const context = await browser.newContext({ baseURL, locale: "fr-FR", viewport: referencePage.viewportSize(), deviceScaleFactor: testInfo.project.use.deviceScaleFactor });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join("docs", "tasks", taskId!, "screenshots", `home-fallback-${testInfo.project.name}.png`), fullPage: true });
    await context.close();
  });

  for (const route of routes) {
    test(route.name, async ({ page }, testInfo) => {
      await page.goto(route.path, { waitUntil: "networkidle" });
      // 폰트가 늦게 붙으면 대체 폰트로 찍히므로 반드시 기다린다.
      await page.evaluate(() => document.fonts.ready);

      const file = path.join("docs", "tasks", taskId!, "screenshots", `${route.name}-${testInfo.project.name}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: "disabled", caret: "hide" });
    });
  }

  // 캡처는 제품 기본값인 한국어 화면으로 찍는다. 영어 화면은 plan-en에서 따로 남긴다.
  const shot = (testInfo: { project: { name: string } }, name: string) =>
    path.join("docs", "tasks", taskId!, "screenshots", `${name}-${testInfo.project.name}.png`);

  test("plan-itinerary", async ({ page }, testInfo) => {
    test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
    await page.goto("/plan", { waitUntil: "networkidle" });
    await browseAllSpots(page, "ko");
    for (const name of ["하이커 그라운드 · K팝 체험 공간", "뮤직코리아 · 명동 2호점", "한류스타거리 K-STAR ROAD"])
      await page.getByRole("button", { name: `담기 ${name}`, exact: true }).click();
    await goToStep(page, 2, "ko");
    await page.getByLabel("여행 날짜").fill("2026-09-22");
    await page.getByRole("button", { name: "일정 만들기" }).click();
    // 이동시간 조회가 끝난 뒤에 찍는다. 조회 중 화면을 캡처하면 여유 시간 기준 일정이 결과처럼 남는다.
    await expect(page.getByRole("status").filter({ hasText: "이동시간을 확인하는 중이에요" })).toHaveCount(0, { timeout: 20_000 });
    // 빈 시간 추천(T-049)도 다 채운 뒤에 찍는다. 이 캡처는 실제 카카오·Jev 응답을 쓴다.
    await expect(page.getByRole("status").filter({ hasText: "주변에서 찾는 중" })).toHaveCount(0, { timeout: 30_000 });
    // 추천 사진(T-051)이 다 받아진 뒤에 찍는다. lazy 이미지라 먼저 화면으로 끌어온다.
    // 반쯤 받은 JPEG가 위쪽만 찍힌 캡처가 나온 적이 있다.
    await page.evaluate(async () => {
      for (const img of Array.from(document.images)) img.loading = "eager";
      await Promise.all(Array.from(document.images).map(img => img.complete ? null : new Promise(done => { img.onload = img.onerror = done; })));
      // complete여도 아직 칠해지지 않은 사진이 빈 칸으로 찍혔다. 디코딩까지 기다린다.
      await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => null)));
    });
    // Google 지도(T-052)는 타일을 나중에 받는다. 타일 요청이 끝나고 칠해질 때까지 기다린다.
    // 기다리지 않으면 핀만 있고 바탕이 회색인 지도가 찍혔다.
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1_500);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-itinerary"), fullPage: true, animations: "disabled" });
  });
  /** 공지 보고 행사 추가 폼의 장소 검색(T-062). 실제 카카오 검색 결과를 찍는다. */
  test("plan-place-search", async ({ page }, testInfo) => {
    test.skip(!!only?.length && !only.includes("place-search"), "place search capture not requested");
    await page.goto("/plan", { waitUntil: "networkidle" });
    await browseAllSpots(page, "ko");
    await page.getByText("공지 보고 행사 추가", { exact: true }).first().click();
    await page.getByLabel("지도에서 장소 찾기 (선택)").fill("스타벅스 명동");
    await page.getByLabel("지도에서 장소 찾기 (선택)").press("Enter");
    await expect(page.getByRole("button", { name: /선택$/ }).first()).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready);
    // 장소 목록 전체를 찍으면 폼이 페이지 맨 아래에 작게 묻힌다. 폼만 찍는다.
    const form = page.locator("details").filter({ has: page.getByLabel("지도에서 장소 찾기 (선택)") });
    await form.screenshot({ path: shot(testInfo, "plan-place-search"), animations: "disabled" });
  });
  /**
   * 여정 화면의 현장 기록(체크인·가계부·발자취). T-038에서 붙었고 captureRoutes로는 닿지
   * 않는다 — 기간을 이틀 이상으로 잡고 일정을 만들어야 나오는 화면이라 경로만으로는 못 간다.
   * 빈 화면이 아니라 실제로 기록이 들어간 상태를 찍는다. 빈 패널은 이 작업이 무엇을 바꿨는지
   * 보여주지 못한다.
   */
  test("journey-records", async ({ page }, testInfo) => {
    test.skip(!!only?.length && !only.includes("journey-records"), "journey capture not requested");
    await page.goto("/plan", { waitUntil: "networkidle" });
    await browseAllSpots(page, "ko");
    for (const name of ["하이커 그라운드 · K팝 체험 공간", "뮤직코리아 · 명동 2호점"])
      await page.getByRole("button", { name: `담기 ${name}`, exact: true }).click();
    await goToStep(page, 2, "ko");
    await page.getByLabel("여행 날짜").fill("2026-09-22");
    await page.getByLabel("마지막날").fill("2026-09-24");
    await page.getByRole("button", { name: "일정 만들기" }).click();

    // 한 곳은 다녀온 것으로 표시하고 지출도 한 건 넣는다.
    await page.getByRole("button", { name: "다녀왔어요: 하이커 그라운드 · K팝 체험 공간" }).click();
    const spend = page.getByRole("region", { name: "쓴 돈" });
    await spend.getByLabel("금액(원)").fill("8500");
    await spend.getByLabel("무엇에 썼나요 (선택)").fill("컵홀더 세트");
    await spend.getByRole("button", { name: "지출 추가" }).click();
    await expect(spend.getByText("₩8,500").first()).toBeVisible();

    // 이동시간 조회 중 화면을 찍지 않는다.
    await expect(page.getByRole("status").filter({ hasText: "이동시간을 확인하는 중이에요" })).toHaveCount(0, { timeout: 20_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "journey-records"), fullPage: true, animations: "disabled" });
  });
  test("plan-spots", async ({ page }, testInfo) => {
    test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
    await page.goto("/plan", { waitUntil: "networkidle" });
    await browseAllSpots(page, "ko");
    await page.getByRole("button", { name: "담기 하이커 그라운드 · K팝 체험 공간", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-spots"), fullPage: true, animations: "disabled" });
  });
  test("plan-artists", async ({ page }, testInfo) => {
    test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
    await page.goto("/plan", { waitUntil: "networkidle" });
    const results = page.getByRole("list", { name: "검색 결과" });
    await results.getByRole("button", { name: "블랙핑크" }).click();
    await page.getByLabel("아티스트 검색", { exact: true }).fill("필릭스");
    await results.getByRole("button", { name: "필릭스" }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-artists"), fullPage: true, animations: "disabled" });
  });
  // 4개 언어 화면을 한 장씩 남긴다. 장소 이름·설명은 데이터 원문(한국어/영어)이라 언어와 무관하게 같다.
  for (const locale of ["en", "ja", "zh"] as const) {
    test(`plan-${locale}`, async ({ page, context, baseURL }, testInfo) => {
      test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
      await context.addCookies([{ name: "ultspot-locale", value: locale, url: baseURL! }]);
      await page.goto("/plan", { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: shot(testInfo, `plan-${locale}`), fullPage: true, animations: "disabled" });
    });
  }
  test("plan-en-spots", async ({ page, context, baseURL }, testInfo) => {
    test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
    await context.addCookies([{ name: "ultspot-locale", value: "en", url: baseURL! }]);
    await page.goto("/plan", { waitUntil: "networkidle" });
    await browseAllSpots(page);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-en"), fullPage: true, animations: "disabled" });
  });
});
