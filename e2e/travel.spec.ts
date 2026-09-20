import { expect, test } from "@playwright/test";
import { isKoreanCoord, mapLinks, roundCoord, straightLineMeters } from "../src/lib/trip/geo";
import { legKey, travelMinutes, travelReasons, unconfirmed, hasUnconfirmedTravel, type TravelEstimate } from "../src/lib/trip/travel";
import { lookupLeg, parseAddressSearch, parseTransitRoute, parseWalkRoute } from "../src/lib/trip/kakao";
import { effectiveHours, eventPoint, planTrip, statusOn, unavailableReason, type FanEvent } from "../src/lib/trip/planner";
import { planningLegs } from "../src/lib/trip/travel-client";
import { catalog } from "../src/lib/trip/catalog";
import { parseSavedTrip } from "../src/lib/trip/storage";

const seoul = { lat: 37.5709, lng: 126.9827 };
const gangnam = { lat: 37.5273, lng: 127.0389 };
const from = { id: "a", name: "출발", address: "서울 중구 청계천로 40", coord: seoul };
const to = { id: "b", name: "도착", address: "서울 강남구 압구정로 407", coord: gangnam };
const now = () => "2026-09-20T05:00:00.000Z";

test("coordinates outside Korea are treated as unconfirmed, not as data", () => {
  expect(isKoreanCoord(seoul)).toBe(true);
  expect(isKoreanCoord({ lat: 0, lng: 0 })).toBe(false);
  // 위경도를 뒤바꿔 넣은 흔한 오류.
  expect(isKoreanCoord({ lat: 126.98, lng: 37.57 })).toBe(false);
  expect(isKoreanCoord({ lat: "37.5", lng: "127" })).toBe(false);
  expect(roundCoord({ lat: 37.570912345, lng: 126.982787654 })).toEqual({ lat: 37.57091, lng: 126.98279 });
});

test("straight line distance is metres and never becomes a travel time", () => {
  const metres = straightLineMeters(seoul, gangnam);
  expect(metres).toBeGreaterThan(6_000);
  expect(metres).toBeLessThan(8_000);
  expect(straightLineMeters(seoul, seoul)).toBe(0);
});

test("manual map links work without any API key and fall back when coordinates are missing", () => {
  expect(mapLinks.route(from, to, "traffic")).toBe(
    "https://map.kakao.com/link/by/traffic/%EC%B6%9C%EB%B0%9C,37.5709,126.9827/%EB%8F%84%EC%B0%A9,37.5273,127.0389");
  expect(mapLinks.route(from, { ...to, coord: undefined }, "walk"))
    .toBe(`https://map.kakao.com/link/search/${encodeURIComponent(to.address)}`);
  // 이름의 쉼표·슬래시는 링크 구분자라 지운다.
  expect(mapLinks.place({ id: "c", name: "A,B/C", coord: seoul })).toBe("https://map.kakao.com/link/map/A%20B%20C,37.5709,126.9827");
  expect(mapLinks.place({ id: "d", name: "좌표 없음", address: "서울 중구" })).toBe(
    "https://map.kakao.com/link/search/%EC%84%9C%EC%9A%B8%20%EC%A4%91%EA%B5%AC");
});

test("an unconfirmed leg carries the planning buffer, a reason and a manual route link", () => {
  const estimate = unconfirmed(from, to, "transit", 45, travelReasons.noKey);
  expect(estimate.status).toBe("unconfirmed");
  expect(estimate.bufferMinutes).toBe(45);
  expect(estimate.manualUrl).toContain("map.kakao.com/link/by/traffic/");
  expect(travelMinutes(estimate, 45)).toBe(45);
  expect(travelMinutes(undefined, 30)).toBe(30);
  expect(hasUnconfirmedTravel([estimate])).toBe(true);
});

