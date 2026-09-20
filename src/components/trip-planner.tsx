"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui";
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon, CheckIcon, CloseIcon, ExternalIcon, FastIcon, SlowIcon } from "@/components/icons";
import { LanguageToggle } from "@/components/language-toggle";
import { SpotCard } from "@/components/spot-card";
import { clock, minutes, planTrip, runsOn, validateTrip, type FanEvent } from "@/lib/trip/planner";
import { catalog } from "@/lib/trip/catalog";
import { PersonalEventForm } from "@/components/personal-event-form";
import { parseSavedTrip, storageKey, type SavedTrip } from "@/lib/trip/storage";
import { cloudEnabled, cloudTrip } from "@/lib/trip/cloud";
import { ArtistPicker } from "@/components/artist-picker";
import { artists, matchesArtists } from "@/lib/trip/artists";
import { buildCalendar } from "@/lib/calendar";
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
  const [artistIds, setArtistIds] = useState<string[]>([]);
  const [result, setResult] = useState<ReturnType<typeof planTrip> | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [openForm, setOpenForm] = useState(0);
  const input = { date, start: minutes(start), end: minutes(end), stay, transfer };
  const validation = validateTrip(input);
  const events = [...catalog, ...personal];
  const candidates = events.filter(e => matchesArtists(e.artistIds, artistIds) && runsOn(e, date) && `${e.title} ${e.area} ${e.kind}`.toLowerCase().includes(query.toLowerCase()));
  function invalidate() { setResult(null); setNotice(""); }
  function snapshot(): SavedTrip { return { version: 1, input, selected, personal, artistIds }; }
  function restore(saved: SavedTrip) {
    setDate(saved.input.date); setStart(clock(saved.input.start)); setEnd(clock(saved.input.end));
    setStay(saved.input.stay); setTransfer(saved.input.transfer); setPersonal(saved.personal);
    setSelected(saved.selected); setQuery("");
    setArtistIds(saved.artistIds ?? []);
    setResult(planTrip([...catalog, ...saved.personal].filter(e => saved.selected.includes(e.id)), saved.input));
    setStep(2);
  }
  function device(action: "save" | "load" | "delete") {
    try {
      if (action === "save") {
        if (validation) { setNotice(translateLib(t, validation)); return; }
        localStorage.setItem(storageKey, JSON.stringify(snapshot()));
        setNotice(t.notices.saved);
      } else if (action === "load") {
        const raw = localStorage.getItem(storageKey);
        if (!raw) { setNotice(t.notices.noDraft); return; }
        const saved = parseSavedTrip(JSON.parse(raw));
        if (!saved) { setNotice(t.notices.unreadable); return; }
        restore(saved); setNotice(t.notices.restored);
      } else {
        localStorage.removeItem(storageKey); setNotice(t.notices.deleted);
      }
    } catch { setNotice(t.notices.storageUnavailable); }
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
  function generate() {
    if (validation || !selected.length) return;
    setResult(planTrip(events.filter(e => selected.includes(e.id)), input));
    setNotice("");
    setStep(2);
  }
  function changeDate(value: string) {
    setDate(value);
    // 날짜가 바뀌면 그날 열지 않는 곳이 섞이므로 선택을 비운다(T-008 계약). 조용히 지우지는 않는다.
    if (selected.length) setNotice(t.notices.dateCleared(selected.length));
    else setNotice("");
    setSelected([]);
    setResult(null);
  }
  function askForEvent() { setStep(1); setOpenForm(value => value + 1); }
  function download() {
    if (!result?.stops.length) return;
    const text = [t.file.header(date), t.file.disclaimer(transfer),
      ...result.stops.map(s => `${clock(s.arrival)}–${clock(s.departure)} ${s.event.title}\n${s.event.address}\n${t.spots.doLabel}: ${s.event.do}\n${t.spots.getLabel}: ${s.event.get}\n${t.spots.source(s.event.provenance.author, s.event.provenance.checkedOn)} ${s.event.provenance.url}`),
      ...result.omitted.map(o => t.file.notScheduled(o.event.title, translateLib(t, o.reason)))].join("\n\n");
    saveFile(text, "text/plain;charset=utf-8", `ultspot-${date}.txt`);
    setNotice(t.result.downloaded);
  }
  function addToCalendar() {
    if (!result?.stops.length) return;
    const ics = buildCalendar(result.stops.map(stop => ({
      uid: `${stop.event.id}-${date}@ultspot.vercel.app`, date, start: stop.arrival, end: stop.departure,
      title: stop.event.title, location: stop.event.address,
      description: `${stop.event.do}\n${stop.event.provenance.url}\n${t.file.calendarNote}`,
    })));
    saveFile(ics, "text/calendar;charset=utf-8", `ultspot-${date}.ics`);
    setNotice(t.result.calendarDone);
  }
  const dayLabel = date && !Number.isNaN(Date.parse(date))
    ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))
    : "—";
  const artistNames = artists.filter(a => artistIds.includes(a.id)).map(a => (locale === "ko" ? a.korean || a.name : a.name)).join(" + ");
  const hasArtistSpots = candidates.some(e => e.artistIds?.length);
  const lastStop = result?.stops.at(-1);
  const freeMinutes = lastStop ? input.end - lastStop.departure : 0;

  return <main className="shell pb-16">
    <header className="flex items-center justify-between gap-4 border-b border-line py-4">
      <Link href="/" aria-label="ULTSPOT home"><Wordmark /></Link>
      <LanguageToggle />
    </header>

    <nav aria-label={t.steps.nav} className="my-6 grid grid-cols-3 gap-2 sm:gap-6">
      {t.steps.labels.map((label, index) => <button key={label} type="button" aria-current={step === index ? "step" : undefined}
        disabled={busy || (index === 1 && !!validation) || (index === 2 && !result)} onClick={() => setStep(index)}
        className={cn("flex min-h-11 items-center gap-2 border-b-2 pb-3 text-left text-label transition-colors disabled:cursor-not-allowed disabled:text-text-faint",
          step === index ? "border-text text-text" : "border-line-strong text-text-muted")}>
        <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-caption",
          step === index ? "bg-text text-bg" : "bg-surface")}>{index + 1}</span>{label}
      </button>)}
    </nav>

    <div className="mb-6">
      <h1 ref={heading} tabIndex={-1} className="text-display outline-none">{t.titles[step]}</h1>
      <p className="mt-3 max-w-[46ch] text-body text-text-muted">{t.subtitles[step]}</p>
      {step > 0 && <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-caption text-text-muted">
        <span className="rounded-full border border-line-strong px-3 py-1.5 text-text">{dayLabel}</span>
        <span>{start}–{end}</span>
        <span>{t.result.stayEach(stay)}</span>
        <span>{t.day.bufferSummary(transfer)}</span>
      </p>}
    </div>

    {step === 0 && <section aria-label={t.steps.labels[0]} className="grid gap-6 lg:grid-cols-2 lg:gap-10">
      <div className="min-w-0 rounded-device border border-line-strong bg-surface p-6 sm:p-8">
        <label className="block text-subhead">{t.day.dateQuestion}<span className="sr-only"> {t.day.dateLabel}</span>
          <input aria-label={t.day.dateLabel} className={`${inputClass} mt-4`} type="date" value={date} onChange={e => changeDate(e.target.value)} />
        </label>
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
        </div></fieldset>

        <ArtistPicker selected={artistIds} onChange={ids => {
          setArtistIds(ids);
          setSelected(current => current.filter(id => events.some(e => e.id === id && matchesArtists(e.artistIds, ids))));
          invalidate();
        }} />

        <p className="mt-6 text-caption text-text-muted">{t.day.bufferSummary(transfer)}</p>
        <details className="mt-2 text-body-sm text-text-muted"><summary className="min-h-11 cursor-pointer py-2">{t.day.fineTune}</summary>
          <label className="mt-3 block text-label">{t.day.stay}<select className={inputClass} value={stay} onChange={e => { setStay(Number(e.target.value)); invalidate(); }}>{[30, 60, 90, 120].map(n => <option key={n} value={n}>{t.day.minutes(n)}</option>)}</select></label>
          <label className="mt-4 block text-label">{t.day.buffer}<select className={inputClass} value={transfer} onChange={e => { setTransfer(Number(e.target.value)); invalidate(); }}>{[15, 30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{t.day.minutes(n)}</option>)}</select></label>
        </details>
        {validation && <p role="alert" className="mt-4 text-body-sm text-danger">{translateLib(t, validation)}</p>}
        <Button className="mt-5" size="lg" block disabled={!!validation || busy} onClick={() => setStep(1)}>{t.day.cta} <ArrowRightIcon /></Button>
        <p className="mt-3 text-center text-caption text-text-muted">{t.day.noSignup}</p>
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
        <div>
          <p className="text-heading whitespace-pre-line">{t.pass.headline}</p>
          <p className="mt-3 max-w-sm text-body-sm text-text-muted">{t.pass.body}</p>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-dashed border-line-strong pt-5">
          <div><p className="text-caption text-text-muted">{t.pass.when}</p><p className="mt-1 text-label">{dayLabel}</p></div>
          <div><p className="text-caption text-text-muted">{t.pass.where}</p><p className="mt-1 text-label">{t.pass.seoul}</p></div>
          <div><p className="text-caption text-text-muted">{t.pass.pace}</p><p className="mt-1 text-label">{t.pass.perStop(stay)}</p></div>
        </div>
        <p className="mt-5 text-caption text-text-muted">{t.pass.note}</p>
      </aside>
    </section>}

    {step === 1 && <section aria-label={t.steps.labels[1]}>
      {artistIds.length > 0 && <div className={cn("mb-6 rounded-xl border p-5", hasArtistSpots ? "border-line-strong" : "border-warning/40 bg-surface")}>
        <p className="text-body">{hasArtistSpots ? t.spots.artistMatch(artistNames) : t.spots.artistNone(artistNames, dayLabel)}</p>
        {!hasArtistSpots && <>
          <p className="mt-2 text-body-sm text-text-muted">{t.spots.artistNoneNext}</p>
          <Button className="mt-4" variant="ghost" onClick={askForEvent}>{t.spots.addFromNotice} <ArrowRightIcon /></Button>
        </>}
      </div>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-heading">{t.spots.listTitle(dayLabel)}</h2>
        <p className="text-caption text-text-muted">{t.spots.count(candidates.length)}</p>
      </div>
      <label className="mt-4 block w-full text-label sm:max-w-md">{t.spots.search}
        <input className={inputClass} value={query} onChange={e => setQuery(e.target.value)} placeholder={t.spots.searchPlaceholder} />
      </label>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map(event => <SpotCard key={event.id} event={event} date={date} selected={selected.includes(event.id)}
          disabled={!selected.includes(event.id) && selected.length >= 6}
          onToggle={() => { setSelected(ids => ids.includes(event.id) ? ids.filter(id => id !== event.id) : [...ids, event.id]); invalidate(); }} />)}
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
          <span>{event.title} · {event.from}</span>
          <Button size="sm" variant="ghost" onClick={() => { setPersonal(items => items.filter(item => item.id !== event.id)); setSelected(ids => ids.filter(id => id !== event.id)); invalidate(); }}>{t.spots.deleteEvent(event.title)}</Button>
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
        <Button variant="ghost" size="sm" onClick={() => setStep(0)}><ArrowLeftIcon /> {t.spots.back}</Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-caption text-text-muted">{selected.length ? t.spots.picked(selected.length) : t.spots.pickFirst}</span>
          <Button disabled={!selected.length || !!validation || busy} onClick={generate}>{t.spots.build} <ArrowRightIcon /></Button>
        </div>
      </div>
    </section>}

    {step === 2 && result && <section aria-label={t.steps.labels[2]} className="grid items-start gap-6 lg:grid-cols-3">
      <aside className="rounded-device border border-line-strong bg-surface p-6 lg:col-span-1">
        <p className="font-display text-title">{dayLabel}<br /><span className="text-text-muted">{t.pass.seoul}</span></p>
        <div className="my-5 border-t border-dashed border-line-strong" />
        <p className="text-body-sm text-text-muted">{t.result.visits(result.stops.length)} · {t.result.stayEach(stay)}</p>
        <p className="mt-2 text-body-sm text-text-muted">
          {t.result.window(start, end)}
          {lastStop && <><br />{t.result.ends(clock(result.stops[0].arrival), clock(lastStop.departure))}</>}
        </p>
        <Button className="mt-5" block disabled={!result.stops.length} onClick={addToCalendar}><CalendarIcon /> {t.result.calendar}</Button>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={!!validation || busy} onClick={() => device("save")}>{t.result.saveDevice}</Button>
          <Button size="sm" variant="ghost" disabled={!result.stops.length} onClick={download}>{t.result.txt}</Button>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line-strong pt-5">
          <Button size="sm" variant="ghost" onClick={() => setStep(0)}>{t.result.editDay}</Button>
          <Button size="sm" variant="ghost" onClick={() => setStep(1)}>{t.result.editSpots}</Button>
        </div>
      </aside>
      <div className="lg:col-span-2">
        {result.error && <p role="alert" className="rounded-xl border border-danger p-5 text-body-sm text-danger">{translateLib(t, result.error)}</p>}
        {!result.stops.length && !result.error && <div className="rounded-xl border border-line-strong p-6">
          <h2 className="text-heading">{t.result.emptyTitle}</h2>
          <p className="mt-3 text-body-sm text-text-muted">{t.result.emptyBody}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>{t.result.editDay}</Button>
            <Button variant="ghost" onClick={() => setStep(1)}>{t.result.editSpots}</Button>
          </div>
        </div>}
        <ol className="space-y-4">{result.stops.map((stop, index) => <li key={stop.event.id}>
          {index > 0 && <p className="mb-4 flex items-center gap-2 pl-1 text-caption text-text-muted">
            <span aria-hidden="true" className="h-4 w-px bg-line-strong" />{t.result.buffer(stop.travel)}
          </p>}
          <article className="rounded-xl border border-line-strong bg-surface p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-line-strong px-3 py-1 text-caption">{t.result.track(index + 1)}</span>
              <span className="font-mono text-label">{clock(stop.arrival)}–{clock(stop.departure)}</span>
            </div>
            <h2 className="mt-4 text-heading">{stop.event.title}</h2>
            <p className="mt-3 text-body-sm text-text-muted" lang="en">{stop.event.do}</p>
            <a className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-body-sm underline underline-offset-4"
              href={`https://map.naver.com/p/search/${encodeURIComponent(stop.event.address)}`} target="_blank" rel="noopener noreferrer">
              <span lang="en">{stop.event.address}</span> <ExternalIcon />
            </a>
            {index === 0 && <p className="mt-3 border-t border-line-strong pt-3 text-caption text-text-muted">{t.result.firstStop}</p>}
          </article>
        </li>)}</ol>

        {lastStop && <div className="mt-5 rounded-xl border border-line-strong bg-bg-soft p-5">
          <h2 className="flex items-center gap-2 text-subhead"><CheckIcon />{t.result.encoreTitle(clock(lastStop.departure))}</h2>
          <p className="mt-2 text-body-sm text-text-muted">
            {freeMinutes >= 30 ? t.result.encoreFree(t.result.duration(freeMinutes), end) : t.result.encoreFull}
          </p>
          {freeMinutes >= 30 && <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={askForEvent}>{t.result.encoreAdd}</Button>
            <Button size="sm" variant="ghost" onClick={() => setStep(0)}>{t.result.encoreSlow}</Button>
          </div>}
        </div>}

        {result.omitted.length > 0 && <div className="mt-5 rounded-xl border border-dashed border-line-strong p-5">
          <h2 className="text-label">{t.result.omitted}</h2>
          <ul className="mt-3 space-y-3">{result.omitted.map(item => <li key={item.event.id} className="text-body-sm">
            <b>{item.event.title}</b><p className="text-text-muted">{translateLib(t, item.reason)}</p>
          </li>)}</ul>
        </div>}
      </div>
    </section>}

    <p className="mt-8 text-caption text-text-muted">{t.footer(transfer)}</p>

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
