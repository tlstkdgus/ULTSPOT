"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { ExternalIcon } from "@/components/icons";
import { TravelLeg } from "@/components/travel-leg";
import { useI18n } from "@/i18n/locale";
import { fetchSuggestions, type RankedSuggestion } from "@/lib/recommend/client";
import type { PreferenceProfile } from "@/lib/recommend/preference";
import { findGaps, fitInGap, type Gap, type GapFit } from "@/lib/trip/gap-fill";
import type { TravelPoint } from "@/lib/trip/geo";
import { clock, type TripInput, type TripResult } from "@/lib/trip/planner";
import { legKey, travelMinutes, type TravelEstimate, type TravelMode } from "@/lib/trip/travel";
import { fetchTravelTable, type TravelLeg as LegToLookUp } from "@/lib/trip/travel-client";

/** 빈 구간 하나에 이동시간을 재 보는 후보 수. 3곳이면 구간당 이동시간 조회가 최대 6개다. */
const CANDIDATES_PER_GAP = 3;

export type GapFillState =
  | { status: "finding"; gap: Gap }
  | { status: "filled"; gap: Gap; suggestion: RankedSuggestion; fit: GapFit; legIn: TravelEstimate | null; legOut: TravelEstimate | null; ranked: boolean }
  | { status: "none"; gap: Gap }
  | { status: "removed"; gap: Gap };

type FillOptions = { preference: string; mode: TravelMode; transfer: number; stay: number };

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
  const { table } = await fetchTravelTable(legs, options.mode, options.transfer, signal);
  for (const [index, suggestion] of candidates.entries()) {
    const point = points[index];
    const legIn = gap.from ? table[legKey(gap.from.id, point.id, options.mode)] ?? null : null;
    const legOut = gap.to ? table[legKey(point.id, gap.to.id, options.mode)] ?? null : null;
    const fit = fitInGap(gap,
      legIn ? travelMinutes(legIn, options.transfer) : 0,
      legOut ? travelMinutes(legOut, options.transfer) : 0,
      options.stay);
    if (fit) return { status: "filled", gap, suggestion, fit, legIn, legOut, ranked: Boolean(found.ranking?.applied) };
  }
  return { status: "none", gap };
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
  const options: FillOptions = { preference: profile.sentence, mode: input.travelMode ?? "transit", transfer: input.transfer, stay: input.stay };
  /** 이 값이 같으면 같은 일정이다. 달라지면 이전 추천을 버리고 새로 채운다. */
  const runKey = JSON.stringify([gaps.map(g => [g.id, g.start, g.end, g.kinds, g.from?.id ?? null, g.to?.id ?? null]), options]);
  const [store, setStore] = useState<{ key: string; fills: Record<string, GapFillState> }>({ key: "", fills: {} });
  /** 사용자가 "다른 곳"으로 넘긴 후보. 일정이 바뀌어도 다시 권하지 않는다. */
  const skipped = useRef<Record<string, string[]>>({});
  const controllers = useRef<Record<string, AbortController>>({});
  const latest = useRef({ runKey, options });
  useEffect(() => { latest.current = { runKey, options }; });

  const put = (key: string, gapId: string, state: GapFillState) =>
    setStore(current => current.key === key
      ? { key, fills: { ...current.fills, [gapId]: state } }
      : { key, fills: { [gapId]: state } });

  useEffect(() => {
    if (!gaps.length) return;
    const key = runKey;
    const controller = new AbortController();
    void (async () => {
      const used: string[] = [];
      for (const gap of gaps) {
        if (controller.signal.aborted) return;
        const state = await fillGap(gap, [...used, ...(skipped.current[gap.id] ?? [])], options, controller.signal);
        if (controller.signal.aborted) return;
        if (state.status === "filled") used.push(state.suggestion.id);
        put(key, gap.id, state);
      }
    })();
    return () => controller.abort();
    // runKey가 gaps·options를 모두 담는다. 매 렌더 새로 만든 배열로 다시 돌지 않게 키만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  const fills = gaps.map(gap => (store.key === runKey ? store.fills[gap.id] : undefined) ?? { status: "finding" as const, gap });

  /** 이 구간만 다시 채운다. 다른 구간에 들어간 곳은 고르지 않는다. */
  function refill(gap: Gap, skip?: string) {
    if (skip) skipped.current[gap.id] = [...(skipped.current[gap.id] ?? []), skip];
    const key = latest.current.runKey;
    controllers.current[gap.id]?.abort();
    const controller = new AbortController();
    controllers.current[gap.id] = controller;
    const elsewhere = fills.flatMap(f => f.gap.id !== gap.id && f.status === "filled" ? [f.suggestion.id] : []);
    put(key, gap.id, { status: "finding", gap });
    void fillGap(gap, [...elsewhere, ...(skipped.current[gap.id] ?? [])], latest.current.options, controller.signal)
      .then(state => { if (!controller.signal.aborted) put(key, gap.id, state); });
  }

  return {
    fills,
    another: (gap: Gap, suggestionId: string) => refill(gap, suggestionId),
    again: (gap: Gap) => refill(gap),
    remove: (gap: Gap) => { controllers.current[gap.id]?.abort(); put(runKey, gap.id, { status: "removed", gap }); },
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
