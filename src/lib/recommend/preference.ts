/**
 * 관심사 칩 + 여행 속도 → 추천 입력.
 *
 * **경계:** 이 값은 추천 순서와 주변 후보 종류에만 쓴다. 운영시간·휴무·예약·입장 마감·이동시간
 * 판정에는 절대 들어가지 않는다. 그 판정은 `unavailableReason`·`scheduleJourneyDay`·카카오 경로
 * API가 한다. 그래서 이 파일은 `planner.ts`를 import하지 않고, planner도 이 파일을 모른다.
 * 취향이 바뀌어도 편성 가능 여부가 바뀌지 않는다는 것을 구조로 보장한다.
 *
 * 테마 테스트는 범위에서 빠졌고(사용자 요청), 여기서 받는 칩이 그 역할을 대신한다.
 */

import type { SuggestionKind } from "./nearby";

/** 화면의 칩 id. i18n의 `interests.items[].id`와 같아야 한다. */
export const interestIds = ["goods", "photo", "meal", "cafe", "quiet"] as const;
export type InterestId = (typeof interestIds)[number];

export const isInterestId = (value: unknown): value is InterestId =>
  typeof value === "string" && (interestIds as readonly string[]).includes(value);

/**
 * Jev에 보낼 취향 문장의 조각. 영어로 두는 이유: 후보의 `facts`가 한국어·영어가 섞여 있고,
 * 평가 기준문(`criteria`)이 영어라 한 언어로 맞추는 쪽이 읽기 쉽다.
 * 사용자 입력을 그대로 보내지 않고 **고정 문구만** 보낸다.
 */
const phrases: Record<InterestId, string> = {
  goods: "official merchandise and albums to buy",
  photo: "places with photo spots",
  meal: "a proper sit-down meal rather than dessert",
  cafe: "a café to rest in",
  quiet: "a quiet, unhurried place rather than a crowded one",
};

/** 칩이 주변 후보 종류를 좁힌다. 아무 칩도 없으면 세 종류를 모두 본다. */
const kindsFor: Partial<Record<InterestId, SuggestionKind[]>> = {
  meal: ["meal"],
  cafe: ["cafe"],
  photo: ["sightseeing"],
  quiet: ["cafe", "sightseeing"],
};

export type PreferenceInput = { interests: string[]; stay: number };

export type PreferenceProfile = {
  /** Jev `state.preference`에 들어갈 문장. 칩이 없으면 빈 문자열이고 그러면 Jev를 부르지 않는다. */
  sentence: string;
  /** 주변 후보 검색에 쓸 종류. */
  kinds: SuggestionKind[];
  /** 정리된 칩 목록(알 수 없는 값 제거, 중복 제거, 화면 순서 유지). */
  interests: InterestId[];
};

export function preferenceProfile({ interests, stay }: PreferenceInput): PreferenceProfile {
  const picked = interestIds.filter(id => interests.includes(id));
  const parts = picked.map(id => phrases[id]);
  // 속도도 취향의 일부다. 한 곳에 오래 머무는 사람에게 "짧게 들르는 곳"을 위로 올리지 않는다.
  if (stay >= 90) parts.push("somewhere worth staying a while");
  else if (stay <= 30) parts.push("somewhere quick to visit");

  const allKinds: readonly SuggestionKind[] = ["meal", "cafe", "sightseeing"];
  const fromChips = picked.flatMap(id => kindsFor[id] ?? []);
  const kinds = fromChips.length ? allKinds.filter(kind => fromChips.includes(kind)) : allKinds;

  return {
    // 칩을 하나도 고르지 않았으면 문장을 만들지 않는다. 없는 취향을 추측하지 않는다.
    sentence: picked.length ? `I want ${parts.join(", and ")}.` : "",
    kinds: [...kinds],
    interests: picked,
  };
}
