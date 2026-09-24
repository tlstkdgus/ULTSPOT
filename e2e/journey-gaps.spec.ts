import { expect, test } from "@playwright/test";
import { catalog } from "../src/lib/trip/catalog";
import { journeyDayForGaps } from "../src/lib/trip/journey-gaps";
import type { JourneyDay, ScheduledVisit } from "../src/lib/trip/journey";
import { findGaps } from "../src/lib/trip/gap-fill";
import { twoNightJourney } from "./flow";
import { englishLocale } from "./locale";

englishLocale();

/**
 * 여러 날 여정의 빈 시간 채우기와 지도 (T-063).
 */
const event = (id: string) => catalog.find(e => e.id === id)!;
const day: JourneyDay = { date: "2026-09-22", start: 600, end: 1200, bufferMinutes: 45, visits: [
  { id: "v1", placeId: "hikr-ground", stay: 60 }, { id: "v2", placeId: "music-korea", stay: 60 }, { id: "v3", placeId: "ktown4u-coex", stay: 60 },
] };
const item = (index: number, arrival: number | null, departure: number | null, issues: string[] = []): ScheduledVisit =>
  ({ visit: day.visits[index], arrival, departure, issues });

test("a fully timed day becomes gap input up to the end of the day", () => {
  const scheduled = [item(0, 600, 660), item(1, 680, 740), item(2, 800, 860)];
  const { result, input } = journeyDayForGaps(scheduled, id => event(id), () => 20, day, "transit");
  expect(result.stops.map(s => s.event.id)).toEqual(["hikr-ground", "music-korea", "ktown4u-coex"]);
  expect(result.stops.map(s => s.travel)).toEqual([0, 20, 20]);
  expect(input.end).toBe(1200);
  // 마지막 방문 뒤 16:20–20:00이 빈다.
  expect(findGaps(result, input).map(g => g.id)).toContain("ktown4u-coex>after");
});

test("once a visit has no time, nothing after it is used and no fake end-of-day gap is made", () => {
  // 세 번째 방문의 이동시간을 모른다 → 시각이 없다.
  const scheduled = [item(0, 600, 660), item(1, 680, 740), item(2, null, null, ["Travel time is unconfirmed."])];
  const { result, input } = journeyDayForGaps(scheduled, id => event(id), () => 20, day, "transit");
  expect(result.stops).toHaveLength(2);
  expect(input.end).toBe(740);
  expect(findGaps(result, input).some(g => g.position === "after")).toBe(false);
  // 운영시간을 모르는 곳(event 없음)에서도 멈춘다.
  expect(journeyDayForGaps([item(0, 600, 660)], () => null, () => 20, day, "transit").result.stops).toHaveLength(0);
});

test("a multi-day trip fills the free time of a day with a marked suggestion and shows a map area", async ({ page }) => {
  await twoNightJourney(page, ["HiKR Ground · K-pop floors", "Music Korea · Myeongdong 2"],
    [{ id: "t-journey", kind: "cafe", name: "여정 테스트 카페", lat: 37.5609, lng: 126.9866 }]);
  const card = page.getByRole("article", { name: "Suggested for your free time: 여정 테스트 카페" });
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Hours unconfirmed");
});
