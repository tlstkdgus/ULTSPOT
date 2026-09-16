import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * 뷰포트 3종 — 반응형 웹앱이라 모든 캡처·테스트를 세 폭에서 돈다.
 * mobile 390 = iPhone 13~16 기본 폭, tablet 768 = md 브레이크포인트, desktop 1440 = 일반 노트북.
 */
export const viewports = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 1, isMobile: false, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
  projects: Object.entries(viewports).map(([name, { width, height, ...rest }]) => ({
    name,
    use: { ...devices["Desktop Chrome"], viewport: { width, height }, ...rest },
  })),
  // 캡처는 dev 서버가 아니라 프로덕션 빌드로 찍는다.
  // dev 모드는 좌하단 개발 인디케이터가 화면에 찍히고, 실제 배포 화면과 폰트 로딩 타이밍도 다르다.
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
