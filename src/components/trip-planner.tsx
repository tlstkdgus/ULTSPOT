"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand";
import { Badge, Button } from "@/components/ui";
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon, CheckIcon, CloseIcon, ExternalIcon, FastIcon, SlowIcon } from "@/components/icons";
import { LanguageToggle } from "@/components/language-toggle";
import { SpotCard } from "@/components/spot-card";
import { clock, eventPoint, minutes, planTrip, runsOn, unavailableReason, validateTrip, type FanEvent, type TripInput } from "@/lib/trip/planner";
import { catalog } from "@/lib/trip/catalog";
import { fetchTravelTable, planningLegs } from "@/lib/trip/travel-client";
import { FavoriteStep } from "@/components/favorite-step";
import { categoryCounts, filterCategories, matchesCategory, type FilterCategory } from "@/lib/trip/categories";
import { preferenceProfile } from "@/lib/recommend/preference";
import { JourneyPlanner } from "@/components/journey-planner";
import {
  addVisit, createJourney, journeyStorageKey, loadJourneyLocally, saveJourneyLocally, type Journey,
} from "@/lib/trip/journey";
import { hasUnconfirmedTravel, travelMinutes, type TravelMode, type TravelTable } from "@/lib/trip/travel";
import { TravelLeg } from "@/components/travel-leg";
import { SuggestionPanel } from "@/components/suggestion-panel";
import { GapSlot, useGapFill, type GapChain, type GapFillState } from "@/components/gap-fill";
import { KakaoMap } from "@/components/kakao-map";
import { GOOGLE_MAPS_JS_KEY, GoogleMap } from "@/components/google-map";
import type { RankedSuggestion } from "@/lib/recommend/client";
import { PersonalEventForm } from "@/components/personal-event-form";
import { parseSavedTrip, storageKey, type SavedTrip } from "@/lib/trip/storage";
import { cloudEnabled, cloudTrip } from "@/lib/trip/cloud";
import { artists, matchesArtists } from "@/lib/trip/artists";
import { buildCalendar } from "@/lib/calendar";
import { eventCopy, type DataLocale } from "@/lib/trip/event-copy";
import { intlLocale } from "@/i18n/config";
import { useI18n } from "@/i18n/locale";
import { translateLib } from "@/i18n/messages";
import { cn } from "@/lib/cn";

const inputClass = "mt-2 block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-3 py-3 text-body";

