import type { Page } from "@playwright/test";

/**
 * /plan 단계 이동 도우미.
 *
 * T-029에서 흐름이 3단계(하루 → 갈 곳 → 일정)에서 4단계(최애 → 갈 곳 → 기간 → 일정)로 바뀌었다.
 * 날짜 입력이 첫 화면에서 3번째 단계로 내려갔기 때문에, 날짜를 쓰려는 테스트는 먼저 그 단계로
 * 이동해야 한다. 단계 이름을 여기 한 곳에만 두어 문구가 바뀔 때 테스트 여러 개를 고치지 않는다.
 */
export const stepNavLabel = { ko: "일정 만들기 단계", en: "Trip steps" } as const;

export const stepLabels = {
  ko: ["최애 선택", "SPOT 고르기", "기간 정하기", "일정 받기"],
  en: ["Your ULT", "Your SPOTs", "Your dates", "Your itinerary"],
} as const;

export type FlowLocale = keyof typeof stepLabels;

/**
 * 상단 단계 내비게이션으로 이동한다.
 * 같은 이름의 버튼이 본문 CTA에도 있으므로 내비게이션 안으로 범위를 좁힌다.
 */
export async function goToStep(page: Page, index: 0 | 1 | 2 | 3, locale: FlowLocale = "en") {
  await page
    .getByRole("navigation", { name: stepNavLabel[locale] })
    .getByRole("button", { name: stepLabels[locale][index], exact: true })
    .click();
}

/** 최애를 고르지 않고 갈 곳 고르기로 넘어간다 (첫 단계의 건너뛰기 CTA). */
export async function browseAllSpots(page: Page, locale: FlowLocale = "en") {
  const label = locale === "ko" ? "K팝 장소 전체 둘러보기" : "Browse all K-pop spots";
  await page.getByRole("button", { name: label }).click();
}
