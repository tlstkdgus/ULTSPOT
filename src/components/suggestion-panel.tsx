"use client";

import { useState } from "react";
import { Badge, Button } from "@/components/ui";
import type { PreferenceProfile } from "@/lib/recommend/preference";
import { ClockIcon, CloseIcon, ExternalIcon, PinIcon, PlusIcon } from "@/components/icons";
import { useI18n } from "@/i18n/locale";
import { translateLib } from "@/i18n/messages";
import { fetchSuggestions, type RankedSuggestion, type SuggestionResult } from "@/lib/recommend/client";
import type { SuggestionKind } from "@/lib/recommend/nearby";
import type { Coord } from "@/lib/trip/geo";
import { cn } from "@/lib/cn";
import { hoursLabel } from "@/lib/recommend/hours-label";

const ALL_KINDS: SuggestionKind[] = ["meal", "cafe", "sightseeing"];

/**
 * 필수 방문지 주변의 식사·휴식·관광 제안.
 *
 * 지켜야 하는 것:
 *  - **자동 확정하지 않는다.** 사용자가 담기를 눌러야 일정 후보가 된다. 빼기·되돌리기도 준다.
 *  - 모든 후보는 **영업시간 미확인**이다. 카카오 장소 검색에 영업시간이 없다. "열려 있다"고 쓰지 않는다.
 *  - 아이돌 관련 근거가 있는 장소와 일반 주변 추천을 뱃지로 구분한다.
 *  - 취향 평가가 빠졌으면 그 사실과 사유를 보여준다. 거리순 기본 추천으로 계속 동작한다.
 */
