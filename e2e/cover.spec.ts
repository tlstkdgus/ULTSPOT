import path from "node:path";
import { expect, test } from "@playwright/test";
import { goToStep } from "./flow";

/**
 * 제출용 16:9 이미지. `pnpm exec playwright test e2e/cover.spec.ts --project=desktop`로 찍는다.
 *
 * 기존 `pnpm capture`는 `fullPage: true`라 세로로 긴 이미지가 나온다. 대표 이미지는
 * 뷰포트 그대로 잘라야 16:9가 되므로 따로 둔다. 일반 `pnpm test:e2e`에서는 @capture로 빠진다.
 *
 * 화면을 그대로 찍는다. 제출용이라고 따로 그린 포스터가 아니라 실제 제품이어야,
 * 심사자가 보는 것과 이미지가 어긋나지 않는다.
 */
const OUT = path.join("docs", "submission");

/**
 * 1920×1080을 뷰포트로 직접 잡으면 본문이 shell(최대 1080px)에 갇혀 좌우가 크게 빈다.
 * 썸네일로 줄였을 때 글자가 더 작아지므로, 뷰포트를 1280×720으로 좁히고 배율을 1.5배로
 * 올려 같은 1920×1080을 만든다. 화면은 그대로고 프레임만 꽉 찬다.
 */
const SIZE = { width: 1280, height: 720 };
const SCALE = 1.5;

test.describe("cover", { tag: "@capture" }, () => {
  test.use({ viewport: SIZE, deviceScaleFactor: SCALE, locale: "ko-KR" });

  test("cover-home @cover", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "ultspot-locale", value: "ko", url: baseURL! }]);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(async () => { await document.fonts.ready; });

    // 배너가 잘린 채 반쯤 보이면 어정쩡하다. 배너가 시작되기 전에서 끊는다.
    const bannerTop = await page.evaluate(() => {
      const el = document.querySelector("main [class*='rounded-device']");
      return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : Number.POSITIVE_INFINITY;
    });
    expect(bannerTop, "지도 배너가 16:9 안으로 들어와 잘린다 — 뷰포트를 더 늘려야 한다")
      .toBeGreaterThanOrEqual(SIZE.height);

    await page.screenshot({ path: path.join(OUT, "cover-home.png"), animations: "disabled", caret: "hide" });
  });

  test("cover-plan @cover", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "ultspot-locale", value: "ko", url: baseURL! }]);
    await page.goto("/plan", { waitUntil: "networkidle" });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.screenshot({ path: path.join(OUT, "cover-plan.png"), animations: "disabled", caret: "hide" });
  });

  /**
   * 4단계를 순서대로 밟으며 각 화면을 남긴다. 심사자가 흐름을 읽을 수 있어야 한다.
   * 화면에 없는 것을 연출하지 않는다 — 실제로 눌러서 나온 상태만 찍는다.
   */
  test("cover-flow @cover", async ({ page, context, baseURL }) => {
    test.slow();
    await context.addCookies([{ name: "ultspot-locale", value: "ko", url: baseURL! }]);
    await page.goto("/plan", { waitUntil: "networkidle" });
    await page.evaluate(async () => { await document.fonts.ready; });

    const shot = (name: string) =>
      page.screenshot({ path: path.join(OUT, `flow-${name}.png`), animations: "disabled", caret: "hide" });

    await shot("1-favorite");

    await page.getByRole("button", { name: "K팝 장소 전체 둘러보기" }).click();
    await page.waitForLoadState("networkidle");
    await shot("2-spots");

    // 검증된 장소 두 곳을 담는다. 없는 데이터를 만들어 넣지 않는다.
    const add = page.getByRole("button", { name: /^\s*담기/ });
    const count = Math.min(await add.count(), 2);
    for (let i = 0; i < count; i++) await add.nth(0).click();
    await shot("2-spots-picked");

    // 같은 이름의 버튼이 단계 레일과 본문 CTA 양쪽에 있어 도우미로 범위를 좁힌다.
    await goToStep(page, 2, "ko");
    await shot("3-period");

    // 4단계 레일 버튼은 일정이 만들어지기 전까지 비활성이다. 본문 CTA로 먼저 만든다.
    await page.getByRole("button", { name: "일정 만들기" }).last().click();
    await page.waitForLoadState("networkidle");
    await shot("4-itinerary");
  });
});
