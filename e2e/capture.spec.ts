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

  test("plan-itinerary", async ({ page }, testInfo) => {
    test.skip(!!only?.length && !only.includes("plan"), "plan capture not requested");
    await page.goto("/plan", { waitUntil: "networkidle" });
    await page.getByLabel("Travel date").fill("2026-09-22");
    for (const name of ["HiKR Ground · K-pop floors", "Music Korea · Myeongdong 2", "K-Star Road"])
      await page.getByRole("button", { name: `Select ${name}`, exact: true }).click();
    await page.getByRole("button", { name: "Build my itinerary" }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join("docs", "tasks", taskId!, "screenshots", `plan-itinerary-${testInfo.project.name}.png`), fullPage: true, animations: "disabled" });
  });
});
