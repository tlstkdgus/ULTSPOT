"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { ExternalIcon } from "@/components/icons";
import { TravelLeg } from "@/components/travel-leg";
import { useI18n } from "@/i18n/locale";
import { fetchSuggestions, type RankedSuggestion } from "@/lib/recommend/client";
import type { PreferenceProfile } from "@/lib/recommend/preference";
import { findGaps, fitInGap, MAX_PER_GAP, nextGap, type Gap, type GapFit } from "@/lib/trip/gap-fill";
import type { SuggestionKind } from "@/lib/recommend/nearby";
import { straightLineMeters, type TravelPoint } from "@/lib/trip/geo";
import { clock, type TripInput, type TripResult } from "@/lib/trip/planner";
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

type FillOptions = { preference: string; preferred: SuggestionKind[]; mode: TravelMode; transfer: number; stay: number };

/**
 * 빈 구간 하나를 채운다. 주변 후보(카카오 장소 + Jev 취향 순위)를 받아 순위대로 이동시간을 재고,
 * 앞뒤 일정을 밀지 않고 들어가는 첫 후보를 고른다. 들어가는 곳이 없으면 none.
 *
 * 순위를 다시 매기지 않는다. Jev가 정한 순서(취향이 없으면 거리순)를 그대로 따르고, 여기서는
 * "시간 안에 들어가는가"만 거른다.
 */
async function fillGap(gap: Gap, excluded: string[], options: FillOptions, signal: AbortSignal): Promise<GapFillState> {
  const found = await fetchSuggestions({ anchor: gap.anchor, kinds: gap.kinds, preference: options.preference, excluded }, signal);
  const candidates = found.suggestions.filter(s => !excluded.includes(s.id)).slice(0, CANDIDATES_PER_GAP);
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
  for (const [index, suggestion] of candidates.entries()) {
    const point = points[index];
    const legIn = gap.from ? lookUp(gap.from, point) : null;
    const legOut = gap.to ? lookUp(point, gap.to) : null;
    const fit = fitInGap(gap,
      legIn ? travelMinutes(legIn, options.transfer) : 0,
      legOut ? travelMinutes(legOut, options.transfer) : 0,
      options.stay);
    if (fit) return { status: "filled", gap, suggestion, point, fit, legIn, legOut, ranked: Boolean(found.ranking?.applied) };
  }
  return { status: "none", gap };
}

/**
 * 빈 구간을 앞에서부터 이어서 채운다. 한 곳을 넣고도 한 시간 이상 남으면 그 장소에서 다음 곳을 찾는다
 * (최대 MAX_PER_GAP). 중간 상태를 emit으로 알려 화면이 하나씩 채워지게 한다.
 */
async function fillChain(first: Gap, prefix: GapFillState[], excluded: string[], options: FillOptions,
  signal: AbortSignal, emit: (items: GapFillState[]) => void) {
  const items = [...prefix];
  let gap: Gap | null = first;
  let skip = [...excluded];
  while (gap && items.filter(i => i.status === "filled").length < MAX_PER_GAP) {
    emit([...items, { status: "finding", gap }]);
    const state = await fillGap(gap, skip, options, signal);
    if (signal.aborted) return;
    items.push(state);
    if (state.status !== "filled") break;
    skip = [...skip, state.suggestion.id];
    gap = nextGap(gap, { point: state.point, departure: state.fit.departure, kind: state.suggestion.kind }, options.preferred);
  }
  emit(items);
}

/**
 * 확정 일정의 빈 시간에 주변 추천을 끼운다 (T-049).
 *
 * - 확정 일정(result)은 바꾸지 않는다. 추천은 별도 상태로 두고 화면에서만 사이에 끼워 보여준다.
 * - 이동시간 조회가 끝난 뒤(ready)에만 돈다. 여유 시간 기준 임시 일정으로 한 번, 조회 뒤 한 번 —
 *   두 번 부르지 않기 위해서다.
 * - 구간은 순서대로 채운다. 앞 구간에 넣은 곳을 뒤 구간에서 다시 고르지 않게 하려는 것이다.
 */
