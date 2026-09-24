"use client";

import { useEffect, useRef, useState } from "react";
import { GOOGLE_MAPS_JS_KEY } from "@/components/google-map";
import type { PlacePhoto } from "@/lib/recommend/photo";
import { Badge, Button } from "@/components/ui";
import { ExternalIcon } from "@/components/icons";
import { TravelLeg } from "@/components/travel-leg";
import { PlacePhotoView } from "@/components/place-photo";
import { useI18n } from "@/i18n/locale";
import type { RankedSuggestion } from "@/lib/recommend/client";
import type { PreferenceProfile } from "@/lib/recommend/preference";
import { findGaps, type Gap } from "@/lib/trip/gap-fill";
import { fillChain, type FillOptions, type GapChain, type GapFillState } from "@/lib/trip/gap-fill-run";
export type { GapChain, GapFillState } from "@/lib/trip/gap-fill-run";
import { hoursLabel } from "@/lib/recommend/hours-label";
import { clock, type TripInput, type TripResult } from "@/lib/trip/planner";

/**
 * 확정 일정의 빈 시간에 주변 추천을 끼운다 (T-049).
 *
 * - 확정 일정(result)은 바꾸지 않는다. 추천은 별도 상태로 두고 화면에서만 사이에 끼워 보여준다.
 * - 이동시간 조회가 끝난 뒤(ready)에만 돈다. 여유 시간 기준 임시 일정으로 한 번, 조회 뒤 한 번 —
 *   두 번 부르지 않기 위해서다.
 * - 구간은 동시에 채우고(T-061), 한 가게를 두 구간이 고르지 않게 고르는 순간 선점한다.
 */
export function useGapFill({ result, input, profile, ready }: {
  result: TripResult | null;
  input: TripInput;
  profile: PreferenceProfile;
  ready: boolean;
}) {
  const gaps = ready ? findGaps(result, input, profile.kinds) : [];
  const options: FillOptions = { date: input.date, preference: profile.sentence, preferred: profile.kinds, mode: input.travelMode ?? "transit", transfer: input.transfer, stay: input.stay };
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
    // 구간을 동시에 채운다(T-061). 같은 가게를 두 구간이 고르지 않게 고르는 순간 선점한다.
    const used = new Set<string>();
    const claim = (id: string) => (used.has(id) ? false : (used.add(id), true));
    for (const gap of gaps)
      void fillChain(gap, [], skipped.current[gap.id] ?? [], options, controller.signal,
        items => { if (!controller.signal.aborted) put(key, gap.id, items); }, claim, () => [...used]);
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

  return <FilledSlot state={state} transfer={transfer} onAnother={onAnother} onRemove={onRemove} />;
}

/**
 * 관광공사 사진이 없는 추천에 Google 사진을 받아 온다 (T-052).
 * Google 지도가 떠 있을 때만 부른다(Places 약관: 비구글 지도와 함께 쓰기 금지). 받은 사진은 이 카드가
 * 떠 있는 동안만 들고 있고 저장하지 않는다.
 */
function useGooglePhoto(suggestion: RankedSuggestion): PlacePhoto | null {
  const [photo, setPhoto] = useState<{ id: string; photo: PlacePhoto | null } | null>(null);
  const wanted = !suggestion.photo && Boolean(GOOGLE_MAPS_JS_KEY);
  useEffect(() => {
    if (!wanted) return;
    const controller = new AbortController();
    void fetch("/api/place-photo", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ name: suggestion.name, coord: suggestion.coord }),
    }).then(r => r.ok ? r.json() as Promise<{ photo?: PlacePhoto | null }> : { photo: null })
      .then(body => setPhoto({ id: suggestion.id, photo: body.photo ?? null }))
      .catch(() => { /* 사진이 없어도 카드는 그대로다 */ });
    return () => controller.abort();
  }, [wanted, suggestion.id, suggestion.name, suggestion.coord]);
  return suggestion.photo ?? (photo?.id === suggestion.id ? photo.photo : null);
}

function FilledSlot({ state, transfer, onAnother, onRemove }: {
  state: Extract<GapFillState, { status: "filled" }>;
  transfer: number;
  onAnother: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const { suggestion, fit, legIn } = state;
  const photo = useGooglePhoto(suggestion);
  return <li>
    <TravelLeg estimate={legIn} bufferMinutes={transfer} />
    <article aria-label={t.gap.label(suggestion.name)} className="rounded-xl border border-dashed border-line-strong bg-bg-soft p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{t.gap.badge}</Badge>
        {suggestion.hours ? <Badge tone="ongoing">{t.gap.hours(hoursLabel(suggestion.hours))}</Badge> : <Badge>{t.gap.hoursUnknown}</Badge>}
        <span className="ml-auto font-mono text-label">{clock(fit.arrival)}–{clock(fit.departure)}</span>
      </div>
      {photo && <PlacePhotoView photo={photo} alt={suggestion.name} className="mt-4" />}
      <h2 className="mt-4 text-heading">{suggestion.name}</h2>
      <p className="mt-2 text-body-sm text-text-muted">
        {t.suggest.kinds[suggestion.kind]}{suggestion.category && <> · {suggestion.category}</>} · {t.suggest.distance(suggestion.straightMeters)}
      </p>
      {suggestion.hours && <p className="mt-3 text-caption text-text-muted">
        {t.gap.hoursSource(suggestion.hours.modified)}
        {suggestion.hours.note && <> · <span lang="ko">{t.gap.closedNote(suggestion.hours.note)}</span></>}
      </p>}
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
