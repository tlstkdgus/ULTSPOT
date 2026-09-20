/**
 * 발자취 집계. 여행이 끝난 뒤 "무엇을 확인할 수 있는가"만 센다.
 *
 * **거리를 만들지 않는다.** 기획 문구는 "최애 따라 N km"였지만, 검수된 좌표는 일부 장소에만
 * 있고 직선거리에 보정계수를 곱한 값은 실제 이동 거리가 아니다. 카드에 km를 적으면 사용자는
 * 그것을 측정값으로 읽는다. 그래서 세는 것은 **다녀온 곳의 수**다.
 *
 * 시각도 쓰지 않는다. journey는 방문한 **날**만 기록하므로(F-10) 여기서 시각을 만들 방법이 없다.
 */

import { matchesArtists } from "./artists";
import type { SpotCategory } from "./categories";
import type { Journey } from "./journey";
import { journeyPlaces, type ResolvedPlace } from "./journey-places";
import { spendingTotal } from "./spending";

export type FootprintPlace = { place: ResolvedPlace; on: string };
export type Footprint = {
  /** 실제로 다녀왔다고 표시한 서로 다른 장소 수. 카드에 쓰는 대표 숫자다. */
  places: number;
  /** 방문 기록 수. 같은 장소를 다른 날 두 번 가면 2다. */
  visits: number;
  /** 다녀온 날 수. */
  days: number;
  /** 계획에 담은 방문 수. "N / M 곳"을 보여주기 위한 분모. */
  planned: number;
  /** 고른 최애와 연결된 장소 수. 최애를 고르지 않았으면 0. */
  artistPlaces: number;
  byCategory: { category: SpotCategory; places: number }[];
  /** 날짜순 방문 목록. 지도·목록 표시에 쓴다. */
  timeline: FootprintPlace[];
  spentKrw: number;
  /** 다녀온 곳 중 검수된 좌표가 있는 곳 수. 좌표가 없는 곳을 지도에 찍지 않기 위해 센다. */
  withCoord: number;
};

export function footprint(journey: Journey): Footprint {
  const places = journeyPlaces(journey);
  const byId = new Map(places.map(place => [place.id, place]));
  const visits = [...journey.days.flatMap(day => day.visits), ...journey.unassigned];
  const visitPlace = new Map(visits.map(visit => [visit.id, visit.placeId]));

  const timeline: FootprintPlace[] = [];
  for (const record of journey.visited ?? []) {
    const placeId = visitPlace.get(record.visitId);
    const place = placeId ? byId.get(placeId) : undefined;
    // 장소를 풀 수 없는 기록은 세지 않는다. 이름 없는 방문을 숫자에 넣으면 카드가 설명할 수 없다.
    if (place) timeline.push({ place, on: record.on });
  }
  timeline.sort((a, b) => a.on.localeCompare(b.on) || a.place.title.localeCompare(b.place.title));

  const distinct = new Map(timeline.map(item => [item.place.id, item.place]));
  const counts = new Map<SpotCategory, number>();
  for (const place of distinct.values()) counts.set(place.category, (counts.get(place.category) ?? 0) + 1);

  const chosen = journey.artistIds ?? [];
  const artistPlaces = chosen.length === 0 ? 0 : [...distinct.values()]
    .filter(place => place.event && matchesArtists(place.event.artistIds, chosen)).length;

  return {
    places: distinct.size,
    visits: timeline.length,
    days: new Set(timeline.map(item => item.on)).size,
    planned: visits.length,
    artistPlaces,
    byCategory: [...counts.entries()]
      .map(([category, places]) => ({ category, places }))
      .sort((a, b) => b.places - a.places || a.category.localeCompare(b.category)),
    timeline,
    spentKrw: spendingTotal(journey).totalKrw,
    withCoord: [...distinct.values()].filter(place => place.coord).length,
  };
}
