import { expect, test } from "@playwright/test";
import { mergeSummary, type SummaryRow } from "../src/lib/trip/on-site";

/**
 * `place_status_summary`는 `group by … waiting, perks`라 **장소당 여러 행**을 돌려준다.
 * 서로 다른 답이 올라온 만큼 행이 쪼개진다. 화면은 장소당 한 줄만 보여주므로 합쳐야 한다.
 *
 * 프로덕션에서 실제로 이렇게 왔다:
 *   {waiting:"long",   perks:"none",   reports:1}
 *   {waiting:"medium", perks:"plenty", reports:2}
 * 먼저 온 행만 쓰던 코드는 1건짜리 답을 보여주고 보고 수도 1로 적었다.
 */
const row = (over: Partial<SummaryRow>): SummaryRow =>
  ({ place_id: "hikr-ground", open_to_me: true, waiting: null, perks: null, reports: 0, ...over });

test("한 장소의 여러 행이 한 줄로 합쳐진다", () => {
  const [merged] = mergeSummary([
    row({ waiting: "long", perks: "none", reports: 1 }),
    row({ waiting: "medium", perks: "plenty", reports: 2 }),
  ]);
  // 대표값은 가장 많이 보고된 조합이다. 먼저 온 행이 아니다.
  expect(merged.waiting).toBe("medium");
  expect(merged.perks).toBe("plenty");
  // 보고 수는 모든 행의 합이다.
  expect(merged.reports).toBe(3);
  expect(merged.openToMe).toBe(true);
});

test("동점이면 먼저 온 쪽을 유지해 순서가 흔들리지 않는다", () => {
  const [merged] = mergeSummary([
    row({ waiting: "short", perks: "few", reports: 2 }),
    row({ waiting: "long", perks: "none", reports: 2 }),
  ]);
  expect(merged.waiting).toBe("short");
  expect(merged.reports).toBe(4);
});

test("잠긴 장소는 행이 와도 집계가 비어 있다", () => {
  const [merged] = mergeSummary([row({ open_to_me: false, reports: 0 })]);
  expect(merged.openToMe).toBe(false);
  expect(merged.waiting).toBeNull();
  expect(merged.perks).toBeNull();
  expect(merged.reports).toBe(0);
});

test("보고가 0건인 열린 장소는 값 없이 열린 상태로 남는다", () => {
  const [merged] = mergeSummary([row({ open_to_me: true, reports: 0 })]);
  expect(merged.openToMe).toBe(true);
  expect(merged.waiting).toBeNull();
  expect(merged.reports).toBe(0);
});

test("여러 장소가 섞여 와도 장소별로 갈린다", () => {
  const merged = mergeSummary([
    row({ place_id: "a", waiting: "short", perks: "few", reports: 1 }),
    row({ place_id: "b", open_to_me: false }),
    row({ place_id: "a", waiting: "long", perks: "none", reports: 5 }),
  ]);
  expect(merged).toHaveLength(2);
  const a = merged.find(m => m.placeId === "a")!;
  expect(a.waiting).toBe("long");
  expect(a.reports).toBe(6);
  expect(merged.find(m => m.placeId === "b")!.openToMe).toBe(false);
});

test("모르는 값은 버린다 — 화면이 DB에 없는 선택지를 그리지 않는다", () => {
  const [merged] = mergeSummary([row({ waiting: "enormous", perks: "shiny", reports: 9 })]);
  expect(merged.waiting).toBeNull();
  expect(merged.perks).toBeNull();
  // 값은 버려도 보고가 있었다는 사실은 센다.
  expect(merged.reports).toBe(9);
});
