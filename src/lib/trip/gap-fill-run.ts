/**
 * 빈 시간 채우기의 실행부 (T-049·T-061). 화면(React)과 떼어 두어 따로 검사할 수 있게 했다.
 *
 * T-061: 빈 구간들을 순서대로 채우던 것을 **동시에** 채운다. 구간마다 장소 검색 + 이동시간 조회를 기다리므로
 * 순서대로 하면 구간 수만큼 늦었다. 동시에 돌리면 두 구간이 같은 가게를 고를 수 있어, 고르는 순간 claim으로
 * 선점한다(자바스크립트는 한 스레드라 확인과 등록 사이에 끼어드는 일이 없다). 선점에 밀린 구간은 그 가게를 빼고
 * 한 번 더 찾는다.
 */

import { fetchSuggestions, type RankedSuggestion } from "@/lib/recommend/client";
import type { SuggestionKind } from "@/lib/recommend/nearby";
import { fitInGap, isClosedOn, MAX_PER_GAP, nextGap, type Gap, type GapFit } from "@/lib/trip/gap-fill";
import { straightLineMeters, type TravelPoint } from "@/lib/trip/geo";
import { legKey, travelMinutes, type TravelEstimate, type TravelMode } from "@/lib/trip/travel";
import { fetchTravelTable, type TravelLeg as LegToLookUp } from "@/lib/trip/travel-client";

/** 빈 구간 하나에 이동시간을 재 보는 후보 수. 3곳이면 구간당 이동시간 조회가 최대 6개다. */
const CANDIDATES_PER_GAP = 3;
/**
 * 이 거리 안의 구간은 걸어서 잰다. 빈 시간 추천은 바로 옆 가게가 많은데(실측 11m), 대중교통 경로
 * API는 그런 구간에 경로를 주지 않아 계획용 여유 45분으로 떨어졌다 — 11m에 45분을 잡는 셈이다.
 */
const WALK_UP_TO_METERS = 800;

export type GapFillState =
  | { status: "finding"; gap: Gap }
  | { status: "filled"; gap: Gap; suggestion: RankedSuggestion; point: TravelPoint; fit: GapFit; legIn: TravelEstimate | null; legOut: TravelEstimate | null; ranked: boolean }
  | { status: "none"; gap: Gap }
  | { status: "removed"; gap: Gap };

/** 확정 정류장 사이 빈 구간 하나와, 거기에 이어 붙인 추천들. */
export type GapChain = { root: Gap; items: GapFillState[] };

export type FillOptions = { date: string; preference: string; preferred: SuggestionKind[]; mode: TravelMode; transfer: number; stay: number };

/**
 * 빈 구간 하나를 채운다. 주변 후보(카카오 장소 + Jev 취향 순위)를 받아 순위대로 이동시간을 재고,
 * 앞뒤 일정을 밀지 않고 들어가는 첫 후보를 고른다. 들어가는 곳이 없으면 none.
 *
 * 순위를 다시 매기지 않는다. Jev가 정한 순서(취향이 없으면 거리순)를 그대로 따르고, 여기서는
 * "시간 안에 들어가는가"만 거른다.
 */
