"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui";
import { clock, minutes, planTrip, runsOn, validateTrip, type FanEvent } from "@/lib/trip/planner";
import { catalog } from "@/lib/trip/catalog";
import { PersonalEventForm } from "@/components/personal-event-form";
import { parseSavedTrip, storageKey, type SavedTrip } from "@/lib/trip/storage";
import { cloudEnabled, cloudTrip } from "@/lib/trip/cloud";

const inputClass = "mt-2 block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-3 py-3 text-body";

export function TripPlanner({ today }: { today: string }) {
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
  const [result, setResult] = useState<ReturnType<typeof planTrip> | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const input = { date, start: minutes(start), end: minutes(end), stay, transfer };
  const validation = validateTrip(input);
  const events = [...catalog, ...personal];
  const candidates = events.filter(e => runsOn(e, date) && `${e.title} ${e.area} ${e.kind}`.toLowerCase().includes(query.toLowerCase()));
  function invalidate() { setResult(null); setNotice(""); }
  function snapshot(): SavedTrip { return { version: 1, input, selected, personal }; }
  function restore(saved: SavedTrip) {
    setDate(saved.input.date); setStart(clock(saved.input.start)); setEnd(clock(saved.input.end));
    setStay(saved.input.stay); setTransfer(saved.input.transfer); setPersonal(saved.personal);
    setSelected(saved.selected); setQuery("");
    setResult(planTrip([...catalog, ...saved.personal].filter(e => saved.selected.includes(e.id)), saved.input));
    setStep(2);
  }
  function device(action: "save" | "load" | "delete") {
    try {
      if (action === "save") {
        if (validation) { setNotice(validation); return; }
        localStorage.setItem(storageKey, JSON.stringify(snapshot()));
        setNotice("Saved on this device. Restore it here after reloading. This replaces your previous device draft.");
      } else if (action === "load") {
        const raw = localStorage.getItem(storageKey);
        if (!raw) { setNotice("No saved trip on this device yet."); return; }
        const saved = parseSavedTrip(JSON.parse(raw));
        if (!saved) { setNotice("Saved data could not be read. Your current plan is unchanged."); return; }
        restore(saved); setNotice("Restored your device draft and recalculated against the current catalog.");
      } else {
        localStorage.removeItem(storageKey); setNotice("Device draft deleted. Your current on-screen plan and any cloud copy are unchanged.");
      }
    } catch { setNotice("Device storage is unavailable or the saved data is invalid. You can still download your itinerary."); }
  }
  async function cloud(action: "save" | "load" | "delete") {
    if (action === "save" && validation) { setNotice(validation); return; }
    setBusy(true);
    try {
      const saved = await cloudTrip(action, action === "save" ? snapshot() : undefined);
      if (action === "load" && saved) restore(saved);
      setNotice(action === "save" ? "Saved your private cloud draft. Keep this browser session to restore it." : action === "delete" ? "Cloud draft deleted. Your device copy and on-screen plan are unchanged." : saved ? "Cloud draft restored and recalculated." : "No cloud draft for this browser session.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Cloud storage is unavailable."); }
    finally { setBusy(false); }
  }
  function generate() {
    if (validation || !selected.length) return;
    setResult(planTrip(events.filter(e => selected.includes(e.id)), input));
    setNotice("");
    setStep(2);
  }
  function download() {
    if (!result?.stops.length) return;
    const text = [`ULTSPOT · ${date} · Korea time`,
      `Not a booking. ${transfer} minutes between stops is your planning buffer, not live routing. Confirm holiday hours and availability before visiting.`,
      ...result.stops.map(s => `${clock(s.arrival)}–${clock(s.departure)} ${s.event.title}\n${s.event.address}\nDo: ${s.event.do}\nGet: ${s.event.get}\nSource: ${s.event.provenance.url} · checked ${s.event.provenance.checkedOn}`),
      ...result.omitted.map(o => `Not scheduled: ${o.event.title} — ${o.reason}`)].join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `ultspot-${date}.txt`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Your itinerary was downloaded.");
  }
  const dayLabel = date && !Number.isNaN(Date.parse(date))
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : "Your date";
  const titles = [<>First, make it<br /><em className="not-italic text-text-muted">your day.</em></>, <>Pick your<br /><em className="not-italic text-text-muted">main moments.</em></>, <>Your Seoul<br /><em className="not-italic text-text-muted">setlist.</em></>];
  const subtitles = ["A K-pop day out, with room for the unexpected.", "A little exploring. A little collecting. All you.", "Your favorite stops, with time to take it all in."];
  return <main lang="en" className="shell pb-12">
    <header className="flex items-center justify-between gap-4 border-b border-line py-6">
      <Link href="/" aria-label="ULTSPOT home"><Wordmark /></Link>
      <span className="flex items-center gap-2 text-caption text-text-muted"><span className="text-orange" aria-hidden="true">✦</span> SEOUL, YOUR WAY</span>
    </header>
    <nav aria-label="Trip steps" className="my-7 grid grid-cols-3 gap-2 sm:gap-6">
      {["Your day", "Your spots", "Your setlist"].map((label, index) => <button key={label} type="button" aria-current={step === index ? "step" : undefined} disabled={busy || (index === 1 && !!validation) || (index === 2 && !result)} onClick={() => setStep(index)} className={`flex items-center gap-2 border-b-2 pb-3 text-left text-label transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${step === index ? "border-text text-text" : "border-line-strong text-text-muted"}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-caption ${step === index ? "bg-text text-bg" : "bg-surface"}`}>{index + 1}</span>{label}</button>)}
    </nav>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-3 text-eyebrow text-text-muted">YOUR FANDOM. YOUR FOOTSTEPS.</p><h1 ref={heading} tabIndex={-1} className="text-display outline-none">{titles[step]}</h1><p className="mt-4 text-body text-text-muted">{subtitles[step]}</p></div>
      <span className="rounded-full border border-line-strong px-4 py-2 text-caption">{step === 0 ? "01 / START THE STORY" : `${dayLabel} · Seoul`}</span>
    </div>

    {step === 0 && <section aria-label="Set your day" className="grid gap-6 lg:grid-cols-2 lg:gap-10">
      <div className="min-w-0 rounded-device border border-line-strong bg-surface p-6 sm:p-8">
        <label className="block text-subhead">When’s your Seoul day?<span className="sr-only"> Travel date</span><input aria-label="Travel date" className={`${inputClass} mt-4`} type="date" value={date} onChange={e => { setDate(e.target.value); setSelected([]); invalidate(); }} /></label>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <label className="min-w-0 text-label">Start time<input className={inputClass} type="time" value={start} onChange={e => { setStart(e.target.value); invalidate(); }} /></label>
          <label className="min-w-0 text-label">End time<input className={inputClass} type="time" value={end} onChange={e => { setEnd(e.target.value); invalidate(); }} /></label>
        </div>
        <fieldset className="mt-6"><legend className="text-subhead">Find your tempo</legend><div className="mt-3 grid grid-cols-2 gap-3">
          {[{ name: "Take it slow", note: "90 min at each spot", icon: "♡", value: 90 }, { name: "Keep exploring", note: "60 min at each spot", icon: "✦", value: 60 }].map(pace => <button key={pace.name} type="button" aria-pressed={stay === pace.value} onClick={() => { setStay(pace.value); invalidate(); }} className={`rounded-lg border p-4 text-left transition-colors ${stay === pace.value ? "border-text bg-surface-2" : "border-line-strong hover:bg-surface-2"}`}><span aria-hidden="true" className="text-subhead">{pace.icon}</span><span className="mt-3 block text-label">{pace.name}</span><span className="mt-1 block text-caption text-text-muted">{pace.note}</span></button>)}
        </div></fieldset>
        <details className="mt-5 text-body-sm text-text-muted"><summary className="cursor-pointer py-2">Fine-tune your day</summary>
          <label className="mt-3 block text-label">Time at each spot<select className={inputClass} value={stay} onChange={e => { setStay(Number(e.target.value)); invalidate(); }}>{[30, 60, 90, 120].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
          <label className="mt-4 block text-label">Travel buffer between spots<select className={inputClass} value={transfer} onChange={e => { setTransfer(Number(e.target.value)); invalidate(); }}>{[15, 30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
        </details>
        {validation && <p role="alert" className="mt-4 text-body-sm text-danger">{validation}</p>}
        <Button className="mt-5" size="lg" block disabled={!!validation || busy} onClick={() => setStep(1)}>Find my spots <span aria-hidden="true">↗</span></Button>
        <p className="mt-3 text-center text-caption text-text-muted">No sign-up. Just your next favorite day.</p>
      </div>
      <aside aria-label="Your trip preview" className="trip-pass relative flex flex-col justify-between overflow-hidden rounded-device border border-line-strong bg-bg-soft p-7 sm:p-8">
        <div className="flex items-center justify-between text-eyebrow text-text-muted"><span>THE FAN DAY PASS</span><span aria-hidden="true">✦</span></div>
        <div className="relative my-7 flex items-center justify-center" aria-hidden="true"><div className="trip-record flex size-56 items-center justify-center rounded-full border border-line-strong sm:size-64"><div className="flex size-24 flex-col items-center justify-center rounded-full bg-text text-bg"><span className="text-title">서울</span><span className="mt-1 text-caption">SIDE : YOU</span></div></div><span className="absolute bottom-2 right-0 rotate-6 rounded-sm border border-line-strong bg-surface px-4 py-3 font-display text-label">FAN MODE<br />ON ↗</span></div>
        <div><p className="text-heading">Less scrolling.<br />More memories.</p><p className="mt-3 max-w-sm text-body-sm text-text-muted">Leave room for an album-store detour and a new favorite corner of Seoul.</p></div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-dashed border-line-strong pt-5"><div><p className="text-caption text-text-muted">WHEN</p><p className="mt-1 text-label">{dayLabel}</p></div><div><p className="text-caption text-text-muted">WHERE</p><p className="mt-1 text-label">Seoul, KR</p></div><div><p className="text-caption text-text-muted">TEMPO</p><p className="mt-1 text-label">{stay} min / stop</p></div></div>
        <p className="mt-5 text-caption text-text-muted">Your planning pass — not an admission ticket.</p>
      </aside>
    </section>}

    {step === 1 && <section aria-label="Pick your spots">
      <div className="flex flex-wrap items-end justify-between gap-4"><label className="block w-full text-label sm:max-w-md">Search places<input className={inputClass} value={query} onChange={e => setQuery(e.target.value)} placeholder="A neighborhood, an album shop, a new memory…" /></label><span className="pb-3 text-caption text-text-muted">{selected.length} / 6 ON YOUR LIST</span></div>
      <p className="mt-4 text-body-sm text-text-muted">Start with these real K-pop places. Birthday-café listings are coming; you can add an organizer’s notice below.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((event, index) => <article key={event.id} className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors ${selected.includes(event.id) ? "border-text" : "border-line-strong"}`}>
          <div aria-hidden="true" className="relative flex h-36 items-center justify-center overflow-hidden border-b border-line-strong bg-surface-2"><span className="absolute left-4 top-4 text-caption text-text-muted">SPOT / {String(index + 1).padStart(2, "0")}</span><span className="font-display text-display text-text-muted">{event.kind === "Album shop" ? "◎" : event.kind === "Public fan landmark" ? "↗" : "✦"}</span><span className="absolute bottom-3 right-4 text-caption text-text-muted">SEOUL COLLECTION</span></div>
          <div className="flex flex-1 flex-col p-5"><div className="flex flex-wrap justify-between gap-2 text-caption text-text-muted"><span>{event.area.toUpperCase()}</span><span>{event.provenance.mode === "personal" ? "YOUR EVENT" : event.kind}</span></div><h2 className="mt-3 text-subhead">{event.title}</h2><p className="mt-2 text-body-sm text-text-muted">{event.opens !== null && event.closes !== null ? `${clock(event.opens)}–${clock(event.closes)}` : "Hours unconfirmed"}{event.closedDays.includes(1) ? " · Closed Mondays" : ""}</p>
            <details className="my-4 text-body-sm"><summary className="cursor-pointer py-2 underline underline-offset-4">Visit details</summary><dl className="mt-3 space-y-2 text-text-muted"><dt className="text-text">DO</dt><dd>{event.do}</dd><dt className="text-text">GET</dt><dd>{event.get}</dd></dl><p className="mt-3 text-caption text-text-muted">{event.from ? `${event.from} — ${event.to}` : "Permanent venue · check exceptions"}<br />{event.address}<br />Source: {event.provenance.author}. Checked {event.provenance.checkedOn}.</p><div className="mt-3 flex flex-wrap gap-4"><a href={event.provenance.url} target="_blank" rel="noopener noreferrer" className="underline">Source notice ↗</a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`} target="_blank" rel="noopener noreferrer" className="underline">Find on map ↗</a></div></details>
            <Button className="mt-auto" variant="ghost" aria-pressed={selected.includes(event.id)} aria-label={`${selected.includes(event.id) ? "Remove" : "Select"} ${event.title}`} onClick={() => { setSelected(ids => ids.includes(event.id) ? ids.filter(id => id !== event.id) : [...ids, event.id]); invalidate(); }} disabled={!selected.includes(event.id) && selected.length >= 6}>{selected.includes(event.id) ? "✓ On my list · Remove" : "+ Add to my day"}</Button>
          </div>
        </article>)}
      </div>
      {!candidates.length && <div className="my-6 rounded-xl border border-dashed border-line-strong p-8 text-center"><p className="text-heading">A little off the map.</p><p className="mt-3 text-text-muted">No places match this search and date. Try another search or add your own event.</p></div>}
      {personal.length > 0 && <details className="mt-5 text-body-sm"><summary className="cursor-pointer py-2">Manage my events ({personal.length}/12)</summary><ul className="mt-3 space-y-2">{personal.map(event => <li className="flex flex-wrap items-center justify-between gap-2" key={event.id}><span>{event.title} · {event.from}</span><Button size="sm" variant="ghost" onClick={() => { setPersonal(items => items.filter(item => item.id !== event.id)); setSelected(ids => ids.filter(id => id !== event.id)); invalidate(); }}>Delete {event.title}</Button></li>)}</ul><p className="mt-2">Save again to update any saved copies.</p></details>}
      {personal.length < 12 && <PersonalEventForm date={date} onAdd={event => { setPersonal(items => [...items, event]); setQuery(""); invalidate(); setNotice("Event added to your private places. Select it to include it in your itinerary."); }} />}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line-strong bg-bg-soft p-4 sm:p-5"><Button variant="ghost" onClick={() => setStep(0)}>← Back to day</Button><div className="flex flex-wrap items-center gap-4"><span className="text-body-sm text-text-muted">{selected.length ? `${selected.length} moments, one day.` : "Pick a spot to start your story."}</span><Button disabled={!selected.length || !!validation || busy} onClick={generate}>Build my itinerary ↗</Button></div></div>
    </section>}

    {step === 2 && result && <section aria-label="Your itinerary" className="grid items-start gap-6 lg:grid-cols-3">
      <aside className="rounded-device border border-line-strong bg-surface p-6 lg:col-span-1"><p className="text-eyebrow text-text-muted">YOUR FAN DAY PASS</p><p className="mt-5 font-display text-title">{dayLabel}<br /><span className="text-text-muted">Seoul, KR</span></p><div className="my-5 border-t border-dashed border-line-strong" /><p className="text-body-sm text-text-muted">{result.stops.length} visits · {date} · Korea time · Opening hours + your travel buffer.</p><p className="mt-4 text-body-sm text-text-muted">{start} — {end}<br />{stay} min to enjoy each stop</p><div className="mt-6 flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => setStep(0)}>Edit day</Button><Button size="sm" variant="ghost" onClick={() => setStep(1)}>Edit spots</Button></div><Button className="mt-5" block disabled={!result.stops.length} onClick={download}>Download itinerary (.txt)</Button><p className="mt-3 text-caption text-text-muted">Keep your setlist close. Save a draft below to come back to it.</p></aside>
      <div className="lg:col-span-2">
        {result.error && <p role="alert">{result.error}</p>}
        {!result.stops.length && <div className="rounded-xl border border-line-strong p-6"><h2 className="text-heading">Let’s remix this day.</h2><p className="mt-3 text-text-muted">These stops don’t fit yet. Try a different time or choose another place.</p></div>}
        <ol className="space-y-4">{result.stops.map((stop, index) => <li key={stop.event.id} className="relative rounded-xl border border-line-strong bg-surface p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><span className="rounded-full border border-line-strong px-3 py-1 text-caption">TRACK {String(index + 1).padStart(2, "0")}</span><span className="font-mono text-label">{clock(stop.arrival)}–{clock(stop.departure)}</span></div><h2 className="mt-4 text-heading">{stop.event.title}</h2><p className="mt-3 text-body-sm text-text-muted">{stop.event.do}</p><a className="mt-4 inline-block text-body-sm underline underline-offset-4" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.event.address)}`} target="_blank" rel="noopener noreferrer">{stop.event.address} ↗</a><p className="mt-4 border-t border-line-strong pt-3 text-caption text-text-muted">{stop.travel ? `${stop.travel} min travel buffer from previous spot` : "Your day starts here"}</p></li>)}</ol>
        {result.omitted.length > 0 && <div className="mt-5 rounded-xl border border-dashed border-line-strong p-5"><h2 className="text-subhead">Couldn’t fit these spots</h2><ul className="mt-3 space-y-3">{result.omitted.map(item => <li key={item.event.id} className="text-body-sm"><b>{item.event.title}</b><p className="text-text-muted">{item.reason}</p></li>)}</ul></div>}
      </div>
    </section>}
    <p className="mt-6 text-caption text-text-muted">Korea time (UTC+9). {transfer} min between stops is your planning buffer, not live routing. Check holiday hours, queues and each journey before you go.</p>
    {notice && <p role="status" className="mt-5 rounded-lg border border-line-strong bg-surface p-4 text-body-sm">{notice}</p>}
    <details className="mt-6 border-t border-line-strong pt-4"><summary className="cursor-pointer py-2 text-label">Saved plans & storage</summary><div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" size="sm" onClick={() => device("save")} disabled={!!validation || busy}>Save on device</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => device("load")}>Restore device draft</Button><Button variant="ghost" size="sm" onClick={() => device("delete")}>Delete device draft</Button></div><p className="mt-3 text-caption text-text-muted">One private draft in this browser. Device save uploads nothing. Clearing browser data removes it.</p>
      {cloudEnabled && <details className="mt-5 rounded-lg border border-line-strong p-5"><summary className="cursor-pointer text-subhead">Optional private cloud draft</summary><p className="mt-3 text-body-sm text-text-muted">Save sends your travel inputs and personal event notes to ULTSPOT’s cloud storage. A guest identifier stays in this browser; no email or password is needed. Clearing the session loses access. One draft is kept until you delete it; use Delete cloud draft before clearing browser data. Do not include personal information in event notes.</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" disabled={busy || !!validation} onClick={() => cloud("save")}>Save cloud draft</Button><Button variant="ghost" disabled={busy} onClick={() => cloud("load")}>Restore cloud draft</Button><Button variant="ghost" disabled={busy} onClick={() => cloud("delete")}>Delete cloud draft</Button></div></details>}
    </details>
  </main>;
}