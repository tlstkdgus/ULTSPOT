import { expect, test } from "@playwright/test";
import { captureRoutes } from "./routes";

for (const route of captureRoutes) {
  test(`${route.name} 화면이 가로 스크롤 없이 렌더링된다`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(route.path);
    await expect(page.locator("h1, h2").first()).toBeVisible();

    // 반응형 필수 조건: 어떤 뷰포트에서도 문서가 뷰포트보다 넓어지면 안 된다.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}