export async function fillGap(gap: Gap, excluded: string[], options: FillOptions, signal: AbortSignal,
  claim: (id: string) => boolean = () => true, retried = false): Promise<GapFillState> {
  const found = await fetchSuggestions({ anchor: gap.anchor, kinds: gap.kinds, preference: options.preference, excluded }, signal);
  // 그날 쉬는 곳은 뺀다. 영업시간을 아는 곳을 먼저 재 본다 — 순위는 Jev 순서 그대로 두고, 확인된 곳이
  // 들어가면 미확인보다 낫다. 확인된 곳이 하나도 안 맞으면 미확인 후보로 넘어간다.
  const open = found.suggestions.filter(s => !excluded.includes(s.id) && !isClosedOn(s.hours, options.date));
  const candidates = [...open.filter(s => s.hours), ...open.filter(s => !s.hours)].slice(0, CANDIDATES_PER_GAP);
  if (!candidates.length) return { status: "none", gap };
  const points: TravelPoint[] = candidates.map(c => ({
    id: `gap-${c.id}`.slice(0, 80), name: c.name.slice(0, 120), address: c.address.slice(0, 300) || undefined, coord: c.coord,
  }));
  const legs: LegToLookUp[] = points.flatMap(point => [
    ...(gap.from ? [{ from: gap.from, to: point }] : []),
    ...(gap.to ? [{ from: point, to: gap.to }] : []),
  ]);
  const modeOf = (leg: LegToLookUp): TravelMode =>
    leg.from.coord && leg.to.coord && straightLineMeters(leg.from.coord, leg.to.coord) <= WALK_UP_TO_METERS ? "walk" : options.mode;
  const byMode = (mode: TravelMode) => legs.filter(leg => modeOf(leg) === mode);
  const modes = [...new Set<TravelMode>(["walk", options.mode])];
  const tables = await Promise.all(modes.map(mode => byMode(mode).length
    ? fetchTravelTable(byMode(mode), mode, options.transfer, signal).then(r => r.table) : Promise.resolve({})));
  const table = Object.assign({}, ...tables) as Record<string, TravelEstimate | undefined>;
  const lookUp = (from: TravelPoint, to: TravelPoint) => table[legKey(from.id, to.id, modeOf({ from, to }))] ?? null;
  const lost: string[] = [];
  for (const [index, suggestion] of candidates.entries()) {
    const point = points[index];
    const legIn = gap.from ? lookUp(gap.from, point) : null;
    const legOut = gap.to ? lookUp(point, gap.to) : null;
    const fit = fitInGap(gap,
      legIn ? travelMinutes(legIn, options.transfer) : 0,
      legOut ? travelMinutes(legOut, options.transfer) : 0,
      options.stay, suggestion.hours);
    if (!fit) continue;
    // 다른 구간이 먼저 고른 가게면 넘긴다. 들어가는 곳이 전부 선점됐으면 그 가게들을 빼고 한 번만 다시 찾는다.
    if (!claim(suggestion.id)) { lost.push(suggestion.id); continue; }
    return { status: "filled", gap, suggestion, point, fit, legIn, legOut, ranked: Boolean(found.ranking?.applied) };
  }
  if (lost.length && !retried && !signal.aborted) return fillGap(gap, [...excluded, ...lost], options, signal, claim, true);
  return { status: "none", gap };
}

/**
 * 빈 구간을 앞에서부터 이어서 채운다. 한 곳을 넣고도 한 시간 이상 남으면 그 장소에서 다음 곳을 찾는다
 * (최대 MAX_PER_GAP). 중간 상태를 emit으로 알려 화면이 하나씩 채워지게 한다.
 */
export async function fillChain(first: Gap, prefix: GapFillState[], excluded: string[], options: FillOptions,
  signal: AbortSignal, emit: (items: GapFillState[]) => void,
  claim: (id: string) => boolean = () => true, taken: () => string[] = () => []) {
  const items = [...prefix];
  let gap: Gap | null = first;
  let skip = [...excluded];
  while (gap && items.filter(i => i.status === "filled").length < MAX_PER_GAP) {
    emit([...items, { status: "finding", gap }]);
    // 다른 구간이 이미 고른 곳은 검색에서부터 뺀다(선점 확인은 claim이 한다).
    const state = await fillGap(gap, [...skip, ...taken()], options, signal, claim);
    if (signal.aborted) return;
    items.push(state);
    if (state.status !== "filled") break;
    skip = [...skip, state.suggestion.id];
    gap = nextGap(gap, { point: state.point, departure: state.fit.departure, kind: state.suggestion.kind }, options.preferred);
  }
  emit(items);
}

