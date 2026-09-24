import { expect, test } from "@playwright/test";
import { fillChain, type FillOptions, type GapFillState } from "../src/lib/trip/gap-fill-run";
import type { Gap } from "../src/lib/trip/gap-fill";

/**
 * T-061: 빈 구간들을 동시에 채워도 같은 가게를 두 번 고르지 않고, 두 구간의 요청이 동시에 나간다.
 * 추천·이동시간 서버는 가짜 fetch로 대신한다(응답마다 80ms 지연).
 */
const anchor = { lat: 37.5609, lng: 126.9866 };
const suggestion = (id: string) => ({
  id, kind: "meal", name: id, category: "", address: "", coord: { lat: 37.5610, lng: 126.9867 }, straightMeters: 20,
  evidence: "nearby", hoursKnown: false, hours: null, photo: null, provider: "test", placeUrl: "", mapUrl: "", score: null, confidence: null,
});
const options: FillOptions = { date: "2026-09-22", preference: "", preferred: [], mode: "transit", transfer: 45, stay: 60 };
const gap = (id: string, start: number): Gap => ({
  id, start, end: start + 90, from: { id: `from-${id}`, name: "A", coord: anchor }, to: null, anchor, kinds: ["meal"], position: "between",
});

/** 동시에 떠 있던 요청 수의 최대값. 시간 대신 이것으로 "동시에 돌았는가"를 본다(시간은 부하에 따라 흔들렸다). */
const flight = { now: 0, max: 0 };
function fakeServer() {
  const original = globalThis.fetch;
  flight.now = 0; flight.max = 0;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    flight.now += 1; flight.max = Math.max(flight.max, flight.now);
    await new Promise(done => setTimeout(done, 80));
    flight.now -= 1;
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (String(url).endsWith("/api/recommend")) {
      const excluded: string[] = body.excluded ?? [];
      // 두 구간 모두 같은 후보 목록을 받는다 — 동시에 돌면 같은 가게를 고를 수 있는 상황.
      const all = ["same-1", "same-2", "same-3", "same-4"].filter(id => !excluded.includes(id)).map(suggestion);
      return new Response(JSON.stringify({ configured: { places: true, ranking: false }, anchorKnown: true, autoScheduled: false, suggestions: all, ranking: null }));
    }
    const estimates = Object.fromEntries((body.legs ?? []).map((leg: { from: { id: string }; to: { id: string } }) =>
      [`${leg.from.id}>${leg.to.id}:${body.mode}`, { status: "known", mode: body.mode, minutes: 5, transfers: 0, fareKrw: 0, steps: [], provider: "test", fetchedAt: new Date().toISOString(), manualUrl: "https://map.kakao.com" }]));
    return new Response(JSON.stringify({ configured: true, estimates }));
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

test("two gaps filled at the same time never pick the same place, and finish together", async () => {
  const restore = fakeServer();
  try {
    const used = new Set<string>();
    const claim = (id: string) => (used.has(id) ? false : (used.add(id), true));
    const results: Record<string, GapFillState[]> = {};
    const controller = new AbortController();
    await Promise.all(["g1", "g2"].map((id, i) => fillChain(gap(id, 700 + i * 200), [], [], options, controller.signal,
      items => { results[id] = items; }, claim, () => [...used])));

    const picked = Object.values(results).flat().flatMap(s => s.status === "filled" ? [s.suggestion.id] : []);
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(new Set(picked).size).toBe(picked.length);
    // 두 구간이 동시에 돌았다면 같은 순간에 요청이 두 개 이상 떠 있다. 순서대로면 늘 하나다.
    // 처음엔 걸린 시간(300ms 미만)으로 봤는데 전체 실행 부하에서 535ms가 나와 흔들렸다.
    expect(flight.max).toBeGreaterThanOrEqual(2);
  } finally {
    restore();
  }
});

test("a place taken by another gap is skipped, and the gap searches again without it", async () => {
  const restore = fakeServer();
  try {
    // 다른 구간이 same-1~3을 이미 가져갔다. 이 구간은 그 셋을 빼고 다시 찾아 same-4를 받아야 한다.
    const taken = new Set(["same-1", "same-2", "same-3"]);
    const claim = (id: string) => (taken.has(id) ? false : (taken.add(id), true));
    let last: GapFillState[] = [];
    await fillChain(gap("g3", 700), [], [], options, new AbortController().signal, items => { last = items; }, claim);
    const filled = last.find(s => s.status === "filled");
    expect(filled && filled.status === "filled" ? filled.suggestion.id : null).toBe("same-4");
  } finally {
    restore();
  }
});
