import { test } from "@playwright/test";
import path from "node:path";
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
    await page.getByLabel("여행 날짜").fill("2026-09-22");
    await page.getByRole("button", { name: "갈 곳 보기" }).click();
    for (const name of ["하이커 그라운드 · K팝 체험 공간", "뮤직코리아 · 명동 2호점", "한류스타거리 K-STAR ROAD"])
      await page.getByRole("button", { name: `담기 ${name}`, exact: true }).click();
    await page.getByRole("button", { name: "일정 만들기" }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-itinerary"), fullPage: true, animations: "disabled" });
  });
  test("plan-spots", async ({ page }, testInfo) => {
    test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
    await page.goto("/plan", { waitUntil: "networkidle" });
    await page.getByLabel("여행 날짜").fill("2026-09-22");
    await page.getByRole("button", { name: "갈 곳 보기" }).click();
    await page.getByRole("button", { name: "담기 하이커 그라운드 · K팝 체험 공간", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-spots"), fullPage: true, animations: "disabled" });
  });
  test("plan-artists", async ({ page }, testInfo) => {
    test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
    await page.goto("/plan", { waitUntil: "networkidle" });
    const results = page.getByRole("list", { name: "검색 결과" });
    await page.getByLabel("여행 날짜").fill("2026-09-22");
    await page.locator("summary").filter({ hasText: "누구를 보러 가요?" }).click();
    await results.getByRole("button", { name: "블랙핑크" }).click();
    await page.getByLabel("아티스트 검색", { exact: true }).fill("필릭스");
    await results.getByRole("button", { name: "필릭스" }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-artists"), fullPage: true, animations: "disabled" });
  });
  test("plan-en", async ({ page, context, baseURL }, testInfo) => {
    test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
    await context.addCookies([{ name: "ultspot-locale", value: "en", url: baseURL! }]);
    await page.goto("/plan", { waitUntil: "networkidle" });
    await page.getByLabel("Travel date").fill("2026-09-22");
    await page.getByRole("button", { name: "Find my spots" }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: shot(testInfo, "plan-en"), fullPage: true, animations: "disabled" });
  });
});
