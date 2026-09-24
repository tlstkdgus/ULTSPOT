import { expect, test, type Page } from "@playwright/test";
import { catalog } from "../src/lib/trip/catalog";
import { findGaps, fitInGap, kindsForWindow, MIN_GAP_MINUTES, nextGap } from "../src/lib/trip/gap-fill";
import { planTrip, type FanEvent, type TripInput } from "../src/lib/trip/planner";
import { browseAllSpots, fixSuggestions, fixTravelLookups, goToStep, type FixtureSuggestion } from "./flow";
import { englishLocale } from "./locale";

englishLocale();

const spot = (id: string) => catalog.find(e => e.id === id)!;
const day: TripInput = { date: "2026-09-22", start: 660, end: 1080, stay: 60, transfer: 45 };

test("gaps are found only where the confirmed plan leaves an hour or more", () => {
  // HiKR 11:00–12:00 → Music Korea 12:45–13:45 (여유 45분), 18:00까지 4시간 15분이 빈다.
  const result = planTrip([spot("hikr-ground"), spot("music-korea")], day);
  expect(result.stops.map(s => s.event.id)).toEqual(["hikr-ground", "music-korea"]);
  const gaps = findGaps(result, day);
  expect(gaps).toHaveLength(1);
  expect(gaps[0]).toMatchObject({ position: "after", start: 825, end: 1080, to: null, kinds: ["meal", "cafe"] });
  expect(gaps[0].from?.id).toBe("music-korea");
  expect(gaps[0].anchor).toMatchObject({ lat: 37.56072, lng: 126.98659 });

  // 문을 늦게 여는 곳이 뒤에 있으면 그 사이가 빈다. 이동 여유를 뺀 대기가 한 시간 이상일 때만.
  const late: FanEvent = { ...spot("music-korea"), id: "late-opener", opens: 900 };
  const between = findGaps(planTrip([spot("hikr-ground"), late], day), day);
  const middle = between.find(g => g.position === "between")!;
  expect(middle).toMatchObject({ start: 720, end: 900 });
  expect(middle.from?.id).toBe("hikr-ground");
  expect(middle.to?.id).toBe("late-opener");

  // 끝나는 시각을 당기면 남는 시간이 한 시간 밑이라 채우지 않는다.
  const tight = { ...day, end: 825 + MIN_GAP_MINUTES - 1 };
  expect(findGaps(planTrip([spot("hikr-ground"), spot("music-korea")], tight), tight)).toEqual([]);
  expect(findGaps(null, day)).toEqual([]);
});

test("time of day decides meal or break, and interests only narrow it", () => {
  expect(kindsForWindow(720, 800)).toEqual(["meal", "cafe"]);
  expect(kindsForWindow(900, 1000)).toEqual(["cafe", "sightseeing"]);
  expect(kindsForWindow(1080, 1150)).toEqual(["meal", "cafe"]);
  // 오후 세 시에 "식사"만 골랐어도 밥집을 억지로 넣지 않는다.
  expect(kindsForWindow(900, 1000, ["meal"])).toEqual(["cafe", "sightseeing"]);
  expect(kindsForWindow(720, 800, ["cafe"])).toEqual(["cafe"]);
  // 긴 오후는 앞부분으로 판단한다. 14:40–18:00이 저녁 17:30에 걸친다고 밥집부터 찾지 않는다.
  expect(kindsForWindow(880, 1080)).toEqual(["cafe", "sightseeing"]);
});

test("after a placed suggestion the rest of the gap continues from there, with a different kind", () => {
  const [gap] = findGaps(planTrip([spot("hikr-ground"), spot("music-korea")], day), day);
  const cafe = { id: "gap-x", name: "카페", coord: { lat: 37.561, lng: 126.986 } };
  const next = nextGap(gap, { point: cafe, departure: 900, kind: "cafe" })!;
  expect(next).toMatchObject({ start: 900, end: 1080, anchor: cafe.coord, kinds: ["sightseeing"] });
  expect(next.from?.id).toBe("gap-x");
  expect(next.id).not.toBe(gap.id);
  // 한 시간이 안 남으면 더 잇지 않는다.
  expect(nextGap(gap, { point: cafe, departure: 1080 - MIN_GAP_MINUTES + 1, kind: "cafe" })).toBeNull();
});

test("a suggestion fits only if both legs and a real stay fit in the gap", () => {
  expect(fitInGap({ start: 780, end: 1080 }, 20, 0, 60)).toEqual({ arrival: 800, departure: 860, stay: 60 });
  // 자리가 모자라면 체류를 줄인다. 30분 밑이면 넣지 않는다.
  expect(fitInGap({ start: 780, end: 860 }, 20, 15, 60)).toEqual({ arrival: 800, departure: 845, stay: 45 });
  expect(fitInGap({ start: 780, end: 840 }, 20, 15, 60)).toBeNull();
});

