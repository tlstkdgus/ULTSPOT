import type { SuggestionKind } from "@/lib/recommend/nearby";
import type { PlaceHours } from "@/lib/recommend/tour";
import type { Coord, TravelPoint } from "./geo";
import { DESTINATION_ID, ORIGIN_ID, eventPoint, type TripInput, type TripResult } from "./planner";

/**
 * 빈 시간 채우기 (T-049).
 *
 * 일정은 운영시간이 확인된 곳만 넣는다. 그래서 하루에 구멍이 남는다 — "13:18에 끝나요, 18:00까지
 * 4시간 42분 여유". 이 모듈은 그 구멍을 찾고, 주변 추천을 끼워 넣을 수 있는지 **시간만** 계산한다.
 *
 * 경계:
 *  - 확정 일정(planTrip 결과)은 건드리지 않는다. 추천은 확정 정류장 사이의 빈 구간에만 들어간다.
 *  - 추천 후보는 영업시간이 없다(카카오 장소 검색). 여기서 "열려 있다"를 판단하지 않는다. 화면이
 *    "추천 · 영업시간 미확인"으로 구분해 보여준다.
 *  - 취향 순위는 Jev, 이동시간은 카카오 경로 API가 정한다. 여기서는 받은 분을 더하고 뺄 뿐이다.
 */

/** 이보다 짧은 빈 시간은 채우지 않는다. 이동 두 번과 체류를 넣으면 남는 게 없다. */
export const MIN_GAP_MINUTES = 60;
/** 추천 한 곳에 최소 이만큼은 머물 수 있어야 넣는다. */
export const MIN_STAY_MINUTES = 30;
/** 한 번에 채우는 빈 구간 수. 구간마다 장소 검색·이동시간 조회가 나가므로 상한을 둔다. */
export const MAX_GAPS = 3;
/** 빈 구간 하나에 이어 붙이는 추천 수. 4시간 넘게 비는 오후도 식사 → 카페 → 관광 정도로 채운다. */
export const MAX_PER_GAP = 3;
/** 시간대를 판단할 때 보는 앞부분(분). 긴 오후 끝자락이 저녁에 걸친다고 오후 2시에 밥집을 넣지 않는다. */
const LOOKAHEAD_MINUTES = 90;

export type Gap = {
  /** 앞뒤 정류장으로 만든 안정적인 키. 같은 일정이면 같은 키다. */
  id: string;
  /** 빈 시간이 시작하는 시각(분). 앞 정류장을 떠나는 시각이다. */
  start: number;
  /** 빈 시간이 끝나는 시각(분). 다음 정류장에 도착해야 하는 시각이다. */
  end: number;
  /** 추천 장소로 가기 전 있던 곳. null이면 출발지를 모른다(하루의 첫 구멍, 출발지 미입력). */
  from: TravelPoint | null;
  /** 추천 장소 다음에 가야 하는 곳. null이면 돌아갈 곳을 모른다(마지막 구멍, 종료지 미입력). */
  to: TravelPoint | null;
  /** 주변 검색 기준 좌표. 앞 정류장, 없으면 다음 정류장. */
  anchor: Coord;
  /** 이 시간대에 맞는 후보 종류. */
  kinds: SuggestionKind[];
  /** 어디의 빈 시간인지. 화면 문구가 쓴다. */
  position: "before" | "between" | "after";
};

export type GapFit = { arrival: number; departure: number; stay: number };

const overlaps = (start: number, end: number, from: number, to: number) => start < to && end > from;
/** 점심 11:30–14:00, 저녁 17:30–20:00. 이 시간대에 걸치면 식사를 먼저 찾는다. */
const MEAL_WINDOWS: [number, number][] = [[690, 840], [1050, 1200]];

/**
 * 시간대 기본값과 사용자가 고른 관심사를 합친다.
 * 관심사가 시간대와 겹치면 그걸 쓰고, 안 겹치면 시간대를 따른다 — 오후 3시에 "식사만"을 고른 사람에게
 * 억지로 밥집을 넣기보다 카페를 넣는 편이 하루에 맞는다. 관심사를 안 골랐으면 시간대만 본다.
 */
export function kindsForWindow(start: number, end: number, preferred: readonly SuggestionKind[] = []): SuggestionKind[] {
  const until = Math.min(end, start + LOOKAHEAD_MINUTES);
  const mealTime = MEAL_WINDOWS.some(([from, to]) => overlaps(start, until, from, to));
  const byTime: SuggestionKind[] = mealTime ? ["meal", "cafe"] : ["cafe", "sightseeing"];
  if (!preferred.length) return byTime;
  const both = byTime.filter(kind => preferred.includes(kind));
  return both.length ? both : byTime;
}

/**
 * 확정 일정에서 빈 구간을 찾는다. 긴 순서로 최대 MAX_GAPS개.
 *
 * - before: 첫 정류장이 문 열기를 기다리는 시간. 출발지가 있으면 거기서 오는 시간을 뺀다.
 * - between: 앞 정류장을 떠나 다음 정류장까지 가는 시간을 빼고 남는 대기.
 * - after: 마지막 정류장 뒤부터 종료 시각까지. 종료지(숙소)가 있으면 돌아가는 시간을 뺀다.
 */
