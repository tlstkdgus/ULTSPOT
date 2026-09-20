import { expect, test } from "@playwright/test";
import { addSpend, addVisit, createJourney, markVisited, type Journey } from "../src/lib/trip/journey";
import { footprint } from "../src/lib/trip/footprint";
import { formatKrw, spendingByDay, spendingByPlace, spendingTotal } from "../src/lib/trip/spending";

/** 검수 장소 3곳을 2박 3일에 나눠 담은 여정. 아직 아무것도 다녀오지 않은 상태다. */
function planned(): Journey {
  let journey = createJourney("2026-09-22", "2026-09-24");
  journey = addVisit(journey, { id: "v1", placeId: "hikr-ground", stay: 90 }, "2026-09-22");
  journey = addVisit(journey, { id: "v2", placeId: "music-korea", stay: 45 }, "2026-09-22");
  journey = addVisit(journey, { id: "v3", placeId: "k-star-road", stay: 60 }, "2026-09-23");
  return journey;
}

test("spending is counted per day, and a day without spending is absent rather than zero", () => {
  let journey = planned();
  journey = addSpend(journey, { id: "s1", on: "2026-09-22", amountKrw: 8_500, placeId: "music-korea", label: "Cup sleeve set" });
  journey = addSpend(journey, { id: "s2", on: "2026-09-22", amountKrw: 1_350 });
  journey = addSpend(journey, { id: "s3", on: "2026-09-24", amountKrw: 12_000, placeId: "hikr-ground" });

  expect(spendingByDay(journey)).toEqual([
    { date: "2026-09-22", totalKrw: 9_850, entries: 2 },
    { date: "2026-09-24", totalKrw: 12_000, entries: 1 },
  ]);
  // 9/23은 목록에 없다. 0원을 쓴 날과 기록하지 않은 날을 같은 모양으로 보여주지 않는다.
  expect(spendingByDay(journey).some(day => day.date === "2026-09-23")).toBe(false);
  expect(spendingTotal(journey)).toEqual({ totalKrw: 21_850, entries: 3, days: 2, places: 2 });
});

test("spending by place puts the biggest first and never guesses where unlabelled money went", () => {
  let journey = planned();
  journey = addSpend(journey, { id: "s1", on: "2026-09-22", amountKrw: 8_500, placeId: "music-korea" });
  journey = addSpend(journey, { id: "s2", on: "2026-09-22", amountKrw: 30_000, placeId: "hikr-ground" });
  journey = addSpend(journey, { id: "s3", on: "2026-09-23", amountKrw: 4_000 });
  journey = addSpend(journey, { id: "s4", on: "2026-09-23", amountKrw: 2_000 });

  expect(spendingByPlace(journey)).toEqual([
    { placeId: "hikr-ground", totalKrw: 30_000, entries: 1 },
    { placeId: "music-korea", totalKrw: 8_500, entries: 1 },
    // 장소를 적지 않은 지출은 한 묶음으로 마지막에. 아무 장소에 붙이지 않는다.
    { placeId: null, totalKrw: 6_000, entries: 2 },
  ]);
});

test("won is shown without decimals in every supported language", () => {
  for (const locale of ["en", "ko", "ja", "zh"]) {
    const shown = formatKrw(21_850, locale);
    expect(shown).toContain("21,850");
    expect(shown).not.toContain(".00");
  }
});

test("the footprint counts places you actually marked, not places you planned", () => {
  let journey = planned();
  // 계획은 3곳이지만 다녀온 것은 2곳이다.
  expect(footprint(journey)).toMatchObject({ places: 0, visits: 0, days: 0, planned: 3 });
  journey = markVisited(journey, "v1", "2026-09-22");
  journey = markVisited(journey, "v3", "2026-09-23");

  const done = footprint(journey);
  expect(done).toMatchObject({ places: 2, visits: 2, days: 2, planned: 3 });
  expect(done.timeline.map(item => [item.on, item.place.id])).toEqual([
    ["2026-09-22", "hikr-ground"],
    ["2026-09-23", "k-star-road"],
  ]);
  // 검수 좌표가 있는 곳만 센다. 좌표 없는 곳을 지도에 찍지 않기 위한 값이다.
  expect(done.withCoord).toBe(2);
});

test("the footprint never produces a distance, only values that can be checked", () => {
  let journey = planned();
  journey = markVisited(journey, "v1", "2026-09-22");
  const result = footprint(journey);
  // 거리 필드가 아예 없다. 직선거리에 보정계수를 곱한 값을 km로 내보내는 경로를 만들지 않는다.
  expect(Object.keys(result)).not.toContain("distanceKm");
  expect(Object.keys(result)).not.toContain("distanceM");
  expect(JSON.stringify(result)).not.toContain("km");
});

test("a place visited on two days counts once as a place and twice as a visit", () => {
  let journey = createJourney("2026-09-22", "2026-09-23");
  journey = addVisit(journey, { id: "a", placeId: "hikr-ground", stay: 60 }, "2026-09-22");
  journey = addVisit(journey, { id: "b", placeId: "hikr-ground", stay: 60 }, "2026-09-23");
  journey = markVisited(journey, "a", "2026-09-22");
  journey = markVisited(journey, "b", "2026-09-23");

  expect(footprint(journey)).toMatchObject({ places: 1, visits: 2, days: 2 });
  expect(footprint(journey).byCategory).toEqual([{ category: "landmark", places: 1 }]);
});

test("the footprint links places to the chosen favourites without inventing a link", () => {
  let journey = planned();
  journey = markVisited(journey, "v1", "2026-09-22");
  journey = markVisited(journey, "v2", "2026-09-22");
  // 최애를 고르지 않았으면 0이다. 고르지 않은 사람에게 "최애 따라 N곳"을 보여주지 않는다.
  expect(footprint(journey).artistPlaces).toBe(0);

  const withFavourite = { ...journey, artistIds: ["A-JYP-SKZ"] };
  const linked = footprint(withFavourite).artistPlaces;
  // 검수 데이터가 실제로 연결한 곳만 센다. 값이 몇이든 다녀온 곳 수를 넘지 않는다.
  expect(linked).toBeLessThanOrEqual(footprint(withFavourite).places);
  expect(linked).toBeGreaterThanOrEqual(0);
});

test("spending totals reach the footprint, and a record with no resolvable place is not counted", () => {
  let journey = planned();
  journey = markVisited(journey, "v1", "2026-09-22");
  journey = addSpend(journey, { id: "s1", on: "2026-09-22", amountKrw: 8_500 });
  expect(footprint(journey).spentKrw).toBe(8_500);

  // 방문 기록이 남았지만 그 방문이 여정에서 사라진 상태. 이름을 모르는 방문은 숫자에 넣지 않는다.
  const orphaned: Journey = { ...journey, visited: [{ visitId: "gone", on: "2026-09-22" }] };
  expect(footprint(orphaned)).toMatchObject({ places: 0, visits: 0, days: 0 });
});