test("kakao transit response becomes minutes, transfers and fare without inventing values", () => {
  const body = {
    status: "OK",
    properties: { total: 2, landingURL: "https://map.kakao.com/?target=directions" },
    routes: [
      { properties: { type: "SUBWAY", totalTime: 2_040, totalDistance: 9_100, transfers: 1, fare: { value: 1_500 } },
        steps: [
          { properties: { type: "WALKING", time: 180, distance: 200 } },
          { properties: { type: "SUBWAY", time: 1_500, distance: 8_600, vehicles: [{ type: "일반", name: "3호선" }] } },
        ] },
      { properties: { type: "BUS", totalTime: 3_600, transfers: 0, fare: { value: 1_500 } }, steps: [] },
    ],
  };
  const estimate = parseTransitRoute(body, from, to, 45, now);
  expect(estimate.status).toBe("known");
  if (estimate.status !== "known") return;
  // 2,040초 = 34분. 가장 빠른 경로를 고른다.
  expect(estimate.minutes).toBe(34);
  expect(estimate.transfers).toBe(1);
  expect(estimate.fareKrw).toBe(1_500);
  expect(estimate.steps.map(s => s.mode)).toEqual(["walk", "subway"]);
  expect(estimate.steps[1].name).toBe("3호선");
  expect(estimate.fetchedAt).toBe(now());
  expect(estimate.manualUrl).toBe("https://map.kakao.com/?target=directions");
});

test("kakao failure statuses stay unconfirmed instead of becoming zero minutes", () => {
  for (const [body, reason] of [
    [{ status: "STARTNODES_NULL" }, travelReasons.noRoute],
    [{ status: "NO_RESULTS" }, travelReasons.noRoute],
    [{ status: "EQUAL_POINTS" }, travelReasons.samePoint],
    [{ status: "OK", routes: [] }, travelReasons.noRoute],
    [{ status: "OK", routes: [{ properties: {} }] }, travelReasons.noRoute],
    ["not json", travelReasons.lookupFailed],
  ] as const) {
    const estimate = parseTransitRoute(body, from, to, 45, now);
    expect(estimate.status).toBe("unconfirmed");
    if (estimate.status === "unconfirmed") expect(estimate.reason).toBe(reason);
  }
  const walk = parseWalkRoute({ status: "OK", route: { properties: { totalTime: 540, totalDistance: 700 } } }, from, to, 45, now);
  expect(walk.status === "known" && walk.minutes).toBe(9);
  expect(parseWalkRoute({ status: "TOO_FAR_AWAY" }, from, to, 45, now)).toMatchObject({ status: "unconfirmed", reason: travelReasons.tooFar });
});

test("address lookup rejects matches outside Korea", () => {
  expect(parseAddressSearch({ documents: [{ x: "126.9827", y: "37.5709", address_name: "서울 중구 청계천로 40" }] }))
    .toEqual({ coord: seoul, addressName: "서울 중구 청계천로 40" });
  expect(parseAddressSearch({ documents: [] })).toBeNull();
  expect(parseAddressSearch({ documents: [{ x: "0", y: "0" }] })).toBeNull();
});

test("date overrides beat weekday closures and stay distinct from unconfirmed hours", () => {
  const base = catalog[0];
  const holiday: FanEvent = { ...base, dateOverrides: [
    { date: "2026-09-23", closed: true, source: base.provenance.url, checked_on: "2026-09-20" },
    { date: "2026-09-24", opens: 660, closes: 900, lastEntry: 880, source: base.provenance.url, checked_on: "2026-09-20" },
    { date: "2026-09-28", opens: null, closes: null, source: base.provenance.url, checked_on: "2026-09-20" },
  ] };
  expect(unavailableReason(holiday, "2026-09-23")).toBe("Closed on this date by the venue notice.");
  expect(statusOn(holiday, "2026-09-23")).toBe("closedByNotice");
  expect(effectiveHours(holiday, "2026-09-24")).toMatchObject({ closed: false, opens: 660, closes: 900, lastEntry: 880 });
  expect(statusOn(holiday, "2026-09-24")).toBe("open");
  expect(statusOn(holiday, "2026-09-28")).toBe("unconfirmed");
  // 2026-09-21은 월요일이고 기본 휴무일이다. 예외가 없으면 요일 규칙이 그대로 적용된다.
  expect(statusOn(base, "2026-09-21")).toBe("closed");
  // 날짜 예외는 그날의 요일 휴무를 덮는다.
  const openOnMonday: FanEvent = { ...base, dateOverrides: [{ date: "2026-09-21", opens: 600, closes: 1200, source: base.provenance.url, checked_on: "2026-09-20" }] };
  expect(statusOn(openOnMonday, "2026-09-21")).toBe("open");
});

