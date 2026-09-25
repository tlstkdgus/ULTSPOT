import { expect, test } from "@playwright/test";
import { keptEventId, suggestionCoord, suggestionEvent, suggestionIdOf, type SuggestionLike } from "../src/lib/trip/suggestion-event";
import { isPersonalEvent } from "../src/lib/trip/storage";
import { addKeptVisit, addVisit, createJourney, parseJourney } from "../src/lib/trip/journey";

/** T-068: 추천 → 개인 장소 변환이 저장본 규칙을 통과하고, 여정에 넣는 것이 원자적이다. */
const copy = {
  kind: (kind: string) => kind, hoursSource: (m: string) => `TourAPI ${m}`, hoursUnknown: "unknown",
  keptHours: "visit time you picked", keptKnown: (h: string) => `Open ${h}, pinned`, provider: (p: string) => `Source: ${p}`,
};
const base: SuggestionLike = {
  id: "kakao-1001", kind: "meal", name: "테스트 식당", category: "한식", address: "서울 중구",
  coord: { lat: 37.561, lng: 126.986 }, hours: null, provider: "Kakao", placeUrl: "https://place.map.kakao.com/1001",
};
const today = "2026-09-25";

test("coordinates are kept only with a source we can name: a Kakao place page or a TourAPI content", () => {
  expect(suggestionCoord(base, today)?.source).toBe("https://place.map.kakao.com/1001");
  expect(suggestionCoord({ ...base, id: "tour-2001" }, today)?.source)
    .toBe("https://apis.data.go.kr/B551011/KorService2/detailCommon2?contentId=2001");
  expect(suggestionCoord({ ...base, id: "google-abc" }, today)).toBeUndefined();
  expect(suggestionCoord({ ...base, id: "kakao-12x" }, today)).toBeUndefined();
});

test("a kept suggestion with unknown hours uses the visit time, says so and survives the saved-draft check", () => {
  for (const id of ["kakao-1001", "tour-2001"]) {
    const event = suggestionEvent({ ...base, id }, { date: "2026-09-22", today, copy, visit: { opens: 820, closes: 880 } });
    expect(event).toMatchObject({ id: `personal-${id}`, opens: 820, closes: 880, closedDays: [], do: "visit time you picked" });
    expect(event.coord).toBeDefined();
    expect(isPersonalEvent(event)).toBe(true);
  }
  // 목록에서 담기만 하면(방문 시간 없음) 예전처럼 미확인이다.
  expect(suggestionEvent(base, { date: "2026-09-22", today, copy })).toMatchObject({ opens: null, closes: null, do: "unknown" });
});

test("known hours with weekly closed days are kept, and the saved draft still reads back", () => {
  const hours = { opens: 660, closes: 1260, closedDays: [1], breaks: [], modified: "2025-01-03" };
  const event = suggestionEvent({ ...base, id: "tour-2001", hours }, { date: "2026-09-22", today, copy, visit: { opens: 820, closes: 880 } });
  expect(event).toMatchObject({ opens: 660, closes: 1260, closedDays: [1], do: "TourAPI 2025-01-03" });
  // T-066까지는 closedDays가 비어 있어야만 받아, 이런 곳을 담으면 새로고침 때 저장본 전체가 거부됐다.
  expect(isPersonalEvent(event)).toBe(true);
  expect(isPersonalEvent({ ...event, closedDays: [7] })).toBe(false);
  expect(isPersonalEvent({ ...event, closedDays: [1, 1] })).toBe(false);
  expect(isPersonalEvent({ ...event, closedDays: [0, 1, 2, 3, 4, 5, 6] })).toBe(false);
  // 당일 일정은 편성기가 순서를 다시 정하므로 영업시간 안에서 카드의 방문 시간으로 고정한다. 휴무 요일은 유지한다.
  const pinned = suggestionEvent({ ...base, id: "tour-2001", hours }, { date: "2026-09-22", today, copy, visit: { opens: 820, closes: 880 }, pin: true });
  expect(pinned).toMatchObject({ opens: 820, closes: 880, closedDays: [1], do: "Open 11:00–21:00, pinned · TourAPI 2025-01-03" });
  expect(isPersonalEvent(pinned)).toBe(true);
  // 24시간 영업(1440)은 23:59로 자른다. 자르지 않으면 저장본 규칙(최대 1439)에 걸려 새로고침 때 저장본 전체가 거부된다.
  const allDay = suggestionEvent({ ...base, hours: { ...hours, opens: 0, closes: 1440, closedDays: [] } }, { date: "2026-09-22", today, copy });
  expect(allDay.closes).toBe(1439);
  expect(isPersonalEvent(allDay)).toBe(true);
  // 브레이크가 있으면 영업시간을 넘기지 않는다(편성기가 브레이크를 모른다) — 방문 시간으로 간다.
  const withBreak = suggestionEvent({ ...base, hours: { ...hours, breaks: [[900, 1020]] } }, { date: "2026-09-22", today, copy, visit: { opens: 820, closes: 880 } });
  expect(withBreak).toMatchObject({ opens: 820, closes: 880, closedDays: [] });
  // 출처를 댈 수 없는 좌표는 여전히 거부한다.
  expect(isPersonalEvent({ ...event, coord: { lat: 37.56, lng: 126.98, source: "https://example.com/1", checked_on: today } })).toBe(false);
});

