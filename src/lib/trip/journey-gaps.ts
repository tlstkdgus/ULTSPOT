/**
 * 여러 날 여정의 하루를 빈 시간 채우기 입력으로 바꾼다 (T-063).
 *
 * 당일 일정(planTrip)과 달리 여정은 사용자가 정한 순서대로 시각만 계산한다(scheduleJourneyDay). 빈 시간 채우기는
 * TripResult·TripInput을 받으므로 그 모양으로 옮긴다. 확정 일정은 바꾸지 않는다 — 추천은 화면에서만 끼운다.
 *
 * 하루의 **앞에서부터 시각이 확정된 방문까지만** 쓴다. 시각이 비는 방문(이동시간 미확인·운영시간 미확인·충돌)이
 * 나오면 그 뒤는 시각이 없으므로 빈 시간을 잴 수 없다. 운영시간을 모르는 직접 추가 장소(event 없음)도 멈춘다.
 */

import type { FanEvent, Stop, TripInput, TripResult } from "./planner";
import type { JourneyDay, ScheduledVisit } from "./journey";
import type { TravelMode } from "./travel";

export function journeyDayForGaps(
  scheduled: ScheduledVisit[],
  eventOf: (placeId: string) => FanEvent | null,
  legMinutes: (fromPlaceId: string, toPlaceId: string) => number | null,
  day: JourneyDay,
  travelMode: TravelMode,
): { result: TripResult; input: TripInput } {
  const stops: Stop[] = [];
  for (const [index, item] of scheduled.entries()) {
    const event = eventOf(item.visit.placeId);
    if (!event || item.arrival === null || item.departure === null || item.issues.length) break;
    const travel = index === 0 ? 0 : legMinutes(scheduled[index - 1].visit.placeId, item.visit.placeId);
    if (travel === null) break;
    stops.push({ event, arrival: item.arrival, departure: item.departure, travel, travelEstimate: null });
  }
  return {
    result: { stops, omitted: [], error: null, returnLeg: null, missingRequired: [] },
    // 여정에는 하루 체류 기본값이 없다(방문마다 다르다). 추천 한 곳은 한 시간을 기본으로 잡는다.
    // 시각이 확정된 방문이 중간에 끊겼으면 그 뒤에도 방문이 있다. "마지막 방문 뒤 빈 시간"을 만들지 않도록
    // 하루의 끝을 끊긴 자리로 당긴다. 모든 방문이 확정됐을 때만 하루 끝까지 비는 시간을 채운다.
    input: {
      date: day.date, start: day.start, stay: 60, transfer: day.bufferMinutes, travelMode,
      end: stops.length === scheduled.length || !stops.length ? day.end : stops[stops.length - 1].departure,
    },
  };
}