test("known leg times replace the flat buffer and change how many stops fit", () => {
  const input = { date: "2026-09-22", start: 660, end: 1080, stay: 60, transfer: 45 };
  const a: FanEvent = { ...catalog[0], id: "a", coord: { lat: 37.5709, lng: 126.9827, source: "test", checked_on: "2026-09-20" } };
  const b: FanEvent = { ...catalog[1], id: "b", coord: { lat: 37.5613, lng: 126.9857, source: "test", checked_on: "2026-09-20" } };
  const known = (minutes: number): TravelEstimate => ({
    status: "known", mode: "transit", minutes, transfers: 0, fareKrw: 1_500,
    steps: [{ mode: "subway", minutes }], provider: "test", fetchedAt: now(), manualUrl: "https://map.kakao.com/",
  });
  const table = {
    [legKey("a", "b", "transit")]: known(9),
    [legKey("b", "a", "transit")]: known(11),
  };
  const withoutLookup = planTrip([a, b], input);
  const withLookup = planTrip([a, b], input, table);
  expect(withoutLookup.stops.map(s => s.travel)).toEqual([0, 45]);
  expect(withLookup.stops.map(s => s.travel)).toEqual([0, 9]);
  expect(withLookup.stops[1].travelEstimate?.status).toBe("known");
  expect(withLookup.stops[1].departure).toBeLessThan(withoutLookup.stops[1].departure);
  // 조회값이 없는 구간은 계획용 여유 시간으로 채우되 상태는 미확인으로 남는다.
  const partial = planTrip([a, b], input, { [legKey("a", "b", "transit")]: unconfirmed(eventPoint(a), eventPoint(b), "transit", 45, travelReasons.noCoord) });
  expect(partial.stops[1].travel).toBe(45);
  expect(partial.stops[1].travelEstimate).toMatchObject({ status: "unconfirmed", reason: travelReasons.noCoord });
  expect(hasUnconfirmedTravel(partial.stops.map(s => s.travelEstimate))).toBe(true);
  // 조회를 아예 돌리지 않았어도 구간은 빈칸이 아니라 미확인이고 직접 확인 링크가 붙는다.
  const noTable = planTrip([a, b], input).stops[1].travelEstimate;
  expect(noTable).toMatchObject({ status: "unconfirmed", reason: travelReasons.notRequested, bufferMinutes: 45 });
  expect(noTable?.manualUrl).toContain("map.kakao.com/link/by/traffic/");
});

test("start location adds the first leg and end location must fit before the day ends", () => {
  const a: FanEvent = { ...catalog[1], id: "a", opens: 600, closes: 1_320 };
  const base = { date: "2026-09-22", start: 660, end: 780, stay: 60, transfer: 30 };
  // 출발 위치가 없으면 첫 장소에 11:00 도착으로 계산한다 (기존 동작).
  expect(planTrip([a], base).stops[0]).toMatchObject({ arrival: 660, travel: 0, travelEstimate: null });
  // 출발 위치를 넣으면 첫 구간 이동시간이 붙는다.
  const withOrigin = planTrip([a], { ...base, origin: { label: "숙소", address: "서울 마포구" } });
  expect(withOrigin.stops[0]).toMatchObject({ arrival: 690, travel: 30 });
  expect(withOrigin.stops[0].travelEstimate?.status).toBe("unconfirmed");
  // 12:30 종료 + 돌아가는 30분 = 13:00. 종료 시각 13:00 안에 들어간다.
  const fits = planTrip([a], { ...base, origin: { label: "숙소" }, destination: { label: "숙소" } });
  expect(fits.stops).toHaveLength(1);
  expect(fits.returnLeg?.minutes).toBe(30);
  // 하루를 12:45까지로 줄이면 돌아가는 시간이 넘쳐 일정에 넣지 못한다.
  const tooTight = planTrip([a], { ...base, end: 765, origin: { label: "숙소" }, destination: { label: "숙소" } });
  expect(tooTight.stops).toHaveLength(0);
  expect(tooTight.omitted[0].reason).toContain("Cannot fit");
  expect(planTrip([a], base).returnLeg).toBeNull();
});

test("planning legs cover every ordered pair plus start and end", () => {
  const events = catalog.slice(0, 3);
  expect(planningLegs(events, {})).toHaveLength(6);
  const full = planningLegs(events, { origin: { label: "숙소" }, destination: { label: "공항" } });
  expect(full).toHaveLength(12);
  expect(full.filter(l => l.from.id === "trip-origin")).toHaveLength(3);
  expect(full.filter(l => l.to.id === "trip-destination")).toHaveLength(3);
  expect(planningLegs(events.slice(0, 1), {})).toHaveLength(0);
});

