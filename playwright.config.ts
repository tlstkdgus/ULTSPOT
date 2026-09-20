import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
// E2E_BASE_URL이 있으면 로컬 서버를 띄우지 않고 배포된 주소를 검사한다 (pnpm check:prod).
const remoteURL = process.env.E2E_BASE_URL;
const baseURL = remoteURL ?? `http://127.0.0.1:${PORT}`;

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
  // 프로덕션 빌드를 띄우고 폰트 로딩까지 기다리는 테스트라 기본 30초로는 병렬 실행에서 간헐적으로 모자란다.
  // 느린 검사를 숨기려는 값이 아니라, 단독 실행에서 10초대인 테스트가 부하에서만 넘기는 것을 막는 값이다.
  timeout: 60_000,
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
  webServer: remoteURL
    ? undefined
    : {
        command: `pnpm build && pnpm start --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
