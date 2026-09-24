"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ClockIcon, CloseIcon, ExternalIcon, PinIcon } from "@/components/icons";
import { TravelLeg } from "@/components/travel-leg";
import { useI18n } from "@/i18n/locale";
import { intlLocale } from "@/i18n/config";
import { translateLib } from "@/i18n/messages";
import { cn } from "@/lib/cn";
import { mapLinks } from "@/lib/trip/geo";
import { eventCopy, type DataLocale } from "@/lib/trip/event-copy";
import { clock } from "@/lib/trip/planner";
import {
  markVisited, moveVisit, removeVisit, resizeJourney, scheduleJourneyDay, unmarkVisited, updateVisit,
  type Journey, type ScheduledVisit, type Visit,
} from "@/lib/trip/journey";
import { SpendingPanel } from "@/components/spending-panel";
import { FootprintPanel } from "@/components/footprint-panel";
import { PlaceStatusPanel } from "@/components/place-status-panel";
import { daySummary, journeyLegs, legEstimate, travelLookup } from "@/lib/trip/journey-travel";
import { journeyPlaces, type ResolvedPlace } from "@/lib/trip/journey-places";
import { fetchTravelTable, type TravelLeg as LegToLookUp } from "@/lib/trip/travel-client";
import type { TravelEstimate, TravelMode, TravelTable } from "@/lib/trip/travel";
import { GapSlot, useGapFill, type GapChain, type GapFillState } from "@/components/gap-fill";
import { GOOGLE_MAPS_JS_KEY, GoogleMap } from "@/components/google-map";
import { KakaoMap } from "@/components/kakao-map";
import { preferenceProfile } from "@/lib/recommend/preference";
import { journeyDayForGaps } from "@/lib/trip/journey-gaps";

const STAY_OPTIONS = [30, 45, 60, 90, 120, 180];

/**
 * N박 N일 일정 화면.
 *
 * 무엇을 누가 정하는가:
 *  - 방문 순서·날짜·체류시간·고정 시각은 **사용자**가 정한다. 이 화면은 그걸 바꾸지 않는다.
 *  - 시각 계산과 충돌 판정은 `scheduleJourneyDay`가 한다. 여기서 다시 계산하지 않는다.
 *  - 이동시간은 카카오 경로 조회값만 쓴다. 조회하지 못한 구간은 시각을 확정하지 않고
 *    "이동시간 미확인"으로 남는다. 계획용 여유 시간으로 몰래 메우지 않는다.
 *
 * 지도는 핀만 찍는다. 방문지 사이에 직선을 그리면 실제 경로로 오해되므로 선을 그리지 않고,
 * 구간마다 카카오맵 길찾기 링크를 준다.
 */