test("the original suggestion id is recovered from the kept place, with or without a journey date", () => {
  expect(suggestionIdOf(keptEventId("kakao-1001"))).toBe("kakao-1001");
  expect(suggestionIdOf(keptEventId("tour-2001", "2026-09-23"))).toBe("tour-2001");
  expect(suggestionIdOf("hikr-ground")).toBeNull();
});

test("keeping into a journey adds the place and the visit together, at the given position, or nothing at all", () => {
  let journey = createJourney("2026-09-22", "2026-09-24");
  journey = addVisit(journey, { id: "v1", placeId: "hikr-ground", stay: 60 }, "2026-09-22");
  journey = addVisit(journey, { id: "v2", placeId: "music-korea", stay: 60 }, "2026-09-22");
  const id = keptEventId("kakao-1001", "2026-09-22");
  const event = suggestionEvent(base, { date: "2026-09-22", today, copy, id, visit: { opens: 760, closes: 820 } });

  const next = addKeptVisit(journey, event, { id: "v-kept", placeId: id, stay: 60 }, "2026-09-22", 1);
  expect(next.days[0].visits.map(v => v.placeId)).toEqual(["hikr-ground", id, "music-korea"]);
  expect(next.personal.map(p => p.id)).toEqual([id]);
  expect(parseJourney(JSON.parse(JSON.stringify(next)))).not.toBeNull();
  // 원본은 그대로다.
  expect(journey.days[0].visits).toHaveLength(2);
  expect(journey.personal).toHaveLength(0);

  // 같은 곳을 같은 날 다시 넣으면 개인 장소는 하나로 두고 방문만 더한다.
  const again = addKeptVisit(next, event, { id: "v-kept-2", placeId: id, stay: 30 }, "2026-09-22", 3);
  expect(again.personal).toHaveLength(1);
  expect(again.days[0].visits).toHaveLength(4);

  // 잘못된 자리, 중복 방문 ID, 12곳이 찬 개인 장소는 거부하고 아무것도 넣지 않는다.
  expect(() => addKeptVisit(journey, event, { id: "v-kept", placeId: id, stay: 60 }, "2026-09-22", 5)).toThrow("Invalid visit position.");
  expect(() => addKeptVisit(next, event, { id: "v1", placeId: id, stay: 60 }, "2026-09-22", 0)).toThrow("Invalid or duplicate visit.");
  const full = { ...journey, personal: Array.from({ length: 12 }, (_, i) =>
    suggestionEvent({ ...base, id: `kakao-${i}` }, { date: "2026-09-22", today, copy, id: keptEventId(`kakao-${i}`, "2026-09-22") })) };
  expect(() => addKeptVisit(full, event, { id: "v-kept", placeId: id, stay: 60 }, "2026-09-22", 0)).toThrow("Too many personal places.");
});
