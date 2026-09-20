/**
 * 구간별 이동시간 계약.
 *
 * 핵심 규칙: **모르는 것을 아는 것처럼 만들지 않는다.**
 * 조회가 성공한 구간만 `known`이고, 그 밖의 모든 경우(키 없음·좌표 없음·조회 실패·경로 없음)는
 * `unconfirmed`다. `unconfirmed`는 계획용 여유 시간(`bufferMinutes`)으로 일정을 잡되,
 * 화면과 내보내기에서 정확한 동선처럼 보이면 안 되고 직접 확인 경로(`manualUrl`)를 함께 준다.
 *
 * 실제 API 호출은 이 파일에 없다. 서버(src/app/api/travel)가 조회해 이 형태로 돌려준다.
 */

import { mapLinks, type TravelPoint } from "./geo";

export type TravelMode = "transit" | "walk";

/** t.lib 사전에 한국어 대응을 넣을 영어 원문. 사전에 없으면 원문이 그대로 노출된다. */
export const travelReasons = {
  noKey: "Route lookup is not set up yet, so travel time is unconfirmed.",
  noCoord: "This stop has no checked coordinates yet, so travel time is unconfirmed.",
  noRoute: "No public transport route was found for this leg.",
  samePoint: "Start and end are the same place.",
  lookupFailed: "Route lookup failed, so travel time is unconfirmed.",
  timedOut: "Route lookup took too long, so travel time is unconfirmed.",
  budgetReached: "Today's route lookup limit is reached, so travel time is unconfirmed.",
  tooFar: "This leg is too far for a single route lookup.",
  notRequested: "Travel time was not looked up for this leg.",
} as const;

export type TravelReason = (typeof travelReasons)[keyof typeof travelReasons];

export type TravelStep = { mode: TravelMode | "bus" | "subway"; minutes: number; name?: string };

export type TravelKnown = {
  status: "known";
  mode: TravelMode;
  /** 문 앞에서 문 앞까지 분. 올림한 정수. */
  minutes: number;
  transfers: number | null;
  /** 원. null은 무료가 아니라 미확인. */
  fareKrw: number | null;
  steps: TravelStep[];
  provider: string;
  /** 조회 시각 ISO. 대중교통 소요시간은 시간대에 따라 달라지므로 언제 본 값인지 표시한다. */
  fetchedAt: string;
  manualUrl: string;
};

export type TravelUnconfirmed = {
  status: "unconfirmed";
  reason: TravelReason;
  /** 사용자가 정한 계획용 여유 시간. 조회된 소요시간이 아니다. */
  bufferMinutes: number;
  manualUrl: string;
};

export type TravelEstimate = TravelKnown | TravelUnconfirmed;

/** 구간 키. 같은 방향만 같은 키다 (대중교통은 왕복 소요시간이 다를 수 있다). */
export const legKey = (fromId: string, toId: string, mode: TravelMode) => `${fromId}>${toId}:${mode}`;

/** 일정 계산이 쓰는 조회 결과 모음. 없는 구간은 undefined를 돌려준다. */
export type TravelTable = Readonly<Record<string, TravelEstimate | undefined>>;

export function unconfirmed(
  from: TravelPoint, to: TravelPoint, mode: TravelMode, bufferMinutes: number, reason: TravelReason,
): TravelUnconfirmed {
  return { status: "unconfirmed", reason, bufferMinutes, manualUrl: mapLinks.route(from, to, mode === "walk" ? "walk" : "traffic") };
}

/**
 * 일정 계산에 쓸 분. `known`이면 실제 조회값, 아니면 계획용 여유 시간.
 * 두 경우를 같은 숫자로 합치지만, 상태는 Stop에 그대로 남아 화면에서 구분된다.
 */
export const travelMinutes = (estimate: TravelEstimate | undefined, bufferMinutes: number) =>
  estimate?.status === "known" ? estimate.minutes : estimate?.bufferMinutes ?? bufferMinutes;

/** 일정 전체에 확정되지 않은 구간이 하나라도 있는지. 있으면 "정확한 동선"이라고 말할 수 없다. */
export const hasUnconfirmedTravel = (estimates: (TravelEstimate | null | undefined)[]) =>
  estimates.some(e => !e || e.status !== "known");
