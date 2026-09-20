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
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-itinerary"), fullPage: true, animations: "disabled" });
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