test("saved drafts keep start, end and travel mode but reject bad coordinates and reviewed fields", () => {
  const input = { date: "2026-09-22", start: 660, end: 1080, stay: 60, transfer: 45 };
  const saved = parseSavedTrip({ version: 1, selected: [], personal: [], input: {
    ...input, travelMode: "walk",
    origin: { label: "숙소", address: "서울 마포구 양화로", coord: { lat: 37.5547, lng: 126.9226 } },
    destination: { label: "인천공항", coord: { lat: 0, lng: 0 } },
  } });
  expect(saved?.input.travelMode).toBe("walk");
  expect(saved?.input.origin?.coord).toEqual({ lat: 37.5547, lng: 126.9226 });
  // 범위를 벗어난 좌표는 버리고 이름만 남긴다. 조용히 (0,0)을 쓰지 않는다.
  expect(saved?.input.destination).toEqual({ label: "인천공항", address: undefined, coord: undefined });
  expect(parseSavedTrip({ version: 1, selected: [], personal: [], input: { ...input, travelMode: "teleport" } })).toBeNull();
  expect(parseSavedTrip({ version: 1, selected: [], personal: [], input: { ...input, origin: { label: "" } } })).toBeNull();
  // 저장본이 없던 예전 형식도 그대로 읽힌다.
  expect(parseSavedTrip({ version: 1, selected: [], personal: [], input })?.input.origin).toBeUndefined();
  // 검수 전용 필드가 섞인 개인 행사는 거부한다.
  expect(parseSavedTrip({ version: 1, selected: [], personal: [{ ...catalog[0], id: "personal-x", coord: { lat: 37.5, lng: 127 } }], input })).toBeNull();
});

/**
 * /api/travel은 키가 없을 때도 200을 돌려주고 모든 구간을 미확인으로 표시한다.
 * 키가 없는 상태가 정상 경로이므로, 여기서 500이 나면 화면이 빈칸이 된다.
 */
/**
 * 키가 있든 없든 응답 계약은 같다. 키가 없으면 전 구간 미확인, 있으면 조회값이거나 미확인이다.
 * 어느 쪽이든 500이 되지 않고 키가 브라우저로 새지 않는다.
 */
