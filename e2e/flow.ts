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
export async function twoNightJourney(page: Page, spots: string[], suggestions: FixtureSuggestion[] = []) {
  await fixTravelLookups(page);
  // 여정 화면도 빈 시간 추천을 부른다(T-063). 실제 카카오·Jev를 태우지 않게 고정한다. 기본은 "찾은 곳 없음".
  await fixSuggestions(page, suggestions);
  await page.goto("/plan");
  await browseAllSpots(page);
  for (const name of spots) await page.getByRole("button", { name: `Add ${name}`, exact: true }).click();
  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByLabel("Last day").fill("2026-09-24");
  await page.getByRole("button", { name: "Build my itinerary" }).click();
}

/**
 * /api/recommend 응답을 고정한다 (T-049).
 *
 * 일정 화면이 빈 시간마다 주변 추천을 자동으로 부르게 되면서, 결과 화면까지 가는 스펙이 전부
 * 카카오 장소 검색·Jev를 부르게 됐다. 그대로 두면 뷰포트마다 무료 쿼터를 태우고, IP당 분당 30회
 * 상한에 걸려 recommend.spec.ts의 200 기대가 429로 깨진다. 서버 라우트는 recommend.spec.ts가
 * 직접 검사하므로 화면 스펙에서는 응답 형태만 지킨다. 기본은 "찾은 곳 없음"이다.
 */
export type FixtureSuggestion = {
  id: string; kind: "meal" | "cafe" | "sightseeing"; name: string; lat: number; lng: number; category?: string;
  /** TourAPI처럼 영업시간을 아는 후보(T-050). 없으면 카카오 후보처럼 미확인이다. */
  hours?: { opens: number; closes: number; breaks?: [number, number][]; closedDays?: number[]; note?: string };
  /** 관광공사 사진처럼 이용 조건을 아는 사진(T-051). */
  photo?: { url: string; license: "kogl-1" | "kogl-3" };
};
export async function fixSuggestions(page: Page, suggestions: FixtureSuggestion[] = [], ranked = false) {
  /**
   * Google 장소 사진도 고정한다(T-054). 프로덕션처럼 Google 지도 키가 있는 배포에 check:prod를 돌리면
   * 추천 카드마다 실제 /api/place-photo가 불려, IP당 분당 20회 상한에 걸려 google.spec이 429로 깨지고
   * **하루 30장의 Google 사진 예산을 테스트가 다 써 버렸다**(2026-09-25). 라우트 자체는 google.spec이 검사한다.
   * 요청은 가로채도 page.on("request")에는 잡히므로 "언제 요청하는가"는 여전히 검사할 수 있다.
   */
  await page.route("**/api/place-photo", route => route.fulfill({ json: { configured: true, photo: null } }));
  await page.route("**/api/recommend", async route => {
    const body = route.request().postDataJSON() as { kinds?: string[]; excluded?: string[] };
    const kinds = body.kinds ?? [];
    const excluded = body.excluded ?? [];
    await route.fulfill({ json: {
      configured: { places: true, ranking: ranked }, anchorKnown: true, autoScheduled: false,
      ranking: ranked ? { applied: true, fallbackReason: null, model: "jev-test", latencyMs: 1 } : null,
      suggestions: suggestions.filter(s => kinds.includes(s.kind) && !excluded.includes(s.id)).map(s => ({
        id: s.id, kind: s.kind, name: s.name, category: s.category ?? "", address: `${s.name} 주소`,
        coord: { lat: s.lat, lng: s.lng }, straightMeters: 300, evidence: "nearby", hoursKnown: !!s.hours,
        photo: s.photo ? { ...s.photo, provider: "tour", authors: [] } : null,
        hours: s.hours ? { breaks: [], closedDays: [], note: "", source: "한국관광공사 TourAPI", modified: "2025-01-03", ...s.hours } : null,
        provider: "test-fixture", placeUrl: `https://place.map.kakao.com/${s.id}`, mapUrl: "https://map.kakao.com/",
        score: null, confidence: null,
      })),
    } });
  });
}