const nearby: FixtureSuggestion[] = [
  { id: "t-meal-1", kind: "meal", name: "명동 테스트 식당", category: "한식", lat: 37.5610, lng: 126.9860 },
  { id: "t-meal-2", kind: "meal", name: "명동 두번째 식당", category: "분식", lat: 37.5612, lng: 126.9862 },
  { id: "t-cafe-1", kind: "cafe", name: "명동 테스트 카페", category: "카페", lat: 37.5608, lng: 126.9858 },
];

/** HiKR 11:00–12:00 → Music Korea 12:20–13:20 (이동 20분 고정), 18:00까지 빈다. */
async function planWithFreeAfternoon(page: Page, end = "18:00") {
  await fixTravelLookups(page);
  await page.goto("/plan");
  await browseAllSpots(page);
  for (const id of ["hikr-ground", "music-korea"])
    await page.getByRole("button", { name: `Add ${spot(id).title}`, exact: true }).click();
  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await page.getByLabel("End time").fill(end);
  await page.getByRole("button", { name: "Build my itinerary" }).click();
  await expect(page.getByText("12:20–13:20", { exact: true })).toBeVisible();
}

test("free afternoon gets a nearby suggestion, marked as unconfirmed and kept out of exports", async ({ page }) => {
  const asked: { kinds: string[]; excluded: string[] }[] = [];
  const legs: { mode: string; legs: { to: { id: string } }[] }[] = [];
  page.on("request", request => {
    if (request.url().endsWith("/api/recommend")) asked.push(request.postDataJSON());
    if (request.url().endsWith("/api/travel")) legs.push(request.postDataJSON());
  });
  await fixSuggestions(page, nearby, true);
  await planWithFreeAfternoon(page);

  const card = page.getByRole("article", { name: "Suggested for your free time: 명동 테스트 식당" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Hours unconfirmed");
  // Music Korea를 13:20에 떠나 20분 이동, 한 시간 머문다.
  await expect(card).toContainText("13:40–14:40");
  await expect(card).toContainText("ordered by your interests");
  await expect(card.getByRole("link", { name: "See on Kakao Map" })).toHaveAttribute("href", "https://place.map.kakao.com/t-meal-1");
  // 13:20 이후는 점심 시간대와 겹친다 → 식사·휴식.
  expect(asked[0].kinds).toEqual(["meal", "cafe"]);
  // 후보는 뮤직코리아에서 100m 안이다. 대중교통 경로가 없는 거리라 걸어서 잰다.
  const gapLegs = legs.filter(body => body.legs.some(leg => leg.to.id.startsWith("gap-")));
  expect(gapLegs.length).toBeGreaterThan(0);
  expect(gapLegs.every(body => body.mode === "walk")).toBe(true);

  // 식사 뒤에도 세 시간 넘게 남는다. 식당에서 출발해 밥집이 아닌 곳(카페)을 잇는다.
  const cafe = page.getByRole("article", { name: "Suggested for your free time: 명동 테스트 카페" });
  await expect(cafe).toContainText("15:00–16:00");
  // 관광 후보는 없으니 남은 두 시간은 비어 있다고 말한다.
  await expect(page.getByText("2h free · nothing nearby fits this gap", { exact: true })).toBeVisible();
  // 하루가 끝나는 시각도 추천을 반영한다.
  await expect(page.getByRole("heading", { name: "Done by 16:00" })).toBeVisible();

  // 확정 일정이 아니므로 파일에는 들어가지 않는다.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download itinerary (.txt)" }).click();
  const text = await (await (await download).createReadStream()).toArray();
  expect(Buffer.concat(text).toString("utf8")).not.toContain("명동 테스트 식당");
});

test("another place swaps the suggestion, leave empty clears it and it can come back", async ({ page }) => {
  await fixSuggestions(page, nearby);
  await planWithFreeAfternoon(page);
  const first = page.getByRole("article", { name: "Suggested for your free time: 명동 테스트 식당" });
  await expect(first).toContainText("closest first");

  await first.getByRole("button", { name: "Another place" }).click();
  const second = page.getByRole("article", { name: "Suggested for your free time: 명동 두번째 식당" });
  await expect(second).toBeVisible();
  await expect(first).toHaveCount(0);

  await second.getByRole("button", { name: "Leave empty" }).click();
  await expect(page.getByText("4h 40m free", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Done by 13:20" })).toBeVisible();

  // 다시 받으면 넘긴 곳(첫 식당)은 다시 권하지 않는다.
  await page.getByRole("button", { name: "Suggest a place" }).click();
  await expect(second).toBeVisible();
});

test("nothing is looked up when the day has no hour to spare", async ({ page }) => {
  let asked = 0;
  page.on("request", request => { if (request.url().endsWith("/api/recommend")) asked += 1; });
  await fixSuggestions(page, nearby);
  await planWithFreeAfternoon(page, "14:00");
  await expect(page.getByRole("heading", { name: "Done by 13:20" })).toBeVisible();
  await expect(page.getByRole("article", { name: /Suggested for your free time/ })).toHaveCount(0);
  expect(asked).toBe(0);
});

test("when nothing nearby fits, the gap says so instead of staying silent", async ({ page }) => {
  await fixSuggestions(page, []);
  await planWithFreeAfternoon(page);
  await expect(page.getByText("4h 40m free · nothing nearby fits this gap", { exact: true })).toBeVisible();
});

test("places with known hours go first, closed ones are skipped and arrival waits for opening", async ({ page }) => {
  await fixSuggestions(page, [
    // 가장 가깝지만 영업시간 미확인.
    { id: "t-unknown", kind: "meal", name: "미확인 식당", lat: 37.5607, lng: 126.9866 },
    // 영업시간은 알지만 화요일(2026-09-22) 휴무.
    { id: "t-closed", kind: "meal", name: "화요일 휴무 식당", lat: 37.5608, lng: 126.9866, hours: { opens: 600, closes: 1260, closedDays: [2] } },
    // 14:00에 연다. 13:40에 닿아도 14:00까지 기다린다.
    { id: "t-late", kind: "meal", name: "두시 여는 식당", lat: 37.5609, lng: 126.9866, hours: { opens: 840, closes: 1260, note: "설·추석 당일" } },
  ]);
  await planWithFreeAfternoon(page);
  const card = page.getByRole("article", { name: "Suggested for your free time: 두시 여는 식당" });
  await expect(card).toContainText("14:00–15:00");
  await expect(card).toContainText("Open 14:00–21:00");
  await expect(card).toContainText("Hours from Korea Tourism Organization (updated 2025-01-03)");
  await expect(card).toContainText("Closed: 설·추석 당일");
  await expect(card).not.toContainText("Hours unconfirmed");
  await expect(page.getByRole("article", { name: /화요일 휴무 식당/ })).toHaveCount(0);
});

test("a suggestion with a licensed photo shows it whole, with the source under it", async ({ page }) => {
  // 외부 사진 서버에 기대지 않도록 앱에 있는 이미지로 대신한다. 검사 대상은 사진 칸과 출처 표기다.
  await fixSuggestions(page, [
    { id: "t-photo", kind: "meal", name: "사진 있는 식당", lat: 37.5609, lng: 126.9866, photo: { url: "/images/music-korea.webp", license: "kogl-3" } },
  ]);
  await planWithFreeAfternoon(page);
  const card = page.getByRole("article", { name: "Suggested for your free time: 사진 있는 식당" });
  const photo = card.getByRole("img", { name: "사진 있는 식당" });
  await expect(photo).toBeVisible();
  // 변경 금지(제3유형) — 자르지 않는다.
  await expect(photo).toHaveCSS("object-fit", "contain");
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(card).toContainText("Photo: Korea Tourism Organization · KOGL Type 3 (no alterations)");
  // 출처 표기는 읽혀야 한다: text-muted(#b9afa0, 배경 대비 8:1). text-faint는 AA 미달이었다(T-055).
  await expect(card.locator("figcaption")).toHaveCSS("color", "rgb(185, 175, 160)");
});

test("a photo that fails to load leaves no broken image behind", async ({ page }) => {
  await fixSuggestions(page, [
    { id: "t-broken", kind: "meal", name: "사진 깨진 식당", lat: 37.5609, lng: 126.9866, photo: { url: "/images/does-not-exist.webp", license: "kogl-1" } },
  ]);
  await planWithFreeAfternoon(page);
  const card = page.getByRole("article", { name: "Suggested for your free time: 사진 깨진 식당" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("img")).toHaveCount(0);
  await expect(card).not.toContainText("Korea Tourism Organization · KOGL");
});

test("Google photos are asked for only when the Google map is the one on screen", async ({ page }) => {
  // Places 약관: Google 장소 콘텐츠를 비구글 지도와 함께 쓰지 않는다(T-052).
  // 처음엔 "카카오 지도면 요청 0건"으로 썼는데, Google 키가 있는 프로덕션에서는 전제가 틀려 check:prod가 깨졌다
  // (2026-09-25). 키가 있든 없든 성립하는 규칙으로 고쳤다: Google 사진 요청이 있으면 Google 지도가 떠 있어야 한다.
  let photoRequests = 0;
  let googleMap = 0;
  page.on("request", request => {
    if (request.url().endsWith("/api/place-photo")) photoRequests += 1;
    if (request.url().includes("maps.googleapis.com/maps/api/js")) googleMap += 1;
  });
  await fixSuggestions(page, [{ id: "t-nophoto", kind: "meal", name: "사진 없는 식당", lat: 37.5609, lng: 126.9866 }]);
  await planWithFreeAfternoon(page);
  await expect(page.getByRole("article", { name: "Suggested for your free time: 사진 없는 식당" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  if (googleMap === 0) expect(photoRequests).toBe(0);
  else {
    expect(photoRequests).toBeGreaterThan(0);
    // Google 지도는 확대 버튼이 키보드로 잡히므로 숨기지 않고 이름 붙은 영역이어야 한다(T-055).
    await expect(page.getByRole("region", { name: "Map of this day's stops" })).toBeVisible();
  }
});
