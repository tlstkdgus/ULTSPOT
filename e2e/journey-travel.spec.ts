import { expect, test } from "@playwright/test";
import { addCustomPlace, addVisit, createJourney, moveVisit, resizeJourney, scheduleJourneyDay, updateVisit, type Journey } from "../src/lib/trip/journey";
import { daySummary, journeyLegs, legEstimate, travelLookup } from "../src/lib/trip/journey-travel";
import { journeyPlaces, resolvePlace, schedulableEvents } from "../src/lib/trip/journey-places";
import { legKey, type TravelEstimate, type TravelTable } from "../src/lib/trip/travel";
import { catalog } from "../src/lib/trip/catalog";

const known = (minutes: number): TravelEstimate => ({
  status: "known", mode: "transit", minutes, transfers: 0, fareKrw: 1_550,
  steps: [{ mode: "subway", minutes }], provider: "test",
  fetchedAt: "2026-09-20T05:00:00.000Z", manualUrl: "https://map.kakao.com/",
});
const unconfirmed: TravelEstimate = {
  status: "unconfirmed", reason: "Route lookup failed, so travel time is unconfirmed.",
  bufferMinutes: 45, manualUrl: "https://map.kakao.com/",
};

/** 검수 좌표가 있는 두 곳(HiKR, 뮤직코리아)을 Day 1에 넣은 여정. */
function twoDayJourney(): Journey {
  let journey = createJourney("2026-09-22", "2026-09-23");
  journey = addVisit(journey, { id: "v1", placeId: "hikr-ground", stay: 60 }, "2026-09-22");
  journey = addVisit(journey, { id: "v2", placeId: "music-korea", stay: 60 }, "2026-09-22");
  return journey;
}

test("only consecutive same-day pairs are looked up, and coordinate-less places are skipped", () => {
  const journey = twoDayJourney();
  const legs = journeyLegs(journey);
  // 하루 안에서 이어지는 쌍 하나뿐이다. 전체 순열을 조회하지 않는다.
  expect(legs).toHaveLength(1);
  expect(legs[0].from.id).toBe("hikr-ground");
  expect(legs[0].to.id).toBe("music-korea");

  // 좌표 없는 사용자 장소가 끼면 그 구간은 조회 목록에서 빠진다 (조회해도 의미가 없다).
  let withCustom = addCustomPlace(journey, { id: "custom-1", title: "친구 추천 식당", address: "서울 마포구", kind: "식당", note: "" });
  withCustom = addVisit(withCustom, { id: "v3", placeId: "custom-1", stay: 60 }, "2026-09-22");
  expect(journeyLegs(withCustom)).toHaveLength(1);

  // 날짜를 지정하면 그 날짜만 본다.
  expect(journeyLegs(journey, ["2026-09-23"])).toHaveLength(0);
});

test("a missing lookup stays null instead of borrowing the planning buffer", () => {
  const table: TravelTable = { [legKey("hikr-ground", "music-korea", "transit")]: known(18) };
  const lookup = travelLookup(table, "transit");
  expect(lookup("hikr-ground", "music-korea", "2026-09-22")).toBe(18);
  // 조회하지 않은 구간과 실패한 구간 모두 null이다. 45분을 몰래 넣지 않는다.
  expect(lookup("music-korea", "hikr-ground", "2026-09-22")).toBeNull();
  const failed: TravelTable = { [legKey("hikr-ground", "music-korea", "transit")]: unconfirmed };
  expect(travelLookup(failed, "transit")("hikr-ground", "music-korea", "2026-09-22")).toBeNull();
  // 수단이 다르면 다른 구간이다.
  expect(travelLookup(table, "walk")("hikr-ground", "music-korea", "2026-09-22")).toBeNull();
});

test("the schedule uses looked-up minutes and refuses to time anything after an unknown leg", () => {
  const journey = twoDayJourney();
  const table: TravelTable = { [legKey("hikr-ground", "music-korea", "transit")]: known(18) };
  const scheduled = scheduleJourneyDay(journey, "2026-09-22", travelLookup(table, "transit"));
  expect(scheduled[0].arrival).toBe(600);
  expect(scheduled[0].departure).toBe(660);
  // 10:00 + 60분 체류 + 18분 이동 = 11:18.
  expect(scheduled[1].arrival).toBe(678);
  expect(scheduled[1].issues).toEqual([]);

  // 조회값이 없으면 그 구간부터 시각을 확정하지 않는다.
  const blind = scheduleJourneyDay(journey, "2026-09-22", travelLookup({}, "transit"));
  expect(blind[0].arrival).toBe(600);
  expect(blind[1].arrival).toBeNull();
  expect(blind[1].departure).toBeNull();
  expect(blind[1].issues).toContain("Travel time is unconfirmed.");
});

