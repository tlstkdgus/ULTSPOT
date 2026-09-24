import { expect, test } from "@playwright/test";
import { areaOf, parseKeywordSearch } from "../src/lib/trip/place-search";
import { isSearchedCoord, parseSavedTrip } from "../src/lib/trip/storage";
import { parseJourney, createJourney } from "../src/lib/trip/journey";
import { browseAllSpots, fixSuggestions, fixTravelLookups, goToStep } from "./flow";
import { englishLocale } from "./locale";

englishLocale();

/**
 * 장소를 지도에서 찾아 고르기 (T-062). 고른 장소는 좌표가 붙어 이동시간을 조회할 수 있다.
 */
test("keyword results keep only Korean places with an id, and the district becomes the neighbourhood", () => {
  const rows = parseKeywordSearch({ documents: [
    { id: "123", place_name: "스타벅스 명동점", road_address_name: "서울 중구 명동길 32", category_name: "음식점 > 카페 > 커피전문점 > 스타벅스", x: "126.9853", y: "37.5637" },
    { id: "456", place_name: "Tokyo", address_name: "Tokyo", x: "139.7", y: "35.6" },
    { id: "", place_name: "no id", x: "126.98", y: "37.56" },
  ] });
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: "123", name: "스타벅스 명동점", address: "서울 중구 명동길 32", area: "중구", placeUrl: "https://place.map.kakao.com/123" });
  expect(areaOf("서울 마포구 양화로 45")).toBe("마포구");
  expect(areaOf("")).toBe("");
  expect(parseKeywordSearch({})).toEqual([]);
});

test("a saved draft accepts a coordinate only when it came from place search", () => {
  const searched = { lat: 37.5637, lng: 126.9853, source: "https://place.map.kakao.com/123", checked_on: "2026-09-25" };
  expect(isSearchedCoord(searched)).toBe(true);
  // 검수 카탈로그의 좌표 출처(주소 검색 API)나 손으로 만든 좌표는 받지 않는다.
  expect(isSearchedCoord({ ...searched, source: "https://dapi.kakao.com/v2/local/search/address.json" })).toBe(false);
  expect(isSearchedCoord({ ...searched, lat: 0, lng: 0 })).toBe(false);
  expect(isSearchedCoord({ ...searched, extra: 1 })).toBe(false);

  const personal = {
    id: "personal-x", title: "Café", area: "중구", kind: "Personal event", address: "서울 중구 명동길 32",
    from: "2026-09-22", to: "2026-09-22", opens: 600, closes: 1200, closedDays: [], reservation: false, do: "Drink", get: "Cup",
    provenance: { mode: "personal", author: "you", checkedOn: "2026-09-22", url: "https://example.com/n" },
  };
  const input = { date: "2026-09-22", start: 660, end: 1080, stay: 60, transfer: 45 };
  expect(parseSavedTrip({ version: 1, selected: [], input, personal: [{ ...personal, coord: searched }] })?.personal[0].coord).toEqual(searched);
  expect(parseSavedTrip({ version: 1, selected: [], input, personal: [{ ...personal, coord: { ...searched, source: "https://evil.example" } }] })).toBeNull();

  const journey = createJourney("2026-09-22", "2026-09-23");
  expect(parseJourney({ ...journey, custom: [{ id: "custom-1", title: "A", address: "B", kind: "cafe", note: "", coord: searched }] })?.custom[0].coord).toEqual(searched);
  expect(parseJourney({ ...journey, custom: [{ id: "custom-1", title: "A", address: "B", kind: "cafe", note: "", coord: { lat: 37.5, lng: 127 } }] })).toBeNull();
});

test("the search route checks its input", async ({ request }) => {
  expect((await request.post("/api/place-search", { data: { query: "a" } })).status()).toBe(400);
  expect((await request.post("/api/place-search", { data: { query: "가".repeat(61) } })).status()).toBe(400);
  expect((await request.post("/api/place-search", { headers: { "Content-Type": "application/json" }, data: "x".repeat(600) })).status()).toBe(413);
});

test("picking a searched place fills the form, and its travel time is looked up instead of guessed", async ({ page }) => {
  await fixTravelLookups(page);
  await fixSuggestions(page);
  await page.route("**/api/place-search", route => route.fulfill({ json: { configured: true, results: [
    { id: "999", name: "명동 테스트 카페", address: "서울 중구 명동길 1", area: "중구", category: "음식점 > 카페", coord: { lat: 37.5636, lng: 126.9851 }, placeUrl: "https://place.map.kakao.com/999" },
  ] } }));
  await page.goto("/plan");
  await browseAllSpots(page);
  await goToStep(page, 2);
  await page.getByLabel("Travel date").fill("2026-09-22");
  await goToStep(page, 1);
  await page.getByText("Add an event from its notice", { exact: true }).click();

  await page.getByLabel("Find the place on the map (optional)").fill("명동 카페");
  await page.getByLabel("Find the place on the map (optional)").press("Enter");
  await page.getByRole("button", { name: "Use 명동 테스트 카페" }).click();
  await expect(page.getByText("Picked: 명동 테스트 카페")).toBeVisible();
  await expect(page.getByLabel("Event name", { exact: true })).toHaveValue("명동 테스트 카페");
  await expect(page.getByLabel("Neighborhood", { exact: true })).toHaveValue("중구");
  await expect(page.getByLabel("Venue address", { exact: true })).toHaveValue("서울 중구 명동길 1");

  for (const [label, value] of Object.entries({ "Organizer notice URL": "https://example.com/event", "Opens": "13:00", "Closes": "18:00", "What to do": "Order a drink", "What you get": "Cup sleeve" }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("button", { name: "Add to my places" }).click();
  await page.getByRole("button", { name: "Add 명동 테스트 카페", exact: true }).click();
  await page.getByRole("button", { name: "Add HiKR Ground · K-pop floors", exact: true }).click();
  await goToStep(page, 2);
  await page.getByRole("button", { name: "Build my itinerary" }).click();
  // 예전에는 직접 추가한 곳으로 가는 구간이 늘 "미확인 · 계획용 여유"였다. 이제 조회된 값이다.
  await expect(page.getByText("Every leg uses a looked-up travel time.")).toBeVisible();
});
