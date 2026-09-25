/**
 * 추천 후보 → 개인 장소 (T-066·T-068). 당일 일정의 "담기"·"일정에 넣기"와 여러 날 여정의 "일정에 넣기"가 같은 규칙을 쓴다.
 *
 * - 영업시간: 관광공사에서 받은 시간이 있고 브레이크가 없을 때만 그 시간·요일 휴무를 쓴다. 편성기는 브레이크를 모르므로
 *   브레이크가 있는 시간을 넘기면 그 사이에 도착하는 일정을 만든다.
 * - 영업시간을 모르면: 빈 시간 카드에서 넣은 경우(visit 있음) 카드의 방문 시간을 그곳의 시간으로 삼고, 그게 가게
 *   영업시간이 아니라고 적는다. 목록에서 담기만 한 경우는 null(자동 편성 대상 아님)이다.
 * - 좌표: 출처를 댈 수 있는 후보만 유지한다 — 카카오 장소 페이지, 관광공사 콘텐츠 ID. 저장본은 이 두 출처의 좌표만 받는다.
 */

import type { CoordRecord } from "./geo";
import type { FanEvent } from "./planner";
import { PLACE_SEARCH_SOURCE, TOUR_PLACE_SOURCE } from "./place-search";
import { hoursLabel } from "../recommend/hours-label";

/** 추천 후보 중 개인 장소로 옮길 때 쓰는 필드만. RankedSuggestion·Suggestion 모두 이 모양을 가진다. */
export type SuggestionLike = {
  id: string; kind: string; name: string; category: string; address: string;
  coord: { lat: number; lng: number };
  hours: { opens: number; closes: number; closedDays: number[]; breaks: unknown[]; modified: string } | null;
  provider: string; placeUrl: string;
};

export type SuggestionCopy = {
  kind: (kind: string) => string;
  hoursSource: (modified: string) => string;
  hoursUnknown: string;
  keptHours: string;
  /** 영업시간을 아는 곳을 카드의 방문 시간에 고정해 넣었을 때. hours는 "11:00–21:00" 꼴. */
  keptKnown: (hours: string) => string;
  provider: (name: string) => string;
};

/** 후보의 좌표를 출처와 함께. 출처를 댈 수 없는 후보(테스트 고정값 등)는 undefined. */
export function suggestionCoord(suggestion: Pick<SuggestionLike, "id" | "coord">, checkedOn: string): CoordRecord | undefined {
  const kakao = /^kakao-(\d+)$/.exec(suggestion.id);
  const tour = /^tour-(\d+)$/.exec(suggestion.id);
  const source = kakao ? `https://place.map.kakao.com/${kakao[1]}`
    : tour ? `https://apis.data.go.kr/B551011/KorService2/detailCommon2?contentId=${tour[1]}` : null;
  if (!source || !(PLACE_SEARCH_SOURCE.test(source) || TOUR_PLACE_SOURCE.test(source))) return undefined;
  return { lat: suggestion.coord.lat, lng: suggestion.coord.lng, source, checked_on: checkedOn };
}

/**
 * 여정에서 넣은 추천의 개인 장소 ID. 개인 장소는 하루짜리라(from = to) 같은 곳을 다른 날에 넣으면 따로 만든다.
 * 당일 일정은 날짜가 하나라 예전처럼 `personal-<후보 id>`를 쓴다(기존 저장본과 같은 ID).
 */
export const keptEventId = (suggestionId: string, date?: string) =>
  date ? `personal-${suggestionId}@${date}` : `personal-${suggestionId}`;

/** 개인 장소 ID → 원래 추천 후보 ID. 추천에서 온 게 아니면 null. 이미 넣은 곳을 다시 권하지 않는 데 쓴다. */
export function suggestionIdOf(eventId: string): string | null {
  return eventId.startsWith("personal-") ? eventId.slice(9).replace(/@\d{4}-\d{2}-\d{2}$/, "") : null;
}

export function suggestionEvent(suggestion: SuggestionLike, options: {
  date: string; today: string; copy: SuggestionCopy; id?: string;
  /** 빈 시간 카드에서 넣을 때의 방문 시간(분). 영업시간을 모를 때 그곳의 시간이 된다. */
  visit?: { opens: number; closes: number };
  /**
   * 영업시간을 알아도 방문 시간으로 고정한다. 당일 일정은 편성기가 순서를 다시 정하므로, 고정하지 않으면 카드에서 본
   * 시각과 다른 자리로 옮겨 갈 수 있다. 여정은 사용자가 정한 순서를 지키므로 고정하지 않고 실제 영업시간을 쓴다.
   */
  pin?: boolean;
}): FanEvent {
  const { date, today, copy, visit } = options;
  const hours = suggestion.hours && !suggestion.hours.breaks.length ? suggestion.hours : null;
  const coord = suggestionCoord(suggestion, today);
  // 24시간 영업은 1440으로 온다. 개인 장소 시각은 23:59까지라 거기서 자른다(저장본 규칙).
  const clampClose = (m: number) => Math.min(m, 1439);
  const window = hours && visit && options.pin
    ? { opens: Math.max(visit.opens, hours.opens), closes: clampClose(Math.min(visit.closes, hours.closes)), closedDays: [...hours.closedDays] }
    : hours ? { opens: hours.opens, closes: clampClose(hours.closes), closedDays: [...hours.closedDays] }
    : visit ? { opens: visit.opens, closes: clampClose(visit.closes), closedDays: [] }
    : { opens: null, closes: null, closedDays: [] };
  return {
    id: options.id ?? keptEventId(suggestion.id), title: suggestion.name,
    area: suggestion.category || copy.kind(suggestion.kind),
    kind: "Personal event", address: suggestion.address || suggestion.name,
    from: date, to: date,
    ...window,
    reservation: false,
    ...(coord ? { coord } : {}),
    do: hours && visit && options.pin ? `${copy.keptKnown(hoursLabel(hours))} · ${copy.hoursSource(hours.modified)}`
      : hours ? copy.hoursSource(hours.modified) : visit ? copy.keptHours : copy.hoursUnknown,
    get: copy.provider(suggestion.provider),
    provenance: { mode: "personal", author: suggestion.provider, checkedOn: date, url: suggestion.placeUrl },
  };
}
