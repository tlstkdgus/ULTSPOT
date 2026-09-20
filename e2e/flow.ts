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
  ko: ["최애 고르기", "갈 곳 고르기", "기간 정하기", "일정 받기"],
  en: ["Your artist", "Your spots", "Your days", "Your setlist"],
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

/**
 * /api/travel 응답을 고정한다. 화면을 검사하는 스펙이 실제 카카오 호출을 일으키면
 * 뷰포트마다 무료 쿼터를 태우고, 그 요청이 IP별 분당 상한을 밀어 올려 200·400을 기대하는
 * travel.spec.ts를 429로 깨뜨린다. 서버 라우트 자체는 travel.spec.ts가, UI에서 실제 API까지
 * 가는 경로는 planner.spec.ts가 검사한다. 여기서는 응답 형태만 지킨다.
 */
export const FIXED_TRAVEL_MINUTES = 20;
export async function fixTravelLookups(page: Page) {
  await page.route("**/api/travel", async route => {
    const body = route.request().postDataJSON() as {
      mode?: "transit" | "walk";
      legs?: { from: { id: string }; to: { id: string } }[];
    };
    const mode = body.mode ?? "transit";
    const estimates = Object.fromEntries((body.legs ?? []).map(leg => [`${leg.from.id}>${leg.to.id}:${mode}`, {
      status: "known", mode, minutes: FIXED_TRAVEL_MINUTES, transfers: 0, fareKrw: 1_550,
      steps: [{ mode: "subway", minutes: FIXED_TRAVEL_MINUTES, name: "2호선" }],
      provider: "test-fixture", fetchedAt: new Date().toISOString(),
      manualUrl: `https://map.kakao.com/link/by/traffic/${leg.from.id},${leg.to.id}`,
    }]));
    await route.fulfill({ json: { configured: true, estimates, budgetExhausted: false } });
  });
}

/** 2박 3일 여정 화면까지 간다. 담은 곳은 Day 1에 고른 순서대로 들어간다. */
export async function twoNightJourney(page: Page, spots: string[]) {
  await fixTravelLookups(page);
  await page.goto("/plan");
  await browseAllSpots(page);
  for (const name of spots) await page.getByRole("button", { name: `Add ${name}`, exact: true }).click();
  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByLabel("Last day").fill("2026-09-24");
  await page.getByRole("button", { name: "Build my itinerary" }).click();
}