export function useGapFill({ result, input, profile, ready }: {
  result: TripResult | null;
  input: TripInput;
  profile: PreferenceProfile;
  ready: boolean;
}) {
  const gaps = ready ? findGaps(result, input, profile.kinds) : [];
  const options: FillOptions = { preference: profile.sentence, preferred: profile.kinds, mode: input.travelMode ?? "transit", transfer: input.transfer, stay: input.stay };
  /** 이 값이 같으면 같은 일정이다. 달라지면 이전 추천을 버리고 새로 채운다. */
  const runKey = JSON.stringify([gaps.map(g => [g.id, g.start, g.end, g.kinds, g.from?.id ?? null, g.to?.id ?? null]), options]);
  const [store, setStore] = useState<{ key: string; chains: Record<string, GapFillState[]> }>({ key: "", chains: {} });
  /** 사용자가 "다른 곳"으로 넘긴 후보. 일정이 바뀌어도 다시 권하지 않는다. */
  const skipped = useRef<Record<string, string[]>>({});
  const controllers = useRef<Record<string, AbortController>>({});
  const latest = useRef({ runKey, options });
  useEffect(() => { latest.current = { runKey, options }; });

  const put = (key: string, rootId: string, items: GapFillState[]) =>
    setStore(current => current.key === key
      ? { key, chains: { ...current.chains, [rootId]: items } }
      : { key, chains: { [rootId]: items } });
  const pickedIn = (items: GapFillState[]) => items.flatMap(i => i.status === "filled" ? [i.suggestion.id] : []);

  useEffect(() => {
    if (!gaps.length) return;
    const key = runKey;
    const controller = new AbortController();
    void (async () => {
      const used: string[] = [];
      for (const gap of gaps) {
        if (controller.signal.aborted) return;
        let last: GapFillState[] = [];
        await fillChain(gap, [], [...used, ...(skipped.current[gap.id] ?? [])], options, controller.signal,
          items => { last = items; if (!controller.signal.aborted) put(key, gap.id, items); });
        used.push(...pickedIn(last));
      }
    })();
    return () => controller.abort();
    // runKey가 gaps·options를 모두 담는다. 매 렌더 새로 만든 배열로 다시 돌지 않게 키만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const chains: GapChain[] = gaps.map(root => ({
    root,
    items: (store.key === runKey ? store.chains[root.id] : undefined) ?? [{ status: "finding", gap: root }],
  }));

  /** index번째부터 다시 채운다. 그 앞은 그대로 두고, 다른 구간에 들어간 곳은 고르지 않는다. */
  function refill(root: Gap, index: number, skip?: string) {
    if (skip) skipped.current[root.id] = [...(skipped.current[root.id] ?? []), skip];
    const chain = chains.find(c => c.root.id === root.id);
    if (!chain) return;
    const key = latest.current.runKey;
    controllers.current[root.id]?.abort();
    const controller = new AbortController();
    controllers.current[root.id] = controller;
    const prefix = chain.items.slice(0, index);
    const elsewhere = chains.flatMap(c => c.root.id === root.id ? [] : pickedIn(c.items));
    void fillChain(chain.items[index].gap, prefix, [...elsewhere, ...pickedIn(prefix), ...(skipped.current[root.id] ?? [])],
      latest.current.options, controller.signal, items => { if (!controller.signal.aborted) put(key, root.id, items); });
  }

  return {
    chains,
    another: (root: Gap, index: number, suggestionId: string) => refill(root, index, suggestionId),
    again: (root: Gap, index: number) => refill(root, index),
    /** index번째를 비운다. 그 뒤에 이어 붙였던 곳도 그 장소에서 출발했으므로 함께 뺀다. */
    remove: (root: Gap, index: number) => {
      controllers.current[root.id]?.abort();
      const chain = chains.find(c => c.root.id === root.id);
      if (chain) put(runKey, root.id, [...chain.items.slice(0, index), { status: "removed", gap: chain.items[index].gap }]);
    },
  };
}

/**
 * 빈 시간 한 칸. 확정 정류장과 **같은 모양으로 보이지 않게** 점선 테두리와 "추천 · 영업시간 미확인"을
 * 붙인다. 가게가 문을 열었는지 우리는 모른다. 확정처럼 보이면 팬이 헛걸음한다.
 */
export function GapSlot({ state, transfer, onAnother, onRemove, onAgain }: {
  state: GapFillState;
  transfer: number;
  onAnother: () => void;
  onRemove: () => void;
  onAgain: () => void;
}) {
  const { t } = useI18n();
  const idle = t.result.duration(state.gap.end - state.gap.start);

  if (state.status !== "filled") {
    return <li>
      <div role={state.status === "finding" ? "status" : undefined}
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-line-strong px-5 py-3 text-body-sm text-text-muted">
        <span className="font-mono text-label">{clock(state.gap.start)}–{clock(state.gap.end)}</span>
        <span>{state.status === "finding" ? t.gap.finding(idle) : state.status === "none" ? t.gap.none(idle) : t.gap.free(idle)}</span>
        {state.status === "removed" && <Button size="sm" variant="ghost" className="ml-auto" onClick={onAgain}>{t.gap.again}</Button>}
      </div>
    </li>;
  }

  const { suggestion, fit, legIn } = state;
  return <li>
    <TravelLeg estimate={legIn} bufferMinutes={transfer} />
    <article aria-label={t.gap.label(suggestion.name)} className="rounded-xl border border-dashed border-line-strong bg-bg-soft p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{t.gap.badge}</Badge>
        <Badge>{t.gap.hoursUnknown}</Badge>
        <span className="ml-auto font-mono text-label">{clock(fit.arrival)}–{clock(fit.departure)}</span>
      </div>
      <h2 className="mt-4 text-heading">{suggestion.name}</h2>
      <p className="mt-2 text-body-sm text-text-muted">
        {t.suggest.kinds[suggestion.kind]}{suggestion.category && <> · {suggestion.category}</>} · {t.suggest.distance(suggestion.straightMeters)}
      </p>
      <p className="mt-3 text-caption text-text-muted">{state.ranked ? t.gap.whyRanked : t.gap.whyNearby}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a className="inline-flex min-h-11 items-center gap-1.5 text-body-sm underline underline-offset-4"
          href={suggestion.placeUrl || suggestion.mapUrl} target="_blank" rel="noopener noreferrer">
          {t.gap.open} <ExternalIcon />
        </a>
        <span className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={onAnother}>{t.gap.another}</Button>
          <Button size="sm" variant="ghost" onClick={onRemove}>{t.gap.remove}</Button>
        </span>
      </div>
    </article>
  </li>;
}
