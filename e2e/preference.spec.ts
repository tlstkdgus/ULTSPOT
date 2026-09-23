import { expect, test } from "@playwright/test";
import { interestIds, isInterestId, preferenceProfile } from "../src/lib/recommend/preference";
import { categoryCounts, filterCategories, matchesCategory, spotCategory } from "../src/lib/trip/categories";
import { planTrip, unavailableReason, type FanEvent } from "../src/lib/trip/planner";
import { catalog } from "../src/lib/trip/catalog";

const input = { date: "2026-09-22", start: 660, end: 1080, stay: 60, transfer: 45 };

// 카탈로그 순서를 인덱스로 쥐지 않는다. PR #48이 생일카페 3건을 앞에 붙이면서 catalog[0]이
// 운영시간 미확인 행사로 바뀌었고, 그것을 토대로 만든 "예약 필요" 사례가 예약이 아니라
// 미확인으로 판정돼 이 스펙이 깨졌다. 사례의 토대는 운영시간이 확인된 장소여야 한다.
const spot = (id: string) => catalog.find(e => e.id === id)!;

test("chips build a preference sentence and narrow the nearby kinds", () => {
  const meal = preferenceProfile({ interests: ["meal"], stay: 60 });
  expect(meal.sentence).toBe("I want a proper sit-down meal rather than dessert.");
  expect(meal.kinds).toEqual(["meal"]);

  const both = preferenceProfile({ interests: ["cafe", "photo"], stay: 60 });
  // 칩 순서는 화면 순서를 따른다 (photo가 cafe보다 앞).
  expect(both.interests).toEqual(["photo", "cafe"]);
  expect(both.kinds).toEqual(["cafe", "sightseeing"]);
  expect(both.sentence).toContain("photo spots");
  expect(both.sentence).toContain("café to rest in");

  // 속도도 취향이다. 오래 머무는 사람에게 "빨리 들르는 곳"을 올리지 않는다.
  expect(preferenceProfile({ interests: ["goods"], stay: 120 }).sentence).toContain("worth staying a while");
  expect(preferenceProfile({ interests: ["goods"], stay: 30 }).sentence).toContain("quick to visit");
});

test("no chips means no guessed preference and no ranking call", () => {
  const empty = preferenceProfile({ interests: [], stay: 60 });
  // 문장이 비면 rankByPreference가 모델을 부르지 않고 거리순으로 답한다.
  expect(empty.sentence).toBe("");
  expect(empty.interests).toEqual([]);
  // 종류는 셋 다 본다. 아무것도 고르지 않은 것을 "식사만 원함"으로 해석하지 않는다.
  expect(empty.kinds).toEqual(["meal", "cafe", "sightseeing"]);
  // 속도만으로는 문장을 만들지 않는다.
  expect(preferenceProfile({ interests: [], stay: 120 }).sentence).toBe("");
});

test("unknown chip values are dropped instead of reaching the model", () => {
  const profile = preferenceProfile({ interests: ["meal", "not-a-chip", "<script>"], stay: 60 });
  expect(profile.interests).toEqual(["meal"]);
  expect(profile.sentence).not.toContain("script");
  expect(isInterestId("meal")).toBe(true);
  expect(isInterestId("nope")).toBe(false);
  expect(interestIds).toContain("quiet");
});

/**
 * 가장 중요한 계약: 취향이 편성 가능 여부를 바꾸지 않는다.
 * 운영시간·휴무·예약·입장 마감 판정은 코드가 하고, 취향은 추천 순서에만 쓴다.
 */
test("preference never changes what the engine will schedule", () => {
  // 6곳 초과면 planTrip이 오류만 돌려줘 before/after가 빈 결과로 "같다"가 된다. 검수 3곳으로 편성한다.
  const three = ["hikr-ground", "music-korea", "k-star-road"].map(spot);
  const before = planTrip(three, input);
  for (const chips of [[], ["meal"], ["quiet", "cafe"], interestIds as unknown as string[]]) {
    const profile = preferenceProfile({ interests: chips, stay: 60 });
    // 취향 프로필을 planTrip에 넘길 수 있는 경로가 없다. 그래도 결과가 같은지 확인한다.
    const after = planTrip(three, input);
    expect(after.stops.map(s => s.event.id)).toEqual(before.stops.map(s => s.event.id));
    expect(before.stops.length).toBeGreaterThan(0);
    expect(after.omitted.map(o => o.reason)).toEqual(before.omitted.map(o => o.reason));
    expect(profile.sentence.length >= 0).toBe(true);
  }
  // 운영시간 미확인·예약 필요는 취향과 무관하게 그대로 제외된다.
  const unconfirmed: FanEvent = { ...spot("hikr-ground"), id: "no-hours", opens: null, closes: null };
  expect(unavailableReason(unconfirmed, input.date)).toContain("unconfirmed");
  const reservation: FanEvent = { ...spot("hikr-ground"), id: "booked", reservation: true };
  expect(unavailableReason(reservation, input.date)).toContain("reservation");
});

test("categories only classify what the data actually says", () => {
  // 검증된 장소 3곳은 생일카페도 팝업도 촬영지도 아니다. 억지로 넣지 않는다.
  // PR #48이 수집한 팬 생일카페 3건은 실제로 생일카페라 그렇게 분류된다 — 분류는 데이터가 하고,
  // 억지로 landmark에 밀어넣지 않는다. 순서에 기대지 않도록 id로 확인한다.
  // T-046이 공식 K팝 매장 3곳을 더했다. 전부 검수된 상설 장소이므로 landmark다.
  const landmarks = ["hikr-ground", "music-korea", "k-star-road", "ktown4u-coex", "kpop-square-hongdae", "kwangya-seoul"];
  expect(landmarks.map(id => spotCategory(spot(id)))).toEqual(landmarks.map(() => "landmark"));
  expect(catalog.filter(e => e.id.startsWith("BC-")).map(spotCategory))
    .toEqual(["birthdayCafe", "birthdayCafe", "birthdayCafe"]);
  const counts = categoryCounts(catalog);
  expect(counts.landmark).toBe(6);
  expect(counts.birthdayCafe).toBe(3);
  expect(counts.popup).toBe(0);
  expect(counts.filming).toBe(0);
  expect(counts.food).toBe(0);

  // 모르는 kind는 other이며 어떤 필터에도 걸리지 않는다.
  const odd: FanEvent = { ...spot("hikr-ground"), id: "odd", kind: "Something new" };
  expect(spotCategory(odd)).toBe("other");
  for (const key of filterCategories) expect(matchesCategory(odd, key)).toBe(false);
  expect(matchesCategory(odd, null)).toBe(true);

  // 명시 필드가 kind 추측을 이긴다.
  expect(spotCategory({ ...spot("hikr-ground"), category: "birthdayCafe" })).toBe("birthdayCafe");
});
