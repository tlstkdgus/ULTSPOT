import { expect, test } from "@playwright/test";
import { fillChain, type FillOptions, type GapFillState } from "../src/lib/trip/gap-fill-run";
import type { Gap } from "../src/lib/trip/gap-fill";

/**
 * T-061: 빈 구간들을 동시에 채워도 같은 가게를 두 번 고르지 않고, 순서대로 할 때보다 빨리 끝난다.
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

function fakeServer() {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    await new Promise(done => setTimeout(done, 80));
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
    const started = Date.now();
    await Promise.all(["g1", "g2"].map((id, i) => fillChain(gap(id, 700 + i * 200), [], [], options, controller.signal,
      items => { results[id] = items; }, claim, () => [...used])));
    const elapsed = Date.now() - started;

    const picked = Object.values(results).flat().flatMap(s => s.status === "filled" ? [s.suggestion.id] : []);
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(new Set(picked).size).toBe(picked.length);
    // 구간 하나에 추천 1회 + 이동시간 1회(각 80ms). 동시에 돌면 두 구간이 대략 한 구간 시간에 끝난다.
    // 순서대로라면 최소 320ms. 여유를 두고 300ms 미만을 요구한다.
    expect(elapsed).toBeLessThan(300);
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
