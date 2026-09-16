import { expect, test } from "@playwright/test";
import { captureRoutes } from "./routes";

/**
 * 심사자가 "로그아웃·시크릿 모드"로 제출 링크에 들어왔을 때 서비스가 바로 보이는지 검사한다.
 * Playwright는 테스트마다 쿠키·저장소가 빈 새 브라우저 컨텍스트를 쓰므로 시크릿 창과 같은 조건이다.
 * 근거: docs/specs/submission-requirements.md §2-1, §2-3
 *
 * 로컬에서도 돌지만 의미가 있는 건 `pnpm check:prod <URL>`로 배포 주소에 돌릴 때다.
 */
for (const route of captureRoutes) {
  test(`${route.name} — 로그인·비밀번호 없이 열린다`, { tag: "@public" }, async ({ page, baseURL }) => {
    const response = await page.goto(route.path);

    // Vercel Authentication은 vercel.com 로그인으로 리다이렉트한다.
    const landed = new URL(page.url());
    expect(landed.origin, `다른 주소로 이동됨: ${page.url()}`).toBe(new URL(baseURL!).origin);

    // Password Protection은 같은 주소에서 401과 비밀번호 폼을 돌려준다.
    expect(response?.status(), "HTTP 상태").toBe(200);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    // 서비스 본문이 실제로 렌더링됐는지
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
}