function saveFile(text: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TripPlanner({ today }: { today: string }) {
  const { locale, t } = useI18n();
  // 장소 데이터에는 한국어와 영어만 있다. 그 외 언어에서는 영어 원문을 보여준다.
  // T-027에서 장소 데이터가 ja·zh까지 늘었다. 화면 언어를 그대로 넘기고 eventCopy가 초안 번역을 걸러낸다.
  const dataLocale: DataLocale = locale;
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [step]);
  const [date, setDate] = useState(today);
  const [start, setStart] = useState("11:00");
  const [end, setEnd] = useState("18:00");
  const [stay, setStay] = useState(60);
  const [transfer, setTransfer] = useState(45);
  const [personal, setPersonal] = useState<FanEvent[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  // 팬이 그 행사 때문에 여행을 가는 것이므로, 필수 방문은 방문 수보다 먼저 지킨다.
  const [required, setRequired] = useState<string[]>([]);
  const [travelMode, setTravelMode] = useState<TravelMode>("transit");
  const [artistIds, setArtistIds] = useState<string[]>([]);
  const [category, setCategory] = useState<FilterCategory | null>(null);
  /** 관심사 칩. 추천 순서에만 쓰고 운영시간·예약·이동시간 판정에는 쓰지 않는다. */
  const [interests, setInterests] = useState<string[]>([]);
  /** 마지막날. 시작날과 같으면 당일이고, 다르면 다일 일정 화면으로 간다. */
  const [endDate, setEndDate] = useState("");
  /** 다일 일정. null이면 아직 만들지 않았다. */
  const [journey, setJourney] = useState<Journey | null>(null);
  const [result, setResult] = useState<ReturnType<typeof planTrip> | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [openForm, setOpenForm] = useState(0);
  /**
   * 조회 요청 번호. 날짜·선택·이동수단을 바꾸면 늘어난다.
   * 늦게 도착한 이전 응답이 최신 결과를 덮지 않도록 응답마다 번호를 대조한다.
   */
  const lookupId = useRef(0);
  const input: TripInput = { date, start: minutes(start), end: minutes(end), stay, transfer, travelMode,
    requiredIds: required.filter(id => selected.includes(id)) };
  const validation = validateTrip(input);
  const events = [...catalog, ...personal];
  /**
   * 탐색 후보. 날짜를 정하기 전(2단계)에는 날짜로 걸러내지 않는다 — 기간을 정한 뒤 다시 검사한다.
   * 검색은 표시 언어의 문구까지 본다. 한국어로 쳤을 때 영어 원문만 보고 놓치지 않게 한다.
   */
  const candidates = events.filter(event => {
    if (!matchesArtists(event.artistIds, artistIds, event.category === 'birthdayCafe')) return false;
    if (!matchesCategory(event, category)) return false;
    if (step > 1 && !runsOn(event, date)) return false;
    if (!query.trim()) return true;
    const copy = eventCopy(event, dataLocale);
    const haystack = `${event.title} ${event.area} ${event.kind} ${copy.title} ${copy.area}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  const counts = categoryCounts(events.filter(e => matchesArtists(e.artistIds, artistIds, e.category === 'birthdayCafe')));
  /**
   * 관심사 칩 + 속도 → 추천 입력. 추천 순서와 주변 후보 종류에만 쓴다.
   * planTrip과 unavailableReason은 이 값을 받지 않는다 (구조로 보장).
   */
  const profile = preferenceProfile({ interests, stay });
  /** 밤 수. 날짜가 올바르지 않으면 0이고 당일로 취급한다. */
  const nightCount = endDate && endDate > date && !Number.isNaN(Date.parse(endDate)) && !Number.isNaN(Date.parse(date))
    ? Math.round((Date.parse(endDate) - Date.parse(date)) / 86_400_000) : 0;
  /** 결과를 버리고 진행 중인 조회 응답도 무효로 만든다. 알림은 건드리지 않는다. */
  function discardResult() { lookupId.current += 1; setResult(null); setLookingUp(false); }
  function invalidate() { discardResult(); setNotice(""); }
  function snapshot(): SavedTrip { return { version: 1, input, selected, personal, artistIds }; }

  /**
   * 구간별 이동시간을 조회한 뒤 일정을 계산한다.
   *
   * 조회가 실패하거나 키가 없어도 멈추지 않는다. 그 구간은 미확인으로 남고 계획용 여유 시간으로
   * 계산되며, 화면이 두 상태를 구분해 보여준다. 늦게 온 응답은 번호가 다르면 버린다.
   */
  async function plan(chosen: FanEvent[], tripInput: TripInput) {
    const id = ++lookupId.current;
    // 조회를 기다리는 동안에도 볼 수 있게, 먼저 여유 시간 기준 일정을 보여준다.
    setResult(planTrip(chosen, tripInput));
    if (!chosen.length) return;
    setLookingUp(true);
    try {
      const legs = planningLegs(chosen, tripInput);
      const { table } = await fetchTravelTable(legs, tripInput.travelMode ?? "transit", tripInput.transfer);
      if (id !== lookupId.current) return; // 그 사이 입력이 바뀌었다. 예전 답을 쓰지 않는다.
      setResult(planTrip(chosen, tripInput, table as TravelTable));
    } finally {
      if (id === lookupId.current) setLookingUp(false);
    }
  }

  function restore(saved: SavedTrip) {
    setDate(saved.input.date); setStart(clock(saved.input.start)); setEnd(clock(saved.input.end));
    setStay(saved.input.stay); setTransfer(saved.input.transfer); setPersonal(saved.personal);
    setSelected(saved.selected); setQuery("");
    setRequired(saved.input.requiredIds ?? []);
    setTravelMode(saved.input.travelMode ?? "transit");
    setArtistIds(saved.artistIds ?? []);
    // 과거 경로를 최신 조회값처럼 보여주지 않는다. 복원할 때 다시 조회한다.
    void plan([...catalog, ...saved.personal].filter(e => saved.selected.includes(e.id)), saved.input);
    setStep(3);
  }
  /**
   * 기기 저장. 다일 여정이면 journey v2로, 당일이면 기존 v1로 저장한다.
   *
   * 불러오기는 v2를 먼저 보고 없으면 v1을 읽는다(`loadJourneyLocally`가 v1→v2 변환을 한다).
   * 당일 저장본을 여정으로 강제 변환하지 않는다 — 기존 당일 화면이 계속 동작해야 한다.
   */
  function device(action: "save" | "load" | "delete") {
    try {
      if (action === "save") {
        if (journey) { saveJourneyLocally(localStorage, journey); setNotice(t.journey.saved); return; }
        if (validation) { setNotice(translateLib(t, validation)); return; }
        localStorage.setItem(storageKey, JSON.stringify(snapshot()));
        setNotice(t.notices.saved);
      } else if (action === "load") {
        const savedJourney = localStorage.getItem(journeyStorageKey) ? loadJourneyLocally(localStorage) : null;
        if (savedJourney && savedJourney.days.length > 1) {
          // 다일 여정 복원. 이동시간은 JourneyPlanner가 다시 조회한다.
          setJourney(savedJourney);
          setPersonal(savedJourney.personal);
          setArtistIds(savedJourney.artistIds);
          setDate(savedJourney.startDate);
          setEndDate(savedJourney.endDate);
          setResult(null);
          setStep(3);
          setNotice(t.journey.restored);
          return;
        }
        const raw = localStorage.getItem(storageKey);
        if (!raw) { setNotice(t.notices.noDraft); return; }
        const saved = parseSavedTrip(JSON.parse(raw));
        if (!saved) { setNotice(t.notices.unreadable); return; }
        setJourney(null);
        restore(saved); setNotice(t.notices.restored);
      } else {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(journeyStorageKey);
        setNotice(t.notices.deleted);
      }
    } catch (error) {
      // 저장본 형식 오류는 이유를 알려 준다. 그 밖에는 저장소를 쓸 수 없는 경우다.
      setNotice(error instanceof Error && error.message ? translateLib(t, error.message) : t.notices.storageUnavailable);
    }
  }
  async function cloud(action: "save" | "load" | "delete") {
    if (action === "save" && validation) { setNotice(translateLib(t, validation)); return; }
    setBusy(true);
    try {
      const saved = await cloudTrip(action, action === "save" ? snapshot() : undefined);
      if (action === "load" && saved) restore(saved);
      setNotice(action === "save" ? t.notices.cloudSaved : action === "delete" ? t.notices.cloudDeleted : saved ? t.notices.cloudRestored : t.notices.cloudNone);
    } catch (e) { setNotice(e instanceof Error ? translateLib(t, e.message) : t.notices.cloudUnavailable); }
    finally { setBusy(false); }
  }
  /**
   * 일정 만들기.
   *
   * 마지막날을 비웠거나 첫날과 같으면 당일 일정(planTrip)으로 간다. 기존에 검증된 경로다.
   * 다르면 N박 N일 여정을 만든다. 담은 곳을 첫날에 고른 순서대로 넣고, 그 뒤로는 사용자가
   * Day 탭에서 날짜·순서·시각을 정한다. **자동으로 날짜를 흩뿌리지 않는다** — 어떤 날에
   * 무엇을 넣을지는 운영시간만으로 정할 수 없고, 잘못 흩뿌리면 사용자가 되돌리기 더 어렵다.
   */
  function generate() {
    if (validation || !selected.length) return;
    setNotice("");
    setStep(3);
    const last = endDate && endDate > date ? endDate : date;
    if (last === date) {
      setJourney(null);
      void plan(events.filter(e => selected.includes(e.id)), input);
      return;
    }
    try {
      let next = createJourney(date, last);
      next.personal = personal;
      next.artistIds = artistIds;
      selected.forEach((placeId, index) => {
        next = addVisit(next, { id: `v-${placeId}-${index}`, placeId, stay }, date);
      });
      setJourney(next);
      setResult(null);
    } catch (error) {
      setNotice(error instanceof Error ? translateLib(t, error.message) : String(error));
    }
  }
  function changeDate(value: string) {
    setDate(value);
    /**
     * 담은 곳을 지우지 않는다.
     *
     * T-008에서는 날짜가 1단계였기 때문에 날짜가 바뀌면 선택을 비웠다. T-029에서 날짜가 장소
     * 뒤로 내려가면서 그 규칙이 반대로 동작했다 — 담은 뒤 날짜를 처음 넣는 순간 선택이 전부
     * 사라졌다. 이제는 그날 열지 않는 곳을 **다시 검사해서 알려주고**, 일정 결과의 "넣지 못한 곳"에
     * 사유를 남긴다. 사용자가 고른 것을 조용히 버리지 않는다.
     */
    const blocked = selected.filter(id => {
      const event = events.find(e => e.id === id);
      return event ? !!unavailableReason(event, value) : false;
    });
    setNotice(blocked.length ? t.notices.dateRechecked(blocked.length) : "");
    // 위에서 세운 안내를 지우지 않으려고 invalidate()를 쓰지 않는다.
    discardResult();
  }
  function toggleSelected(id: string) {
    setSelected(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
    // 목록에서 뺀 곳은 필수 방문에서도 빠진다. 없는 곳을 필수로 두지 않는다.
    setRequired(ids => ids.filter(x => x !== id));
    invalidate();
  }
  /**
   * 추천 후보를 개인 장소로 담는다. 영업시간이 미확인이면 자동 편성 대상이 아니다.
   * TourAPI로 영업시간을 아는 곳은 그 시간·요일 휴무로 편성한다(T-050). 준비시간이 있는 곳은 편성기가
   * 준비시간을 모르므로 시간을 넘기지 않는다 — 그 사이에 도착하는 일정을 만들 수 있기 때문이다.
   */
  function addSuggestion(suggestion: RankedSuggestion) {
    const id = `personal-${suggestion.id}`;
    discardResult();
    if (personal.some(p => p.id === id)) { setNotice(t.event.added); return; }
    setPersonal(items => [...items, {
      id, title: suggestion.name, area: suggestion.category || t.suggest.kinds[suggestion.kind],
      kind: "Personal event", address: suggestion.address || suggestion.name,
      from: date, to: date,
      ...(suggestion.hours && !suggestion.hours.breaks.length
        ? { opens: suggestion.hours.opens, closes: suggestion.hours.closes, closedDays: suggestion.hours.closedDays }
        : { opens: null, closes: null, closedDays: [] }),
      reservation: false,
      do: suggestion.hours ? t.gap.hoursSource(suggestion.hours.modified) : t.suggest.hoursUnknown,
      get: t.suggest.provider(suggestion.provider),
      provenance: { mode: "personal", author: suggestion.provider, checkedOn: date, url: suggestion.placeUrl },
    }]);
    setNotice(t.event.added);
  }
  function askForEvent() { setStep(1); setOpenForm(value => value + 1); }
  function download() {
    if (!result?.stops.length) return;
    const text = [t.file.header(date), t.file.disclaimer(transfer),
      // 파일 안 문구도 화면 언어를 따른다. 주소·출처는 데이터 원문이라 그대로 둔다.
      ...result.stops.map(s => { const c = eventCopy(s.event, dataLocale); return `${clock(s.arrival)}–${clock(s.departure)} ${c.title}\n${s.event.address}\n${t.spots.doLabel}: ${c.do}\n${t.spots.getLabel}: ${c.get}\n${t.spots.source(s.event.provenance.author, s.event.provenance.checkedOn)} ${s.event.provenance.url}`; }),
      ...result.omitted.map(o => t.file.notScheduled(eventCopy(o.event, dataLocale).title, translateLib(t, o.reason)))].join("\n\n");
    saveFile(text, "text/plain;charset=utf-8", `ultspot-${date}.txt`);
    setNotice(t.result.downloaded);
  }
  function addToCalendar() {
    if (!result?.stops.length) return;
    const ics = buildCalendar(result.stops.map(stop => ({
      uid: `${stop.event.id}-${date}@ultspot.vercel.app`, date, start: stop.arrival, end: stop.departure,
      title: eventCopy(stop.event, dataLocale).title, location: stop.event.address,
      description: `${eventCopy(stop.event, dataLocale).do}\n${stop.event.provenance.url}\n${t.file.calendarNote}`,
    })));
    saveFile(ics, "text/calendar;charset=utf-8", `ultspot-${date}.ics`);
    setNotice(t.result.calendarDone);
  }
  const dayLabel = date && !Number.isNaN(Date.parse(date))
    ? new Intl.DateTimeFormat(intlLocale[locale], { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
    : "—";
  const artistNames = artists.filter(a => artistIds.includes(a.id)).map(a => (locale === "ko" ? a.korean || a.name : a.name)).join(" + ");
  const hasArtistSpots = candidates.some(e => e.artistIds?.length);
  // 한국어 원문이 있으면 lang을 붙이지 않는다. 개인 행사는 사용자가 쓴 글이라 언어를 단정하지 않는다.
  const stopLang = (event: FanEvent, korean?: string) =>
    (event.provenance.mode === "personal" || (locale === "ko" && korean) ? undefined : "en");
  const lastStop = result?.stops.at(-1);
  // 첫 구간(travelEstimate === null)은 출발 위치를 넣지 않아 세지 않은 것이므로 미확인에 넣지 않는다.
  const unconfirmedLegs = result
    ? hasUnconfirmedTravel(result.stops.slice(1).map(s => s.travelEstimate))
      ? result.stops.slice(1).filter(s => s.travelEstimate?.status !== "known").length : 0
    : 0;
  /**
   * 주변 추천의 기준 좌표. 필수 방문지가 있으면 그곳, 없으면 일정의 첫 장소.
   * 좌표가 검수되지 않은 장소는 기준이 될 수 없다 (패널이 그 사실을 알린다).
   */
  const anchorPoint = (() => {
    const ordered = result?.stops.map(s => s.event) ?? [];
    const requiredFirst = ordered.find(e => required.includes(e.id)) ?? ordered[0];
    if (!requiredFirst) return null;
    const point = eventPoint(requiredFirst);
    return point.coord ? point : null;
  })();
  /**
   * 빈 시간 추천 (T-049). 이동시간 조회가 끝난 뒤에만 채운다. 확정 일정(result)은 바꾸지 않고,
   * 화면에서 정류장 사이에 끼워 보여준다. 캘린더·txt 내보내기에는 넣지 않는다.
   */
  const gapFill = useGapFill({ result, input, profile, ready: step === 3 && !journey && !!result && !result.error && !lookingUp });
  const chainAfter = (stopId: string) => gapFill.chains.find(c => c.root.id.startsWith(`${stopId}>`));
  const chainBefore = (stopId: string, index: number) => gapFill.chains.find(c =>
    c.root.id === (index === 0 ? `before>${stopId}` : `${result?.stops[index - 1]?.event.id}>${stopId}`));
  /** 구간에서 마지막으로 들른 추천 장소. 다음 정류장(또는 하루의 끝)은 여기서 출발한다. */
  const lastFilled = (chain?: GapChain) =>
    [...(chain?.items ?? [])].reverse().find((i): i is Extract<GapFillState, { status: "filled" }> => i.status === "filled") ?? null;
  const renderChain = (chain?: GapChain) => chain?.items.map((state, index) => <GapSlot key={`${state.gap.id}:${index}`} state={state} transfer={transfer}
    onAnother={() => state.status === "filled" && gapFill.another(chain.root, index, state.suggestion.id)}
    onRemove={() => gapFill.remove(chain.root, index)} onAgain={() => gapFill.again(chain.root, index)} />);
  const tailFill = lastStop ? lastFilled(gapFill.chains.find(c => c.root.id === `${lastStop.event.id}>after`)) : null;
  /** 하루가 실제로 끝나는 시각. 마지막 빈 시간에 추천이 들어가면 그곳을 떠나는 시각이다. */
  const dayEnd = tailFill ? tailFill.fit.departure : lastStop?.departure ?? 0;
  const freeAfter = lastStop ? input.end - dayEnd - (tailFill?.legOut ? travelMinutes(tailFill.legOut, transfer) : 0) : 0;

  return <main className="shell pb-16">
    <header className="flex items-center justify-between gap-4 border-b border-line py-4">
      {/* 글자 높이(25px)가 그대로 탭 영역이 되던 자리 — 페이지에서 유일하게 44px에 못 미쳤다. */}
      <Link href="/" aria-label={t.steps.home} className="inline-flex min-h-11 items-center"><Wordmark /></Link>
      <LanguageToggle />
    </header>

    {/* 단계가 4개인데 격자는 3칸이라 "일정 받기"만 아랫줄로 떨어지고 밑줄이 끊겨 보였다.
        390px에서 4칸은 한 칸이 90px도 안 돼 라벨이 접히므로 모바일은 2×2로 둔다. */}
    <nav aria-label={t.steps.nav} className="my-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-6">
      {t.steps.labels.map((label, index) => <button key={label} type="button" aria-current={step === index ? "step" : undefined}
        disabled={busy || (index === 3 && !result)} onClick={() => setStep(index)}
        className={cn("flex min-h-11 items-center gap-2 border-b-2 pb-3 text-left text-label transition-colors disabled:cursor-not-allowed disabled:text-text-faint",
          step === index ? "border-text text-text" : "border-line-strong text-text-muted")}>
        <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-caption",
          step === index ? "bg-text text-bg" : "bg-surface")}>{index + 1}</span>{label}
      </button>)}
    </nav>

    <div className="mb-6">
      <h1 ref={heading} tabIndex={-1} className="text-display outline-none">{t.titles[step]}</h1>
      <p className="mt-3 max-w-[46ch] text-body text-text-muted">{t.subtitles[step]}</p>
      {step > 1 && <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-text-muted">
        <span className="rounded-full border border-line-strong px-3 py-1.5 text-text">{dayLabel}</span>
        <span>{start}–{end}</span>
        <span>{t.result.stayEach(stay)}</span>
        <span>{t.day.bufferSummary(transfer)}</span>
      </p>}
      {step === 1 && artistIds.length > 0 && <p className="mt-4 text-caption text-text-muted">
        {t.favorite.picked(artistNames)}
      </p>}
    </div>

    {step === 0 && <FavoriteStep selected={artistIds} onNext={() => setStep(1)} onChange={ids => {
      setArtistIds(ids);
      setSelected(current => current.filter(id => events.some(e => e.id === id && matchesArtists(e.artistIds, ids, e.category === 'birthdayCafe'))));
      setRequired(current => current.filter(id => events.some(e => e.id === id && matchesArtists(e.artistIds, ids, e.category === 'birthdayCafe'))));
      invalidate();
    }} />}

    {step === 2 && <section aria-label={t.steps.labels[2]} className="grid gap-6 lg:grid-cols-2 lg:gap-10">
      <div className="min-w-0 rounded-device border border-line-strong bg-surface p-6 sm:p-8">
        <label className="block text-subhead">{t.day.dateQuestion}<span className="sr-only"> {t.day.dateLabel}</span>
          <input className={`${inputClass} mt-4`} type="date" value={date} onChange={e => changeDate(e.target.value)} />
        </label>
        {/* 마지막날. 비우거나 첫날과 같으면 당일 일정이다. */}
        <label className="mt-4 block text-label">{t.journey.to}
          <input className={inputClass} type="date" value={endDate} min={date}
            onChange={e => { setEndDate(e.target.value); invalidate(); }} />
        </label>
        {endDate && endDate > date && <p className="mt-2 text-caption text-text-muted">
          {t.journey.length(nightCount, nightCount + 1)}
        </p>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="min-w-0 text-label">{t.day.start}<input className={inputClass} type="time" value={start} onChange={e => { setStart(e.target.value); invalidate(); }} /></label>
          <label className="min-w-0 text-label">{t.day.end}<input className={inputClass} type="time" value={end} onChange={e => { setEnd(e.target.value); invalidate(); }} /></label>
        </div>
        <fieldset className="mt-6"><legend className="text-subhead">{t.day.tempo}</legend><div className="mt-3 grid grid-cols-2 gap-3">
          {t.day.paces.map((pace, index) => <button key={pace.value} type="button" aria-pressed={stay === pace.value} onClick={() => { setStay(pace.value); invalidate(); }}
            className={cn("rounded-lg border p-4 text-left transition-colors", stay === pace.value ? "border-text bg-surface-2" : "border-line-strong hover:bg-surface-2")}>
            <span className="text-subhead text-text-muted">{index === 0 ? <SlowIcon /> : <FastIcon />}</span>
            <span className="mt-3 block text-label">{pace.name}</span>
            <span className="mt-1 block text-caption text-text-muted">{pace.note}</span>
          </button>)}
        </div>
        {!t.day.paces.some(pace => pace.value === stay) &&
          <p className="mt-3 text-caption text-text-muted">{t.day.custom(stay)}</p>}
        </fieldset>

        {/* 관심사는 추천 순서에만 쓴다. 운영시간·예약·이동시간 판정은 코드와 카카오 API가 한다. */}
        <fieldset className="mt-6 border-t border-line-strong pt-5">
          <legend className="text-subhead">{t.interests.legend}</legend>
          <p className="mt-2 text-caption text-text-muted">{t.interests.hint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {t.interests.items.map(item => <button key={item.id} type="button" aria-pressed={interests.includes(item.id)}
              onClick={() => setInterests(current => current.includes(item.id)
                ? current.filter(id => id !== item.id) : [...current, item.id])}
              className={cn("min-h-11 rounded-full border px-4 text-label transition-colors",
                interests.includes(item.id) ? "border-text bg-surface-2" : "border-line-strong text-text-muted")}>
              {item.label}
            </button>)}
          </div>
        </fieldset>

        <fieldset className="mt-6"><legend className="text-label">{t.travel.modeLabel}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["transit", "walk"] as const).map(mode => <button key={mode} type="button" aria-pressed={travelMode === mode}
              onClick={() => { setTravelMode(mode); invalidate(); }}
              className={cn("min-h-11 rounded-full border px-4 text-label transition-colors",
                travelMode === mode ? "border-text bg-surface-2" : "border-line-strong text-text-muted")}>
              {mode === "transit" ? t.travel.transit : t.travel.walk}
            </button>)}
          </div>
        </fieldset>

        <p className="mt-6 text-caption text-text-muted">{t.day.bufferSummary(transfer)}</p>
        <details className="mt-2 text-body-sm text-text-muted"><summary className="min-h-11 cursor-pointer py-2">{t.day.fineTune}</summary>
          <label className="mt-3 block text-label">{t.day.stay}<select className={inputClass} value={stay} onChange={e => { setStay(Number(e.target.value)); invalidate(); }}>{[30, 60, 90, 120].map(n => <option key={n} value={n}>{t.day.minutes(n)}</option>)}</select></label>
          <label className="mt-4 block text-label">{t.day.buffer}<select className={inputClass} value={transfer} onChange={e => { setTransfer(Number(e.target.value)); invalidate(); }}>{[15, 30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{t.day.minutes(n)}</option>)}</select></label>
        </details>
        {validation && <p role="alert" className="mt-4 text-body-sm text-danger">{translateLib(t, validation)}</p>}
      </div>
      <aside aria-label={t.pass.title} className="relative flex flex-col justify-between overflow-hidden rounded-device border border-line-strong bg-bg-soft p-7 sm:p-8">
        <p className="text-label text-text-muted">{t.pass.title}</p>
        <div className="relative my-7 flex items-center justify-center" aria-hidden="true">
          <div className="trip-record flex size-56 items-center justify-center rounded-full border border-line-strong sm:size-64">
            <div className="flex size-24 flex-col items-center justify-center rounded-full bg-text text-bg">
              <span className="text-title">서울</span><span className="mt-1 text-caption">SIDE : YOU</span>
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-dashed border-line-strong pt-5">
          <div><p className="text-caption text-text-muted">{t.pass.when}</p><p className="mt-1 text-label">{dayLabel}</p></div>
          <div><p className="text-caption text-text-muted">{t.pass.where}</p><p className="mt-1 text-label">{t.pass.seoul}</p></div>
          <div><p className="text-caption text-text-muted">{t.pass.pace}</p><p className="mt-1 text-label">{t.pass.perStop(stay)}</p></div>
        </div>
        <p className="mt-5 text-caption text-text-muted">{t.pass.note}</p>
      </aside>
      <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-line-strong bg-bg/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8 lg:col-span-2"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        <span className="text-caption text-text-muted">{dayLabel} · {start}–{end} · {t.result.stayEach(stay)}</span>
        <Button disabled={!!validation || !selected.length || busy} onClick={generate}>{t.spots.build} <ArrowRightIcon /></Button>
      </div>
    </section>}

    {step === 1 && <section aria-label={t.steps.labels[1]}>
      {artistIds.length > 0 && <div className={cn("mb-6 rounded-xl border p-5", hasArtistSpots ? "border-line-strong" : "border-warning/40 bg-surface")}>
        <p className="text-body">{hasArtistSpots ? t.spots.artistMatch(artistNames) : t.spots.artistNone(artistNames)}</p>
        {!hasArtistSpots && <>
          <p className="mt-2 text-body-sm text-text-muted">{t.spots.artistNoneNext}</p>
          <Button className="mt-4" variant="ghost" onClick={askForEvent}>{t.spots.addFromNotice} <ArrowRightIcon /></Button>
        </>}
      </div>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* 2단계는 날짜로 거르지 않는다(위 runsOn 조건은 step > 1). 그런데 제목·배너·빈 상태가
            사용자가 정하지 않은 기본 날짜를 사실처럼 단언하고 있었다. 날짜는 3단계에서 정한다. */}
        <h2 className="text-heading">{t.spots.listTitle}</h2>
        <p role="status" className="text-caption text-text-muted">{t.spots.count(candidates.length)}</p>
      </div>
      {/* 필터마다 개수를 함께 보여준다. 0인 분류를 숨기면 "없다"는 사실이 가려진다. */}
      <fieldset className="mt-4">
        <legend className="sr-only">{t.categories.legend}</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)}
            className={cn("min-h-11 rounded-full border px-4 text-label transition-colors",
              category === null ? "border-text bg-surface-2" : "border-line-strong text-text-muted")}>
            {t.categories.all}
          </button>
          {filterCategories.map(key => <button key={key} type="button" aria-pressed={category === key}
            onClick={() => setCategory(category === key ? null : key)}
            className={cn("min-h-11 rounded-full border px-4 text-label transition-colors",
              category === key ? "border-text bg-surface-2" : "border-line-strong text-text-muted")}>
            {t.categories[key]} <span aria-hidden="true" className="text-text-faint">{counts[key]}</span>
            <span className="sr-only"> {t.spots.count(counts[key])}</span>
          </button>)}
        </div>
      </fieldset>
      {category !== null && counts[category] === 0 &&
        <p role="status" className="mt-3 text-body-sm text-warning">{t.categories.empty(t.categories[category])}</p>}

      <label className="mt-4 block w-full text-label sm:max-w-md">{t.spots.search}
        <input className={inputClass} value={query} onChange={e => setQuery(e.target.value)} placeholder={t.spots.searchPlaceholder} />
      </label>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map(event => <SpotCard key={event.id} event={event} date={date} selected={selected.includes(event.id)}
          disabled={!selected.includes(event.id) && selected.length >= 6}
          required={required.includes(event.id)}
          onToggleRequired={() => setRequired(ids => {
            const next = ids.includes(event.id) ? ids.filter(id => id !== event.id) : [...ids, event.id];
            invalidate();
            return next;
          })}
          onToggle={() => toggleSelected(event.id)} />)}
      </div>
      {!candidates.length && <div className="my-6 rounded-xl border border-dashed border-line-strong p-8 text-center">
        <p className="text-subhead">{t.spots.empty}</p>
        <p className="mt-3 text-body-sm text-text-muted">{t.spots.emptyNext}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {query && <Button variant="ghost" onClick={() => setQuery("")}>{t.spots.clearSearch}</Button>}
          <Button variant="ghost" onClick={askForEvent}>{t.spots.addFromNotice}</Button>
        </div>
      </div>}

      {personal.length > 0 && <details className="mt-5 text-body-sm"><summary className="min-h-11 cursor-pointer py-2">{t.spots.manage(personal.length)}</summary>
        <ul className="mt-3 space-y-2">{personal.map(event => <li className="flex flex-wrap items-center justify-between gap-2" key={event.id}>
          <span>{eventCopy(event, dataLocale).title} · {event.from}</span>
          <Button size="sm" variant="ghost" onClick={() => { setPersonal(items => items.filter(item => item.id !== event.id)); setSelected(ids => ids.filter(id => id !== event.id)); invalidate(); }}>{t.spots.deleteEvent(eventCopy(event, dataLocale).title)}</Button>
        </li>)}</ul>
        <p className="mt-2">{t.spots.saveAgain}</p>
      </details>}
      {personal.length < 12 && <PersonalEventForm date={date} requestOpen={openForm} onAdd={event => {
        setPersonal(items => [...items, event]); setQuery(""); invalidate(); setNotice(t.event.added);
      }} />}

      <details className="mt-5 rounded-xl border border-line-strong p-5 text-body-sm">
        <summary className="min-h-11 cursor-pointer py-2 text-label">{t.tips.title}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-text-muted">{t.tips.items.map(tip => <li key={tip}>{tip}</li>)}</ul>
        <p className="mt-3 text-caption text-text-muted">{t.tips.note}</p>
      </details>

      {/* 모바일에서 고른 개수와 다음 행동이 늘 손 닿는 곳에 있도록 아래에 고정한다. */}
      <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-strong bg-bg/95 px-5 py-3 backdrop-blur md:-mx-8 md:px-8"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
        {/* 갈 곳 단계의 뒤로는 최애 고르기로 간다. 단계 이름을 그대로 써서 어디로 가는지 분명히 한다. */}
        <Button variant="ghost" size="sm" onClick={() => setStep(0)}><ArrowLeftIcon /> {t.steps.labels[0]}</Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-caption text-text-muted">{selected.length >= 6 ? t.spots.full : selected.length ? t.spots.picked(selected.length) : t.spots.pickFirst}</span>
          {/* 날짜는 다음 단계에서 정한다. 여기서 막지 않는다. */}
          <Button disabled={!selected.length || busy} onClick={() => setStep(2)}>{t.steps.labels[2]} <ArrowRightIcon /></Button>
        </div>
      </div>
    </section>}

    {step === 3 && journey && <JourneyPlanner journey={journey} locale={dataLocale}
      onChange={setJourney} notice={setNotice} />}

    {step === 3 && !journey && result && <section aria-label={t.steps.labels[3]} className="grid items-start gap-6 lg:grid-cols-3">
      <aside className="rounded-device border border-line-strong bg-surface p-6 lg:col-span-1">
        <p className="font-display text-title">{dayLabel}<br /><span className="text-text-muted">{t.pass.seoul}</span></p>
        <div className="my-5 border-t border-dashed border-line-strong" />
        {/* 기준 목업의 요약 타일. 거리는 검증된 값이 없어 넣지 않는다 — 방문 수와 실제 소요 시간만. */}
        {lastStop && <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-bg-soft px-4 py-3">
            <p className="font-display text-heading">{result.stops.length}</p>
            <p className="mt-1 text-caption text-text-muted">{t.result.visits(result.stops.length)}</p>
          </div>
          <div className="rounded-lg border border-line bg-bg-soft px-4 py-3">
            <p className="font-display text-heading">{t.result.duration(lastStop.departure - result.stops[0].arrival)}</p>
            {/* 시간 범위는 적지 않는다 — 정류장이 하나면 그 카드의 시간과 똑같아져 화면에 같은 글자가 둘이 된다. */}
          </div>
        </div>}
        {/* 문구 순서는 그대로 둔다 — e2e가 "N visits ·"로 이 줄을 찾는다. */}
        <p className="mt-4 text-body-sm text-text-muted">{t.result.visits(result.stops.length)} · {t.result.stayEach(stay)}</p>
        <p className="mt-1 text-body-sm text-text-muted">{t.result.window(start, end)}</p>
        <Button className="mt-5" block disabled={!result.stops.length} onClick={addToCalendar}><CalendarIcon /> {t.result.calendar}</Button>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={!!validation || busy} onClick={() => device("save")}>{t.result.saveDevice}</Button>
          <Button size="sm" variant="ghost" disabled={!result.stops.length} onClick={download}>{t.result.txt}</Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line-strong pt-5">
          <Button size="sm" variant="ghost" onClick={() => setStep(2)}>{t.result.editDay}</Button>
          <Button size="sm" variant="ghost" onClick={() => setStep(1)}>{t.result.editSpots}</Button>
        </div>
      </aside>
      <div className="lg:col-span-2">
        {result.error && <p role="alert" className="rounded-xl border border-danger p-5 text-body-sm text-danger">{translateLib(t, result.error)}</p>}
        {!result.stops.length && !result.error && <div className="rounded-xl border border-line-strong p-6">
          <h2 className="text-heading">{t.result.emptyTitle}</h2>
          <p className="mt-3 text-body-sm text-text-muted">{t.result.emptyBody}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(2)}>{t.result.editDay}</Button>
            <Button variant="ghost" onClick={() => setStep(1)}>{t.result.editSpots}</Button>
          </div>
        </div>}
        {result.missingRequired.length > 0 && <p role="alert" className="mb-5 rounded-xl border border-warning/60 bg-surface p-5 text-body-sm">
          {t.musts.missing(result.missingRequired.length)}
        </p>}
        {result.stops.length > 0 && <p role="status" className="mb-5 text-caption text-text-muted">
          {lookingUp ? t.travel.lookingUp
            : unconfirmedLegs > 0 ? t.travel.someUnconfirmed(unconfirmedLegs) : t.travel.allChecked}
        </p>}
        {/* 좌표가 있는 정류장만 핀으로. NEXT_PUBLIC_KAKAO_JS_KEY가 없으면 렌더되지 않는다. */}
        {(() => {
          const points = [
            ...result.stops.flatMap(s => { const p = eventPoint(s.event); return p.coord ? [{ name: eventCopy(s.event, dataLocale).title, coord: p.coord }] : []; }),
            ...gapFill.chains.flatMap(c => c.items).flatMap(f => f.status === "filled" ? [{ name: f.suggestion.name, coord: f.suggestion.coord, tentative: true }] : []),
          ];
          const mapClass = "mb-5 h-64 w-full overflow-hidden rounded-xl border border-line-strong";
          // Google 지도 키가 있으면 Google, 없으면 카카오(T-052). Google 장소 사진은 Google 지도일 때만 쓴다.
          return GOOGLE_MAPS_JS_KEY
            ? <GoogleMap className={mapClass} points={points} language={locale === "zh" ? "zh-CN" : locale} label={t.result.mapLabel} />
            : <KakaoMap className={mapClass} points={points} />;
        })()}
        <ol className="space-y-4">{result.stops.map((stop, index) => { const before = chainBefore(stop.event.id, index); const via = lastFilled(before); return <Fragment key={stop.event.id}>
          {index === 0 && renderChain(before)}
          <li>
          {/* 앞 빈 시간에 추천이 들어갔으면 이 정류장까지의 이동은 추천 장소에서 출발한다. */}
          {via
            ? <TravelLeg estimate={via.legOut} bufferMinutes={transfer} />
            : <TravelLeg estimate={stop.travelEstimate} bufferMinutes={transfer} lookingUp={lookingUp} />}
          <article className="rounded-xl border border-line-strong bg-surface p-5 sm:p-6">
            {/* 기준 목업의 정류장 행: 번호 · 분류 태그 · 시간. 분류는 우리가 만든 라벨이라 번역해도 된다. */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-line-strong px-3 py-1 text-caption">{t.result.track(index + 1)}</span>
              {stop.event.provenance.mode !== "personal" && <Badge tone="category">{t.kinds[stop.event.kind] || stop.event.kind}</Badge>}
              {required.includes(stop.event.id) && <Badge tone="accent">{t.musts.badge}</Badge>}
              <span className="ml-auto font-mono text-label">{clock(stop.arrival)}–{clock(stop.departure)}</span>
            </div>
            <h2 className="mt-4 text-heading" lang={stopLang(stop.event, stop.event.title_ko)}>{eventCopy(stop.event, dataLocale).title}</h2>
            {/* 지역 · 가까운 역 한 줄. 교통 정보가 없으면 지역만 — 없는 값을 채우지 않는다. */}
            <p className="mt-2 text-body-sm text-text-muted">
              <span lang={stopLang(stop.event, stop.event.area_ko)}>{eventCopy(stop.event, dataLocale).area}</span>
              {stop.event.transit && <> · {t.spots.transit(
                locale === "ko" ? stop.event.transit.station_ko : stop.event.transit.station_en,
                locale === "ko" ? stop.event.transit.line_ko : stop.event.transit.line_en,
                stop.event.transit.exit, stop.event.transit.walk_minutes)}</>}
            </p>
            <p className="mt-3 text-caption text-text-muted" lang={stopLang(stop.event, stop.event.do_ko)}>{eventCopy(stop.event, dataLocale).do}</p>
            <a className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-body-sm underline underline-offset-4"
              href={`https://map.naver.com/p/search/${encodeURIComponent(stop.event.address)}`} target="_blank" rel="noopener noreferrer">
              <span lang="en">{stop.event.address}</span> <ExternalIcon />
            </a>
            {index === 0 && <p className="mt-3 border-t border-line-strong pt-3 text-caption text-text-muted">{t.result.firstStop}</p>}
          </article>
          </li>
          {renderChain(chainAfter(stop.event.id))}
        </Fragment>; })}</ol>

        {result.omitted.length > 0 && <div className="mt-5 rounded-xl border border-dashed border-line-strong p-5">
          <h2 className="text-label">{t.result.omitted}</h2>
          <ul className="mt-3 space-y-3">{result.omitted.map(item => <li key={item.event.id} className="text-body-sm">
            <b>{eventCopy(item.event, dataLocale).title}</b>
            {item.required && <> <span className="text-warning">({t.musts.badge})</span></>}
            <p className="text-text-muted">{translateLib(t, item.reason)}</p>
          </li>)}</ul>
        </div>}

        <SuggestionPanel anchor={anchorPoint?.coord ?? null}
          anchorName={anchorPoint ? anchorPoint.name : ""}
          profile={profile}
          onAdd={addSuggestion} />
        {lastStop && <div className="mt-5 rounded-xl border border-line-strong bg-bg-soft p-5">
          <h2 className="flex items-center gap-2 text-subhead"><CheckIcon />{t.result.encoreTitle(clock(dayEnd))}</h2>
          <p className="mt-2 text-body-sm text-text-muted">
            {freeAfter >= 30 ? t.result.encoreFree(t.result.duration(freeAfter), end) : t.result.encoreFull}
          </p>
          {freeAfter >= 30 && <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={askForEvent}>{t.result.encoreAdd}</Button>
            <Button size="sm" variant="ghost" onClick={() => setStep(2)}>{t.result.encoreSlow}</Button>
          </div>}
        </div>}

      </div>
    </section>}

    <p className="mt-8 max-w-[70ch] text-caption text-text-muted">{t.footer(transfer)}</p>

    <details className="mt-6 border-t border-line-strong pt-4"><summary className="min-h-11 cursor-pointer py-2 text-label">{t.storage.title}</summary>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => device("save")} disabled={!!validation || busy}>{t.storage.save}</Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => device("load")}>{t.storage.restore}</Button>
        <Button variant="ghost" size="sm" onClick={() => device("delete")}>{t.storage.remove}</Button>
      </div>
      <p className="mt-3 text-caption text-text-muted">{t.storage.note}</p>
      {cloudEnabled && <details className="mt-5 rounded-lg border border-line-strong p-5">
        <summary className="min-h-11 cursor-pointer py-2 text-subhead">{t.storage.cloudTitle}</summary>
        <p className="mt-3 text-body-sm text-text-muted">{t.storage.cloudNote}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy || !!validation} onClick={() => cloud("save")}>{t.storage.cloudSave}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => cloud("load")}>{t.storage.cloudRestore}</Button>
          <Button variant="ghost" disabled={busy} onClick={() => cloud("delete")}>{t.storage.cloudRemove}</Button>
        </div>
      </details>}
    </details>

    {/* 알림은 누른 버튼에서 멀리 떨어진 페이지 맨 아래가 아니라, 화면에 붙여 보여준다. */}
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-20 z-30 flex justify-center sm:bottom-6">
      {notice && <p className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border border-line-strong bg-surface-2 p-4 text-body-sm shadow-lg">
        {notice}
        <button type="button" onClick={() => setNotice("")} aria-label={t.notices.dismiss} className="-m-2 flex size-11 shrink-0 items-center justify-center text-text-muted hover:text-text">
          <CloseIcon />
        </button>
      </p>}
    </div>
  </main>;
}
