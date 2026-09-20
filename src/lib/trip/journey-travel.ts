/**
 * Journey ↔ 이동시간 조회 브리지.
 *
 * `scheduleJourneyDay`는 `travel(from, to, date) => number | null`을 받는다. `null`은
 * "모른다"이고 그 구간부터 시각을 확정하지 않는다. 이 파일은 조회 결과를 그 계약으로 바꾼다.
 *
 * 지켜야 할 것:
 *  - 조회하지 못한 구간을 계획용 여유 시간으로 **몰래 메우지 않는다.** `null`을 돌려주고,
 *    화면이 "이동시간 미확인 + 계획용 여유 N분"으로 따로 말한다.
 *  - 좌표가 없는 장소(custom, 미검수)는 조회 자체가 불가능하다. 그 사실을 상태로 남긴다.
 *  - 날짜가 달라도 같은 좌표 쌍은 같은 조회 결과를 쓴다. 미래 출발 시각을 지정하지 않는 조회라
 *    날짜별로 다른 값을 만들 근거가 없다(그래서 조회 시각을 함께 표시한다).
 */

import type { TravelPoint } from "./geo";
import type { Journey } from "./journey";
import { journeyPlaces, type ResolvedPlace } from "./journey-places";
import { legKey, type TravelEstimate, type TravelMode, type TravelTable } from "./travel";
import type { TravelLeg } from "./travel-client";

const pointOf = (place: ResolvedPlace): TravelPoint => ({
  id: place.id, name: place.title, address: place.address, coord: place.coord,
});

/**
 * 선택한 날짜들의 방문 순서에서 **실제로 필요한 구간만** 뽑는다.
 *
 * 하루 안에서 이어지는 쌍만 조회한다. 전체 순열을 조회하던 단일 일정(`planningLegs`)과 다르다.
 * 여정은 사용자가 순서를 정하므로 조합을 탐색할 필요가 없고, 조회 수가 일 1,000건 무료 쿼터
 * 안에 머문다. 좌표가 없는 쪽이 끼면 조회해도 의미가 없어 목록에서 뺀다(미확인으로 남는다).
 */
export function journeyLegs(journey: Journey, dates?: string[]): TravelLeg[] {
  const places = journeyPlaces(journey);
  const byId = new Map(places.map(place => [place.id, place]));
  const wanted = dates ? journey.days.filter(day => dates.includes(day.date)) : journey.days;
  const legs: TravelLeg[] = [];
  const seen = new Set<string>();
  for (const day of wanted) {
    for (let i = 1; i < day.visits.length; i++) {
      const from = byId.get(day.visits[i - 1].placeId);
      const to = byId.get(day.visits[i].placeId);
      if (!from?.coord || !to?.coord) continue;
      const key = `${from.id}>${to.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      legs.push({ from: pointOf(from), to: pointOf(to) });
    }
  }
  return legs;
}

/**
 * 조회 결과 표 → `scheduleJourneyDay`가 받는 함수.
 * `known`만 분을 돌려주고 그 밖에는 `null`이다.
 */
export function travelLookup(table: TravelTable, mode: TravelMode) {
  /**
   * `date`는 `scheduleJourneyDay`의 계약에 있어서 받지만 쓰지 않는다.
   * 현재 조회는 출발 시각을 지정하지 않으므로 날짜별로 다른 값을 만들 근거가 없다.
   * 대신 조회 시각을 화면에 함께 표시해 언제 본 값인지 알리고 있다.
   * 미래 출발 시각 조회를 붙이면 그때 이 인자를 캐시 키에 넣는다.
   */
  return (from: string, to: string, _date?: string) => {
    void _date;
    const estimate = table[legKey(from, to, mode)];
    return estimate?.status === "known" ? estimate.minutes : null;
  };
}

/** 구간의 조회 상태를 화면에 그대로 넘긴다. 없으면 null이고 화면이 미확인으로 그린다. */
export const legEstimate = (table: TravelTable, mode: TravelMode, from: string, to: string): TravelEstimate | null =>
  table[legKey(from, to, mode)] ?? null;

/**
 * 하루의 조회 요약. "이 일정은 아직 추정"인지 한 줄로 말하기 위해 센다.
 * 좌표가 없어 조회조차 못 한 구간과, 조회했지만 실패한 구간을 구분한다.
 */
export function daySummary(journey: Journey, date: string, table: TravelTable, mode: TravelMode) {
  const places = journeyPlaces(journey);
  const byId = new Map(places.map(place => [place.id, place]));
  const day = journey.days.find(d => d.date === date);
  let known = 0;
  let missingCoord = 0;
  let unconfirmed = 0;
  for (let i = 1; i < (day?.visits.length ?? 0); i++) {
    const from = byId.get(day!.visits[i - 1].placeId);
    const to = byId.get(day!.visits[i].placeId);
    if (!from?.coord || !to?.coord) { missingCoord += 1; continue; }
    const estimate = table[legKey(from.id, to.id, mode)];
    if (estimate?.status === "known") known += 1;
    else unconfirmed += 1;
  }
  return { legs: known + missingCoord + unconfirmed, known, missingCoord, unconfirmed };
}
