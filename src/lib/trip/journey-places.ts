/**
 * Journey의 `placeId`를 화면에 쓸 장소 정보로 푼다.
 *
 * 세 출처를 하나의 모양으로 합치되 **어디서 왔는지를 잃지 않는다.**
 *  - `catalog`: 검수된 장소. 운영시간·좌표·출처가 있다.
 *  - `personal`: 사용자가 공지를 보고 직접 넣은 행사. 또는 주변 추천에서 담은 곳(운영시간 미확인).
 *  - `custom`: 사용자가 직접 적은 장소. 운영시간이 아예 없다.
 *
 * `custom`은 `FanEvent`가 아니므로 일정 계산에 넣을 수 없다. 시간을 모르는 장소를 확정 방문
 * 시각으로 만들지 않기 위해, 이 파일은 `custom`을 **FanEvent로 변환하지 않는다.**
 */

import type { Coord } from "./geo";
import type { CustomPlace, Journey } from "./journey";
import { spotCategory, type SpotCategory } from "./categories";
import type { FanEvent } from "./planner";
import { catalog } from "./catalog";

export type PlaceSource = "reviewed" | "personal" | "custom";

export type ResolvedPlace = {
  id: string;
  source: PlaceSource;
  /** 원문 기준 표시 이름. 화면은 eventCopy로 언어를 골라 쓴다. */
  title: string;
  address: string;
  kind: string;
  category: SpotCategory;
  coord?: Coord;
  /** 일정 계산에 넣을 수 있는 장소만 채워진다. custom은 언제나 null. */
  event: FanEvent | null;
  /** custom 장소의 사용자 메모. 그 밖에는 빈 문자열. */
  note: string;
};

const fromEvent = (event: FanEvent, source: PlaceSource): ResolvedPlace => ({
  id: event.id, source, title: event.title, address: event.address, kind: event.kind,
  category: spotCategory(event),
  coord: event.coord ? { lat: event.coord.lat, lng: event.coord.lng } : undefined,
  event, note: "",
});

const fromCustom = (place: CustomPlace): ResolvedPlace => ({
  id: place.id, source: "custom", title: place.title, address: place.address, kind: place.kind,
  // 사용자가 적은 장소는 분류를 모른다. 맛집으로 추측하지 않는다.
  category: "other",
  // 장소 검색(T-062)으로 고른 곳만 좌표가 있다. 없으면 이동시간은 미확인으로 남는다.
  coord: place.coord ? { lat: place.coord.lat, lng: place.coord.lng } : undefined,
  event: null, note: place.note,
});

/** 여정 안에서 쓸 수 있는 장소 전부. 같은 id가 두 출처에 있으면 검수본이 이긴다. */
export function journeyPlaces(journey: Pick<Journey, "personal" | "custom">): ResolvedPlace[] {
  const seen = new Set<string>();
  const out: ResolvedPlace[] = [];
  for (const place of [
    ...catalog.map(e => fromEvent(e, "reviewed")),
    ...journey.personal.map(e => fromEvent(e, "personal")),
    ...journey.custom.map(fromCustom),
  ]) {
    if (seen.has(place.id)) continue;
    seen.add(place.id);
    out.push(place);
  }
  return out;
}

export function resolvePlace(journey: Pick<Journey, "personal" | "custom">, placeId: string): ResolvedPlace | null {
  return journeyPlaces(journey).find(place => place.id === placeId) ?? null;
}

/** 일정 계산에 넘길 수 있는 FanEvent 목록. custom은 빠진다. */
export const schedulableEvents = (journey: Pick<Journey, "personal" | "custom">): FanEvent[] =>
  journeyPlaces(journey).flatMap(place => (place.event ? [place.event] : []));
