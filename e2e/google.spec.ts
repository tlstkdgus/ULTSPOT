import { expect, test } from "@playwright/test";
import { GOOGLE_MATCH_METERS, pickGooglePhoto } from "../src/lib/recommend/google";

/**
 * Google 장소 사진 (T-052). 실제 Google 호출은 키가 있어야 해서 여기서는 응답 해석과 라우트의 경계만 본다.
 */
const here = { lat: 37.5609, lng: 126.9866 };
const place = (lat: number, lng: number, photoName = "places/abc/photos/xyz", authors = [{ displayName: "김작가", uri: "https://maps.google.com/maps/contrib/1" }]) =>
  ({ id: "abc", location: { latitude: lat, longitude: lng }, photos: [{ name: photoName, authorAttributions: authors }] });

test("the nearest same-name place within range gives the photo, with its author", () => {
  expect(pickGooglePhoto({ places: [place(37.5610, 126.9867)] }, here))
    .toEqual({ photoName: "places/abc/photos/xyz", authors: [{ name: "김작가", uri: "https://maps.google.com/maps/contrib/1" }] });
  // 가까운 쪽을 고른다.
  const near = place(37.5609, 126.9866, "places/near/photos/p1");
  expect(pickGooglePhoto({ places: [place(37.5615, 126.9870, "places/far/photos/p2"), near] }, here)?.photoName).toBe("places/near/photos/p1");
  // 150m 밖이면 다른 지점일 수 있다. 싣지 않는다.
  expect(GOOGLE_MATCH_METERS).toBe(150);
  expect(pickGooglePhoto({ places: [place(37.5640, 126.9866)] }, here)).toBeNull();
  // 촬영자를 모르면 표기 의무를 지킬 수 없다.
  expect(pickGooglePhoto({ places: [place(37.5609, 126.9866, "places/abc/photos/xyz", [])] }, here)).toBeNull();
  // 사진 이름은 URL 경로에 들어간다. 형식이 이상하면 버린다.
  expect(pickGooglePhoto({ places: [place(37.5609, 126.9866, "../../evil")] }, here)).toBeNull();
  expect(pickGooglePhoto({}, here)).toBeNull();
  expect(pickGooglePhoto({ places: "nope" }, here)).toBeNull();
});

test("the photo route checks its input, never caches and never leaks a key", async ({ request }) => {
  expect((await request.post("/api/place-photo", { data: { name: "" , coord: here } })).status()).toBe(400);
  expect((await request.post("/api/place-photo", { data: { name: "식당", coord: { lat: 0, lng: 0 } } })).status()).toBe(400);
  expect((await request.post("/api/place-photo", { headers: { "Content-Type": "application/json" }, data: "x".repeat(2_000) })).status()).toBe(413);

  const response = await request.post("/api/place-photo", { data: { name: "명동교자 본점", coord: here } });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.json() as { configured: boolean; photo: { url: string; provider: string; authors: unknown[] } | null };
  // 키가 없는 환경에서는 조용히 사진 없음. 있으면 Google 사진 주소와 촬영자가 함께 온다.
  if (body.photo) {
    expect(body.photo.provider).toBe("google");
    expect(body.photo.url).toMatch(/^https:\/\//);
    expect(body.photo.authors.length).toBeGreaterThan(0);
  }
  const serialised = JSON.stringify(body);
  expect(serialised).not.toContain("key=");
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) expect(serialised).not.toContain(key);
});