export function findGaps(result: TripResult | null, input: TripInput, preferred: readonly SuggestionKind[] = []): Gap[] {
  if (!result?.stops.length) return [];
  const stops = result.stops;
  const origin: TravelPoint | null = input.origin
    ? { id: ORIGIN_ID, name: input.origin.label, address: input.origin.address, coord: input.origin.coord } : null;
  const destination: TravelPoint | null = input.destination
    ? { id: DESTINATION_ID, name: input.destination.label, address: input.destination.address, coord: input.destination.coord } : null;

  const gaps: (Gap & { idle: number })[] = [];
  const push = (position: Gap["position"], start: number, end: number, idle: number, from: TravelPoint | null, to: TravelPoint | null, id: string) => {
    if (idle < MIN_GAP_MINUTES) return;
    const anchor = from?.coord ?? to?.coord;
    if (!anchor) return;
    gaps.push({ id, start, end, from, to, anchor, position, idle, kinds: kindsForWindow(start, end, preferred) });
  };

  const first = stops[0];
  const firstPoint = eventPoint(first.event);
  // 출발지가 없으면 첫 정류장의 travel은 0이다(세지 않는다). 있으면 그만큼 일찍 떠나야 한다.
  push("before", input.start, first.arrival, first.arrival - input.start - first.travel,
    origin, firstPoint, `before>${first.event.id}`);

  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const next = stops[i];
    push("between", prev.departure, next.arrival, next.arrival - prev.departure - next.travel,
      eventPoint(prev.event), eventPoint(next.event), `${prev.event.id}>${next.event.id}`);
  }

  const last = stops[stops.length - 1];
  push("after", last.departure, input.end, input.end - last.departure - (result.returnLeg?.minutes ?? 0),
    eventPoint(last.event), destination, `${last.event.id}>after`);

  return gaps
    .sort((a, b) => b.idle - a.idle)
    .slice(0, MAX_GAPS)
    .sort((a, b) => a.start - b.start)
    .map(gap => ({ id: gap.id, start: gap.start, end: gap.end, from: gap.from, to: gap.to, anchor: gap.anchor, kinds: gap.kinds, position: gap.position }));
}

/**
 * 후보 한 곳을 빈 구간에 넣을 수 있는지. 들어가면 도착·출발 시각을, 안 들어가면 null.
 *
 * legIn: from → 후보, legOut: 후보 → to (분). from/to가 없으면 0을 넘긴다.
 * 체류는 사용자가 정한 시간을 우선하고, 모자라면 줄이되 MIN_STAY_MINUTES 밑으로는 넣지 않는다.
 *
 * hours가 있으면(TourAPI, T-050) 여는 시각 전에는 기다리고, 준비시간에는 도착하지도 머무르지도 않으며,
 * 닫는 시각(마지막 주문이 있으면 그 시각)까지 떠난다. 마지막 주문 뒤에도 먹을 수는 있지만, 확인한
 * 시각 안에서만 잡는 쪽이 헛걸음이 없다. 요일 휴무는 날짜를 아는 쪽(isClosedOn)이 먼저 거른다.
 */
export function fitInGap(gap: Pick<Gap, "start" | "end">, legIn: number, legOut: number, stay: number,
  hours?: Pick<PlaceHours, "opens" | "closes" | "breaks"> | null): GapFit | null {
  let arrival = gap.start + legIn;
  let leaveBy = gap.end - legOut;
  if (hours) {
    arrival = Math.max(arrival, hours.opens);
    for (const [from, to] of hours.breaks) if (arrival >= from && arrival < to) arrival = to;
    leaveBy = Math.min(leaveBy, hours.closes, ...hours.breaks.filter(([from]) => from > arrival).map(([from]) => from));
  }
  const staying = Math.min(stay, leaveBy - arrival);
  if (!Number.isFinite(staying) || staying < MIN_STAY_MINUTES) return null;
  return { arrival, departure: arrival + staying, stay: staying };
}

/** 그날이 요일 휴무인가. date는 YYYY-MM-DD, 요일은 planner와 같이 UTC 자정 기준으로 센다. */
export const isClosedOn = (hours: Pick<PlaceHours, "closedDays"> | null | undefined, date: string) =>
  !!hours && hours.closedDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());

/**
 * 추천 한 곳을 넣은 뒤 남는 시간. 한 시간 이상 남으면 그 장소에서 출발하는 다음 빈 구간을 만든다.
 * 방금 넣은 종류는 뺀다(밥 먹고 또 밥집을 권하지 않는다). 빼고 남는 게 없으면 시간대 기본값을 쓴다.
 */
export function nextGap(gap: Gap, placed: { point: TravelPoint; departure: number; kind: SuggestionKind },
  preferred: readonly SuggestionKind[] = []): Gap | null {
  if (gap.end - placed.departure < MIN_GAP_MINUTES || !placed.point.coord) return null;
  const kinds = kindsForWindow(placed.departure, gap.end, preferred);
  const varied = kinds.filter(kind => kind !== placed.kind);
  return { ...gap, id: `${gap.id}+`, start: placed.departure, from: placed.point, anchor: placed.point.coord,
    kinds: varied.length ? varied : kinds };
}
