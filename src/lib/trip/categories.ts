/**
 * 장소 종류 분류. 탐색 화면의 필터와 추천 후보 분류에 쓴다.
 *
 * 왜 별도 필드인가: `kind`는 검수된 원문 문구(영어)라 화면 필터의 기준으로 쓰면 원문이 바뀔 때
 * 필터가 조용히 깨진다. 분류는 명시적 필드로 두고, 없으면 알려진 `kind` 값만 매핑한다.
 * 모르는 값은 `other`이며 **임의로 맛집·생일카페로 넣지 않는다.**
 */

import type { FanEvent } from "./planner";

export const spotCategories = ["birthdayCafe", "popup", "filming", "landmark", "food", "other"] as const;
export type SpotCategory = (typeof spotCategories)[number];

/** 화면 필터에 노출하는 순서. `other`는 필터로 내놓지 않고 전체에만 포함한다. */
export const filterCategories = ["birthdayCafe", "popup", "filming", "landmark", "food"] as const;
export type FilterCategory = (typeof filterCategories)[number];

/**
 * 검수된 `kind` 원문 → 분류. 이 표에 없는 값은 `other`다.
 * 표를 늘릴 때는 그 `kind`가 실제로 그 분류인지 검수 자료로 확인하고 늘린다.
 */
const byKind: Record<string, SpotCategory> = {
  "Birthday cafe": "birthdayCafe",
  "Birthday café": "birthdayCafe",
  "Pop-up store": "popup",
  "Pop-up": "popup",
  "Filming location": "filming",
  "K-pop experience": "landmark",
  "Public fan landmark": "landmark",
  "Album shop": "landmark",
  "Restaurant": "food",
  "Cafe": "food",
  "Café": "food",
};

export function spotCategory(event: FanEvent): SpotCategory {
  if (event.category && spotCategories.includes(event.category)) return event.category;
  return byKind[event.kind] ?? "other";
}

/** 필터 하나에 걸리는 장소만 남긴다. `null`은 전체. */
export const matchesCategory = (event: FanEvent, category: FilterCategory | null) =>
  category === null || spotCategory(event) === category;

/** 필터별 개수. 0인 필터를 숨기지 않고 0으로 보여주기 위해 미리 센다. */
export function categoryCounts(events: FanEvent[]): Record<FilterCategory, number> {
  const counts = Object.fromEntries(filterCategories.map(c => [c, 0])) as Record<FilterCategory, number>;
  for (const event of events) {
    const category = spotCategory(event);
    if (category !== "other") counts[category] += 1;
  }
  return counts;
}