export function JourneyPlanner({ journey, onChange, locale, notice }: {
  journey: Journey;
  onChange: (next: Journey) => void;
  locale: DataLocale;
  notice: (message: string) => void;
}) {
  const { locale: uiLocale, t } = useI18n();
  const [activeDate, setActiveDate] = useState(journey.days[0]?.date ?? journey.startDate);
  const [travelMode, setTravelMode] = useState<TravelMode>("transit");
  const [table, setTable] = useState<TravelTable>({});
  const [lookingUp, setLookingUp] = useState(false);
  const lookupId = useRef(0);

  // 날짜가 사라지면(기간 축소) 첫 날로 돌아간다. 없는 날짜를 계속 가리키지 않는다.
  const dates = journey.days.map(day => day.date);
  const current = dates.includes(activeDate) ? activeDate : dates[0];
  const day = journey.days.find(d => d.date === current);

  const places = useMemo(() => journeyPlaces(journey), [journey]);
  const byId = useMemo(() => new Map(places.map(place => [place.id, place])), [places]);

  /**
   * 조회할 구간. 체크인·지출·메모도 여정 객체를 바꾸지만 구간(같은 날 이웃한 두 곳)은 그대로다.
   * 객체 대신 구간 내용으로 조회를 걸어, 다녀왔어요를 누를 때마다 카카오 경로를 다시 부르지
   * 않게 한다(T-048 — 발자취 카드 검사가 그 요청을 잡아 프로덕션에서 간헐적으로 깨졌다).
   */
  const legsJson = useMemo(() => JSON.stringify(journeyLegs(journey)), [journey]);

  /** 이동시간 조회. 실패해도 편집과 저장은 계속 된다. 늦게 온 응답은 번호로 버린다. */
  const lookup = useCallback(async (legs: LegToLookUp[], mode: TravelMode, signal: AbortSignal) => {
    const id = ++lookupId.current;
    if (signal.aborted) return;
    if (!legs.length) { setTable({}); setLookingUp(false); return; }
    setLookingUp(true);
    try {
      const { table: next } = await fetchTravelTable(legs, mode, 45, signal);
      if (!signal.aborted && id === lookupId.current) setTable(next);
    } finally {
      if (!signal.aborted && id === lookupId.current) setLookingUp(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // 마이크로태스크로 미뤄 effect 본문에서 곧바로 setState하지 않는다 (연쇄 렌더 방지).
    // 조회는 네트워크 작업이라 한 틱 늦어도 사용자에게 차이가 없다.
    void Promise.resolve().then(() => lookup(JSON.parse(legsJson) as LegToLookUp[], travelMode, controller.signal));
    return () => controller.abort();
  }, [legsJson, travelMode, lookup]);

  const scheduled: ScheduledVisit[] = day
    ? scheduleJourneyDay(journey, current, travelLookup(table, travelMode))
    : [];
  const summary = day ? daySummary(journey, current, table, travelMode) : null;

  /**
   * 빈 시간 채우기(T-063). 당일 일정과 같은 채우기를 이 날에도 쓴다. 앞에서부터 시각이 확정된 방문까지만
   * 빈 시간을 잴 수 있다(journey-gaps.ts). 여정에는 관심사 칩이 없어 순서는 거리순이다.
   */
  const gapProfile = useMemo(() => preferenceProfile({ interests: [], stay: 60 }), []);
  const gapInput = day ? journeyDayForGaps(scheduled, id => byId.get(id)?.event ?? null, (from, to) => {
    const estimate = legEstimate(table, travelMode, from, to);
    return estimate?.status === "known" ? estimate.minutes : null;
  }, day, travelMode) : null;
  const gapFill = useGapFill({
    result: gapInput?.result ?? null,
    input: gapInput?.input ?? { date: current, start: 600, end: 1200, stay: 60, transfer: 45, travelMode },
    profile: gapProfile, ready: !!day && !lookingUp,
  });
  const lastFilled = (chain?: GapChain) =>
    [...(chain?.items ?? [])].reverse().find((i): i is Extract<GapFillState, { status: "filled" }> => i.status === "filled") ?? null;
  const renderChain = (chain?: GapChain) => chain?.items.map((state, index) => <GapSlot key={`${state.gap.id}:${index}`} state={state}
    transfer={day?.bufferMinutes ?? 45}
    onAnother={() => state.status === "filled" && gapFill.another(chain.root, index, state.suggestion.id)}
    onRemove={() => gapFill.remove(chain.root, index)} onAgain={() => gapFill.again(chain.root, index)} />);
  const chainById = (id: string) => gapFill.chains.find(chain => chain.root.id === id);

  /** 여정 변경은 journey.ts의 원자적 함수만 쓴다. 실패하면 원본이 그대로 남는다. */
  function apply(change: () => Journey) {
    try { onChange(change()); }
    catch (error) { notice(error instanceof Error ? translateLib(t, error.message) : String(error)); }
  }

  const label = (place: ResolvedPlace | undefined) =>
    place?.event ? eventCopy(place.event, locale).title : place?.title ?? "";
  const placeName = (placeId: string) => label(byId.get(placeId)) || placeId;

  /** 다녀온 날 기록. 같은 방문을 다시 누르면 기록을 지운다. */
  const visitedOn = new Map((journey.visited ?? []).map(record => [record.visitId, record.on]));
  const doneCount = (journey.visited ?? []).length;
  const plannedCount = journey.days.reduce((n, d) => n + d.visits.length, 0) + journey.unassigned.length;

  const dayName = (date: string) => t.journey.dayTab(dates.indexOf(date) + 1);
  const dateLabel = (date: string) => new Intl.DateTimeFormat(intlLocale[uiLocale], {
    month: "short", day: "numeric", weekday: "short", timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));

  const nights = Math.max(0, dates.length - 1);
  const pinned = day
    ? day.visits.map(visit => byId.get(visit.placeId)).filter((p): p is ResolvedPlace => !!p?.coord)
    : [];

  function renderVisitRow(item: ScheduledVisit, index: number, list: Visit[], via?: TravelEstimate | null) {
    const place = byId.get(item.visit.placeId);
    const previous = index > 0 ? byId.get(list[index - 1].placeId) : undefined;
    // 앞 빈 시간에 추천이 들어갔으면 이 방문까지의 이동은 추천 장소에서 출발한다(T-063).
    const estimate = via !== undefined ? via : previous && place ? legEstimate(table, travelMode, previous.id, place.id) : null;
    return (
      <li key={item.visit.id}>
        {index > 0 && <TravelLeg estimate={estimate} bufferMinutes={day?.bufferMinutes ?? 45} lookingUp={lookingUp} />}
        <article className="rounded-xl border border-line-strong bg-surface p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full border border-line-strong px-3 py-1 text-caption">{index + 1}</span>
            <span className="font-mono text-label">
              {item.arrival === null || item.departure === null
                // 시각을 만들지 않는다. 앞 구간이 미확인이면 이 방문도 미확정이다.
                ? <span className="text-warning">{t.journey.unknownTime}</span>
                : `${clock(item.arrival)}–${clock(item.departure)}`}
            </span>
          </div>

          <h3 className="mt-3 text-subhead">{label(place)}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
            {place?.source === "custom" && <Badge tone="accent">{t.journey.addCustom}</Badge>}
            {place?.source === "personal" && <Badge tone="accent">{t.status.personal}</Badge>}
            <span className="inline-flex items-center gap-1"><PinIcon />{place?.address}</span>
            {!place?.coord && <span className="text-warning">{t.journey.noCoord}</span>}
          </p>
          {place?.note && <p className="mt-2 text-body-sm text-text-muted">{place.note}</p>}

          {item.issues.length > 0 && <div className="mt-3 rounded-lg border border-warning/50 bg-surface-2 p-3">
            <p className="text-caption text-warning">{t.journey.conflicts}</p>
            <ul className="mt-1 space-y-1 text-caption text-text-muted">
              {item.issues.map(issue => <li key={issue}>{translateLib(t, issue)}</li>)}
            </ul>
          </div>}

          {/* 현장 기록. 계정이 없어도 동작하고, 날짜만 남긴다 (시각은 저장하지 않는다). */}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line-strong pt-3">
            <Button size="sm" variant={visitedOn.has(item.visit.id) ? "primary" : "ghost"}
              aria-pressed={visitedOn.has(item.visit.id)}
              aria-label={`${t.records.markVisited}: ${label(place)}`}
              onClick={() => apply(() => visitedOn.has(item.visit.id)
                ? unmarkVisited(journey, item.visit.id)
                : markVisited(journey, item.visit.id, current))}>
              <CheckIcon />{t.records.markVisited}
            </Button>
            {visitedOn.has(item.visit.id)
              ? <span className="text-caption text-text">{t.records.visitedOn(visitedOn.get(item.visit.id)!)}</span>
              : <span className="text-caption text-text-faint">{t.records.timeNote}</span>}
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-caption text-text-muted">{t.journey.stay}
              <select className="mt-1 block min-h-11 rounded-sm border border-line-strong bg-bg px-2 text-body-sm"
                value={item.visit.stay}
                onChange={e => apply(() => updateVisit(journey, item.visit.id, Number(e.target.value), item.visit.lockedAt))}>
                {STAY_OPTIONS.map(n => <option key={n} value={n}>{t.day.minutes(n)}</option>)}
              </select>
            </label>
            <label className="text-caption text-text-muted">{t.journey.lockLabel}
              <input type="time" className="mt-1 block min-h-11 rounded-sm border border-line-strong bg-bg px-2 text-body-sm"
                value={item.visit.lockedAt === undefined ? "" : clock(item.visit.lockedAt)}
                onChange={e => {
                  const value = e.target.value;
                  const minutes = /^\d{2}:\d{2}$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : undefined;
                  apply(() => updateVisit(journey, item.visit.id, item.visit.stay, minutes));
                }} />
            </label>
            {item.visit.lockedAt !== undefined && <Button size="sm" variant="ghost"
              onClick={() => apply(() => updateVisit(journey, item.visit.id, item.visit.stay))}>{t.journey.lockClear}</Button>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-line-strong pt-3">
            <Button size="sm" variant="ghost" disabled={index === 0}
              onClick={() => apply(() => moveVisit(journey, item.visit.id, current, index - 1))}>
              <ArrowLeftIcon />{t.journey.moveUp}
            </Button>
            <Button size="sm" variant="ghost" disabled={index === list.length - 1}
              onClick={() => apply(() => moveVisit(journey, item.visit.id, current, index + 1))}>
              {t.journey.moveDown}<ArrowRightIcon />
            </Button>
            {dates.filter(date => date !== current).map(date => <Button key={date} size="sm" variant="ghost"
              onClick={() => apply(() => moveVisit(journey, item.visit.id, date, 0))}>
              {t.journey.moveToDay(dayName(date))}
            </Button>)}
            <Button size="sm" variant="ghost" onClick={() => apply(() => moveVisit(journey, item.visit.id, null, 0))}>
              {t.journey.unassign}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => apply(() => removeVisit(journey, item.visit.id))}>
              <CloseIcon />{t.journey.remove}
            </Button>
            {place && <a href={place.coord ? mapLinks.place({ id: place.id, name: label(place), coord: place.coord }) : mapLinks.search(place.address)}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1 text-caption underline underline-offset-4">
              {t.journey.openInMap}<ExternalIcon />
            </a>}
          </div>
        </article>
      </li>
    );
  }

  return (
    <section aria-label={t.steps.labels[3]} className="grid items-start gap-6 lg:grid-cols-3">
      <aside className="rounded-device border border-line-strong bg-surface p-5 lg:col-span-1 sm:p-6">
        <fieldset>
          <legend className="text-subhead">{t.journey.rangeLegend}</legend>
          <p className="mt-2 text-caption text-text-muted">{t.journey.length(nights, dates.length)}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="min-w-0 text-caption text-text-muted">{t.journey.from}
              <input type="date" value={journey.startDate}
                className="mt-1 block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-2 py-2 text-body-sm"
                onChange={e => apply(() => resizeJourney(journey, e.target.value, journey.endDate))} />
            </label>
            <label className="min-w-0 text-caption text-text-muted">{t.journey.to}
              <input type="date" value={journey.endDate}
                className="mt-1 block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-2 py-2 text-body-sm"
                onChange={e => apply(() => resizeJourney(journey, journey.startDate, e.target.value))} />
            </label>
          </div>
        </fieldset>

        <fieldset className="mt-5 border-t border-line-strong pt-4">
          <legend className="text-caption text-text-muted">{t.travel.modeLabel}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["transit", "walk"] as const).map(mode => <button key={mode} type="button" aria-pressed={travelMode === mode}
              onClick={() => setTravelMode(mode)}
              className={cn("min-h-11 rounded-full border px-4 text-label transition-colors",
                travelMode === mode ? "border-text bg-surface-2" : "border-line-strong text-text-muted")}>
              {mode === "transit" ? t.travel.transit : t.travel.walk}
            </button>)}
          </div>
        </fieldset>

        {/* 기간을 줄이면 방문이 여기로 온다. 조용히 지우지 않는다. */}
        <div className="mt-5 border-t border-line-strong pt-4">
          <h2 className="text-label">{t.journey.unassigned} <span className="text-text-muted">{journey.unassigned.length}</span></h2>
          <p className="mt-1 text-caption text-text-muted">{t.journey.unassignedHint}</p>
          {journey.unassigned.length > 0 && <ul className="mt-3 space-y-2">
            {journey.unassigned.map(visit => {
              const place = byId.get(visit.placeId);
              return <li key={visit.id} className="rounded-lg border border-dashed border-line-strong p-3">
                <p className="text-body-sm">{label(place)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dates.map(date => <Button key={date} size="sm" variant="ghost"
                    onClick={() => apply(() => moveVisit(journey, visit.id, date, journey.days.find(d => d.date === date)!.visits.length))}>
                    {t.journey.addToDay(dayName(date))}
                  </Button>)}
                  <Button size="sm" variant="ghost" onClick={() => apply(() => removeVisit(journey, visit.id))}>
                    {t.journey.remove}
                  </Button>
                </div>
              </li>;
            })}
          </ul>}
        </div>
      </aside>

      <div className="lg:col-span-2">
        <nav aria-label={t.steps.nav} className="flex flex-wrap gap-2">
          {dates.map((date, index) => <button key={date} type="button" aria-current={date === current ? "page" : undefined}
            onClick={() => setActiveDate(date)}
            className={cn("min-h-11 rounded-full border px-4 text-label transition-colors",
              date === current ? "border-text bg-surface-2" : "border-line-strong text-text-muted")}>
            {t.journey.dayTab(index + 1)} <span className="text-text-faint">{dateLabel(date)}</span>
          </button>)}
        </nav>

        {day && <>
          <p role="status" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-muted">
            <span className="text-text">{t.journey.dayOf(dates.indexOf(current) + 1, dateLabel(current))}</span>
            <span>{clock(day.start)}–{clock(day.end)}</span>
            {lookingUp && <span>{t.travel.lookingUp}</span>}
            {!lookingUp && summary && summary.legs > 0 && <>
              {summary.known > 0 && <span>{t.journey.summaryKnown(summary.known)}</span>}
              {summary.unconfirmed > 0 && <span className="text-warning">{t.journey.summaryUnconfirmed(summary.unconfirmed)}</span>}
              {summary.missingCoord > 0 && <span className="text-warning">{t.journey.summaryNoCoord(summary.missingCoord)}</span>}
            </>}
            {plannedCount > 0 && <span className="text-text">{t.records.progress(doneCount, plannedCount)}</span>}
          </p>

          {/* 지도는 핀만. 직선을 경로로 보이게 하지 않는다. */}
          <section aria-label={t.journey.mapTitle} className="mt-4 rounded-xl border border-line-strong p-4">
            <h2 className="text-label">{t.journey.mapTitle}</h2>
            <p className="mt-1 text-caption text-text-muted">{t.journey.mapNote}</p>
            {(() => {
              // 이 날의 지도(T-063). 확정 방문은 번호, 빈 시간 추천은 주황. 키가 있으면 Google, 없으면 카카오.
              const points = [
                ...pinned.map(place => ({ name: label(place), coord: place.coord! })),
                ...gapFill.chains.flatMap(chain => chain.items).flatMap(f => f.status === "filled" ? [{ name: f.suggestion.name, coord: f.suggestion.coord, tentative: true }] : []),
              ];
              const mapClass = "mt-3 h-56 w-full overflow-hidden rounded-lg border border-line-strong";
              return GOOGLE_MAPS_JS_KEY
                ? <GoogleMap className={mapClass} points={points} language={uiLocale === "zh" ? "zh-CN" : uiLocale} label={t.result.mapLabel} />
                : <KakaoMap className={mapClass} points={points} />;
            })()}
            {pinned.length > 0 ? <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {pinned.map((place, index) => <li key={place.id} className="flex min-w-0 items-center gap-2 text-caption">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-text text-bg">{index + 1}</span>
                <a href={mapLinks.place({ id: place.id, name: label(place), coord: place.coord })}
                  target="_blank" rel="noopener noreferrer" className="min-w-0 truncate underline underline-offset-4">
                  {label(place)}
                </a>
              </li>)}
            </ol> : <p className="mt-3 text-caption text-warning">{t.journey.noCoord}</p>}
          </section>

          {day.visits.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-line-strong p-8 text-center">
            <p className="text-subhead">{t.journey.empty}</p>
            <p className="mt-2 text-body-sm text-text-muted">{t.journey.emptyNext}</p>
          </div> : <ol className="mt-4 space-y-4">
            {scheduled.map((item, index) => {
              const id = item.visit.placeId;
              const before = index === 0 ? chainById(`before>${id}`) : chainById(`${day.visits[index - 1].placeId}>${id}`);
              const via = lastFilled(before);
              const after = gapFill.chains.find(chain => chain.root.id === `${id}>after`);
              return <Fragment key={item.visit.id}>
                {index === 0 && renderChain(before)}
                {renderVisitRow(item, index, day.visits, via ? via.legOut : undefined)}
                {index === scheduled.length - 1 && renderChain(after)}
                {index < scheduled.length - 1 && renderChain(chainById(`${id}>${day.visits[index + 1].placeId}`))}
              </Fragment>;
            })}
          </ol>}

          <SpendingPanel journey={journey} onChange={onChange} activeDate={current}
            placeName={placeName} notice={notice} />

          <FootprintPanel journey={journey} locale={locale} notice={notice} />

          {/* 이 화면에서 유일하게 서버로 나가는 부분. 게스트 동의 전에는 아무 요청도 없다. */}
          <PlaceStatusPanel placeIds={day.visits.map(v => v.placeId)} placeName={placeName} notice={notice} />

          <p className="mt-4 flex items-center gap-2 text-caption text-text-muted">
            <ClockIcon />{t.footer(day.bufferMinutes)}
          </p>
        </>}
      </div>
    </section>
  );
}
