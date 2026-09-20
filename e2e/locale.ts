import { test } from "@playwright/test";
import { localeCookie } from "../src/i18n/config";

/**
 * 제품 기본값은 한국어다. 기존 흐름 테스트는 영어 화면을 검증하므로 언어 쿠키를 먼저 심는다.
 * 서버가 이 쿠키를 읽어 첫 렌더부터 영어로 그리기 때문에 화면 전환을 기다릴 필요가 없다.
 */
export function englishLocale() {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([{ name: localeCookie, value: "en", url: baseURL! }]);
  });
}