test("the day summary separates no-coordinates from a failed lookup", () => {
  let journey = twoDayJourney();
  const table: TravelTable = { [legKey("hikr-ground", "music-korea", "transit")]: known(18) };
  expect(daySummary(journey, "2026-09-22", table, "transit")).toEqual({ legs: 1, known: 1, missingCoord: 0, unconfirmed: 0 });
  expect(daySummary(journey, "2026-09-22", {}, "transit")).toEqual({ legs: 1, known: 0, missingCoord: 0, unconfirmed: 1 });

  journey = addCustomPlace(journey, { id: "custom-1", title: "메모한 곳", address: "서울 마포구", kind: "식당", note: "" });
  journey = addVisit(journey, { id: "v3", placeId: "custom-1", stay: 60 }, "2026-09-22");
  expect(daySummary(journey, "2026-09-22", table, "transit")).toEqual({ legs: 2, known: 1, missingCoord: 1, unconfirmed: 0 });
});

test("legEstimate hands the raw status to the screen", () => {
  const table: TravelTable = {
    [legKey("a", "b", "transit")]: known(18),
    [legKey("b", "c", "transit")]: unconfirmed,
  };
  expect(legEstimate(table, "transit", "a", "b")?.status).toBe("known");
  expect(legEstimate(table, "transit", "b", "c")?.status).toBe("unconfirmed");
  // 없는 구간은 null이고 화면이 미확인으로 그린다.
  expect(legEstimate(table, "transit", "c", "d")).toBeNull();
});

test("custom places are listed but never become schedulable events", () => {
  let journey = createJourney("2026-09-22", "2026-09-22");
  journey = addCustomPlace(journey, { id: "custom-1", title: "친구가 알려준 밥집", address: "서울 마포구 와우산로", kind: "식당", note: "12시 전에 가야 함" });
  const places = journeyPlaces(journey);
  const custom = places.find(p => p.id === "custom-1")!;
  expect(custom.source).toBe("custom");
  // 시간을 모르는 장소를 확정 방문 시각으로 만들 경로가 없다.
  expect(custom.event).toBeNull();
  expect(custom.coord).toBeUndefined();
  // 분류를 추측하지 않는다.
  expect(custom.category).toBe("other");
  expect(custom.note).toBe("12시 전에 가야 함");
  expect(schedulableEvents(journey).some(e => e.id === "custom-1")).toBe(false);
  expect(schedulableEvents(journey)).toHaveLength(catalog.length);
  // 검수 장소는 출처가 남는다.
  expect(resolvePlace(journey, "hikr-ground")?.source).toBe("reviewed");
  expect(resolvePlace(journey, "nope")).toBeNull();
});

test("shrinking the trip moves visits to unassigned instead of deleting them", () => {
  const journey = twoDayJourney();
  const moved = moveVisit(journey, "v2", "2026-09-23", 0);
  expect(moved.days[1].visits.map(v => v.id)).toEqual(["v2"]);

  // 기간을 하루로 줄이면 사라진 날짜의 방문이 미배정으로 간다.
  const shrunk = resizeJourney(moved, "2026-09-22", "2026-09-22");
  expect(shrunk.days).toHaveLength(1);
  expect(shrunk.unassigned.map(v => v.id)).toEqual(["v2"]);
  expect(shrunk.days[0].visits.map(v => v.id)).toEqual(["v1"]);
});

test("a locked visit keeps its time and reports when it cannot be reached", () => {
  const journey = twoDayJourney();
  // 뮤직코리아를 10:30에 고정하면 HiKR 체류 60분 뒤 도착이 불가능하다.
  const locked = updateVisit(journey, "v2", 60, 630);
  const table: TravelTable = { [legKey("hikr-ground", "music-korea", "transit")]: known(18) };
  const scheduled = scheduleJourneyDay(locked, "2026-09-22", travelLookup(table, "transit"));
  expect(scheduled[1].arrival).toBe(630);
  expect(scheduled[1].issues).toContain("Cannot reach the locked time.");
  // 사용자가 고정한 시각을 조용히 바꾸지 않는다.
  expect(locked.days[0].visits[1].lockedAt).toBe(630);
});