test("travel API answers in both key states and never leaks the key to the browser", async ({ request }) => {
  const legs = [{ from, to }];
  const response = await request.post("/api/travel", { data: { mode: "transit", bufferMinutes: 45, legs } });
  expect(response.status()).toBe(200);
  const body = await response.json() as { configured: boolean; estimates: Record<string, TravelEstimate> };
  const estimate = body.estimates[legKey("a", "b", "transit")];
  if (estimate.status === "known") {
    // 키가 설정된 환경: 실제 조회값이어야 하고 계획용 여유 시간이 섞이지 않는다.
    expect(body.configured).toBe(true);
    expect(estimate.minutes).toBeGreaterThan(0);
    expect(estimate.provider).toBe("카카오맵 REST API");
    expect(estimate.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  } else {
    expect(estimate.bufferMinutes).toBe(45);
    expect(estimate.manualUrl).toContain("map.kakao.com/link/by/traffic/");
    expect([travelReasons.noKey, travelReasons.noCoord, travelReasons.noRoute,
      travelReasons.lookupFailed, travelReasons.timedOut, travelReasons.budgetReached]).toContain(estimate.reason);
  }
  const serialised = JSON.stringify(body);
  expect(serialised).not.toContain("KakaoAK");
  expect(serialised).not.toContain(process.env.KAKAO_REST_API_KEY ?? "no-key-configured");
});

test("travel API rejects bad input instead of guessing", async ({ request }) => {
  expect((await request.post("/api/travel", { data: { legs: [] } })).status()).toBe(400);
  expect((await request.post("/api/travel", { data: { legs: [{ from: { id: "a" }, to }] } })).status()).toBe(400);
  expect((await request.post("/api/travel", { headers: { "Content-Type": "application/json" }, data: "{" })).status()).toBe(400);
  const tooMany = Array.from({ length: 43 }, (_, i) => ({ from: { ...from, id: `a${i}` }, to }));
  expect((await request.post("/api/travel", { data: { legs: tooMany } })).status()).toBe(400);
  // 좌표가 없는 지점은 거부가 아니라 "좌표 미확인"으로 답한다.
  const noCoord = await request.post("/api/travel", { data: { legs: [{ from: { id: "a", name: "출발" }, to }] } });
  expect(noCoord.status()).toBe(200);
  const body = await noCoord.json() as { estimates: Record<string, TravelEstimate> };
  expect(body.estimates[legKey("a", "b", "transit")].status).toBe("unconfirmed");
});

/**
 * T-024 검토 재현 3건을 서버에서 다시 막는다.
 * 계약 검사(scripts/review/travel-contract.mjs)는 모듈을 직접 불러 확인하고, 이 테스트는
 * 실제 라우트 핸들러가 같은 경계를 지키는지 확인한다.
 */
test("travel API caps the body by bytes, rejects clashing ids and never repeats a leg lookup", async ({ request }) => {
  // 한글은 글자 하나가 3바이트다. 글자 수로 재면 통과하지만 바이트로는 16KiB를 넘는다.
  const fat = Array.from({ length: 15 }, (_, i) => ({
    from: { ...from, id: `a${i}`, name: "가".repeat(120), address: "가".repeat(300) },
    to: { ...to, id: `b${i}`, name: "나".repeat(120), address: "나".repeat(300) },
  }));
  const payload = JSON.stringify({ mode: "walk", legs: fat });
  expect(payload.length).toBeLessThan(16 * 1024);
  expect(Buffer.byteLength(payload, "utf8")).toBeGreaterThan(16 * 1024);
  const tooBig = await request.post("/api/travel", { headers: { "Content-Type": "application/json" }, data: payload });
  expect(tooBig.status()).toBe(413);

  // 같은 id에 다른 좌표를 보내면 구간 키가 겹쳐 엉뚱한 응답이 붙는다. 조회 전에 거부한다.
  const clash = await request.post("/api/travel", { data: { mode: "walk", legs: [
    { from, to }, { from: { ...from, coord: { lat: 37.6, lng: 127.1 } }, to },
  ] } });
  expect(clash.status()).toBe(400);

  // 같은 구간 42개를 보내도 외부 고유 호출은 1건을 넘지 않는다(키가 없으면 0건).
  const duplicated = await request.post("/api/travel", { data: { mode: "walk", legs: Array(42).fill({ from, to }) } });
  expect(duplicated.status()).toBe(200);
  const body = await duplicated.json() as { estimates: Record<string, TravelEstimate>; upstreamCalls: number };
  expect(Object.keys(body.estimates)).toHaveLength(1);
  expect(body.upstreamCalls).toBeLessThanOrEqual(1);
});

/**
 * 무응답 공급자 테스트. 계약 검사는 signal이 넘어가는지만 보고, 시간 제한이 실제로 걸리는지는
 * 보지 않는다. 타임아웃이 없으면 화면이 영원히 매달리고 "이동시간 미확인" 경로가 동작하지 않는다.
 */
test("a hanging provider is cut off and becomes an unconfirmed leg, not a hung request", async () => {
  const original = globalThis.fetch;
  let receivedSignal: AbortSignal | undefined;
  let aborted = false;
  // 응답을 주지 않고 매달리는 공급자. 취소 신호가 오면 그때만 끝난다.
  globalThis.fetch = ((_input: unknown, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
    receivedSignal = init?.signal;
    init?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
  })) as typeof globalThis.fetch;
  process.env.KAKAO_REST_API_KEY = "test-key-not-a-real-key";
  try {
    const started = Date.now();
    const estimate = await lookupLeg(from, to, "transit", 45, { timeoutMs: 300, now });
    const elapsed = Date.now() - started;
    expect(receivedSignal).toBeDefined();
    expect(aborted).toBe(true);
    expect(elapsed).toBeLessThan(3_000);
    expect(estimate).toMatchObject({ status: "unconfirmed", reason: travelReasons.timedOut, bufferMinutes: 45 });
    // 실패해도 직접 확인 경로는 남는다.
    expect(estimate.status === "unconfirmed" && estimate.manualUrl).toContain("map.kakao.com/link/by/traffic/");
  } finally {
    globalThis.fetch = original;
    delete process.env.KAKAO_REST_API_KEY;
  }
});
