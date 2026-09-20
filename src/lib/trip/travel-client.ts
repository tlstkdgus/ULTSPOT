/**
 * 브라우저에서 /api/travel을 부르는 쪽. 키를 다루지 않는다.
 *
 * 실패해도 던지지 않는다. 조회하지 못한 구간은 unconfirmed로 채워서, 화면이 언제나
 * "이동시간 미확인 + 직접 확인 경로"를 보여줄 수 있게 한다.
 */

import type { TravelPoint } from "./geo";
import { eventPoint, DESTINATION_ID, ORIGIN_ID, type FanEvent, type TripInput } from "./planner";
import { legKey, travelReasons, unconfirmed, type TravelEstimate, type TravelMode, type TravelTable } from "./travel";

export type TravelLeg = { from: TravelPoint; to: TravelPoint };

/**
 * 일정 계산에 필요한 구간 목록.
 * 어떤 순서가 최적인지 아직 모르므로 선택한 장소들의 **순서 있는 모든 쌍**이 필요하다.
 * 6곳이면 30개, 출발·종료를 더하면 최대 42개다. 그래서 캐시와 상한이 중요하다.
 */
export function planningLegs(events: FanEvent[], input: Pick<TripInput, "origin" | "destination">): TravelLeg[] {
  const points = events.map(eventPoint);
  const legs: TravelLeg[] = [];
  for (const from of points) for (const to of points) if (from.id !== to.id) legs.push({ from, to });
  if (input.origin) {
    const origin: TravelPoint = { id: ORIGIN_ID, name: input.origin.label, address: input.origin.address, coord: input.origin.coord };
    for (const to of points) legs.push({ from: origin, to });
  }
  if (input.destination) {
    const destination: TravelPoint = { id: DESTINATION_ID, name: input.destination.label, address: input.destination.address, coord: input.destination.coord };
    for (const from of points) legs.push({ from, to: destination });
  }
  return legs;
}

const allUnconfirmed = (legs: TravelLeg[], mode: TravelMode, bufferMinutes: number, reason: Parameters<typeof unconfirmed>[4]) =>
  Object.fromEntries(legs.map(leg => [legKey(leg.from.id, leg.to.id, mode), unconfirmed(leg.from, leg.to, mode, bufferMinutes, reason)]));

export type TravelLookupResult = { configured: boolean; table: TravelTable; budgetExhausted?: boolean };

export async function fetchTravelTable(
  legs: TravelLeg[], mode: TravelMode, bufferMinutes: number, signal?: AbortSignal,
): Promise<TravelLookupResult> {
  if (!legs.length) return { configured: false, table: {} };
  try {
    const response = await fetch("/api/travel", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ mode, bufferMinutes, legs }),
    });
    if (!response.ok) throw new Error(`travel lookup responded ${response.status}`);
    const body = await response.json() as { configured?: boolean; estimates?: Record<string, TravelEstimate>; budgetExhausted?: boolean };
    // 서버가 빠뜨린 구간은 미확인으로 메운다. 조용히 빈칸으로 두지 않는다.
    const table: Record<string, TravelEstimate> = {
      ...allUnconfirmed(legs, mode, bufferMinutes, travelReasons.notRequested),
      ...(body.estimates ?? {}),
    };
    return { configured: Boolean(body.configured), table, budgetExhausted: body.budgetExhausted };
  } catch {
    return { configured: false, table: allUnconfirmed(legs, mode, bufferMinutes, travelReasons.lookupFailed) };
  }
}