export function SuggestionPanel({ anchor, anchorName, onAdd, profile }: {
  anchor: Coord | null;
  anchorName: string;
  onAdd: (suggestion: RankedSuggestion) => void;
  /** 일정 단계에서 고른 관심사·속도. 칩이 비면 문장도 비고 그때는 Jev를 부르지 않는다. */
  profile: PreferenceProfile;
}) {
  const { t } = useI18n();
  /**
   * 칩에서 만든 값을 기본으로 쓰고, 사용자가 손대면 그때부터 그 값을 쓴다.
   * effect로 state를 동기화하면 칩을 바꿀 때 사용자가 고쳐 쓴 문장을 덮거나 타이핑이 되돌아간다.
   * 그래서 "덮어쓴 값"만 state로 두고 나머지는 계산한다 (null = 칩을 따라간다).
   */
  const [preferenceOverride, setPreferenceOverride] = useState<string | null>(null);
  const [kindsOverride, setKindsOverride] = useState<SuggestionKind[] | null>(null);
  const preference = preferenceOverride ?? profile.sentence;
  const kinds = kindsOverride ?? (profile.kinds.length ? profile.kinds : ALL_KINDS);
  const setPreference = (value: string) => setPreferenceOverride(value);
  const setKinds = (update: (current: SuggestionKind[]) => SuggestionKind[]) => setKindsOverride(update(kinds));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [result, setResult] = useState<SuggestionResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(nextExcluded = excluded) {
    if (!anchor) return;
    setBusy(true);
    try {
      setResult(await fetchSuggestions({ anchor, kinds, preference, excluded: nextExcluded }));
    } finally {
      setBusy(false);
    }
  }

  function exclude(id: string) {
    const next = [...excluded, id];
    setExcluded(next);
    // 목록에서 바로 지우고, 자리를 메울 다음 후보를 다시 받아온다 (교체).
    setResult(current => current && { ...current, suggestions: current.suggestions.filter(s => s.id !== id) });
    void load(next);
  }

  const suggestions = result?.suggestions ?? [];

  return (
    <section aria-label={t.suggest.title} className="mt-5 rounded-xl border border-line-strong p-5">
      <h2 className="text-subhead">{t.suggest.title}</h2>
      <p className="mt-2 max-w-[62ch] text-body-sm text-text-muted">{t.suggest.intro}</p>

      {!anchor
        ? <p className="mt-4 text-body-sm text-warning">{t.suggest.noAnchor}</p>
        : <>
          <p className="mt-3 text-caption text-text-muted">{anchorName}</p>
          <label className="mt-4 block text-label">{t.suggest.preference}
            <input className="mt-2 block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-3 py-3 text-body"
              value={preference} maxLength={200} onChange={e => setPreference(e.target.value)}
              placeholder={t.suggest.preferencePlaceholder} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {ALL_KINDS.map(kind => <button key={kind} type="button" aria-pressed={kinds.includes(kind)}
              onClick={() => setKinds(current => current.includes(kind)
                ? (current.length > 1 ? current.filter(k => k !== kind) : current)
                : [...current, kind])}
              className={cn("min-h-11 rounded-full border px-4 text-label transition-colors",
                kinds.includes(kind) ? "border-text bg-surface-2" : "border-line-strong text-text-muted")}>
              {t.suggest.kinds[kind]}
            </button>)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="ghost" disabled={busy} onClick={() => load()}>{t.suggest.refresh}</Button>
            {busy && <span role="status" className="text-caption text-text-muted">{t.travel.lookingUp}</span>}
            {excluded.length > 0 && <>
              <span className="text-caption text-text-muted">{t.suggest.excluded(excluded.length)}</span>
              <Button size="sm" variant="ghost" onClick={() => { setExcluded([]); void load([]); }}>{t.suggest.restore}</Button>
            </>}
          </div>

          {result && !result.configured.places &&
            <p className="mt-4 text-body-sm text-warning">{t.suggest.notConfigured}</p>}
          {result?.ranking && <p className="mt-4 text-caption text-text-muted">
            {result.ranking.applied
              ? t.suggest.rankApplied(result.ranking.model ?? "")
              : `${t.suggest.rankFallback}${result.ranking.fallbackReason ? ` · ${translateLib(t, result.ranking.fallbackReason)}` : ""}`}
          </p>}
          {result && result.configured.places && !suggestions.length &&
            <p className="mt-4 text-body-sm text-text-muted">{t.suggest.none}</p>}

          {suggestions.length > 0 && <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {suggestions.map(suggestion => <li key={suggestion.id}
              className="flex min-w-0 flex-col rounded-lg border border-line-strong bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="closing">{t.suggest.kinds[suggestion.kind]}</Badge>
                {/* 근처에 있다는 사실이 아이돌과 관련 있다는 뜻이 아니다. 두 근거를 섞지 않는다. */}
                <span className="text-caption text-text-muted">
                  {suggestion.evidence === "idol" ? t.suggest.evidenceIdol : t.suggest.evidenceNearby}
                </span>
              </div>
              <p className="mt-2 text-label" lang="ko">{suggestion.name}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-text-muted">
                <span className="inline-flex items-center gap-1"><PinIcon />{t.suggest.distance(suggestion.straightMeters)}</span>
              </p>
              {/* 영업시간을 모른다는 사실을 숨기지 않는다. 아는 곳(TourAPI)은 출처와 함께 보여준다. */}
              {suggestion.hours
                ? <p className="mt-1 inline-flex flex-wrap items-center gap-1 text-caption text-text-muted">
                  <ClockIcon /><span className="text-text">{t.gap.hours(hoursLabel(suggestion.hours))}</span> · {t.gap.hoursSource(suggestion.hours.modified)}
                </p>
                : <p className="mt-1 inline-flex items-center gap-1 text-caption text-warning">
                  <ClockIcon />{t.suggest.hoursUnknown}
                </p>}
              {suggestion.address && <p className="mt-1 text-caption text-text-muted" lang="ko">{suggestion.address}</p>}
              <p className="mt-1 text-caption text-text-faint">{t.suggest.provider(suggestion.provider)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => onAdd(suggestion)}>
                  <PlusIcon />{t.suggest.add}<span className="sr-only"> {suggestion.name}</span>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => exclude(suggestion.id)}>
                  <CloseIcon />{t.suggest.exclude}<span className="sr-only"> {suggestion.name}</span>
                </Button>
                <a href={suggestion.placeUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 text-caption underline underline-offset-4">
                  {t.spots.maps} <ExternalIcon />
                </a>
              </div>
            </li>)}
          </ul>}
        </>}
    </section>
  );
}
