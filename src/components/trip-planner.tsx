"use client";

import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui";
import { clock, minutes, planTrip, runsOn, validateTrip, type FanEvent } from "@/lib/trip/planner";
import { catalog } from "@/lib/trip/catalog";
import { PersonalEventForm } from "@/components/personal-event-form";
import { parseSavedTrip, storageKey, type SavedTrip } from "@/lib/trip/storage";
import { cloudEnabled, cloudTrip } from "@/lib/trip/cloud";

const inputClass = "mt-2 block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-3 py-3 text-body";

export function TripPlanner({ today }: { today: string }) {
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
    setResult(planTrip(events.filter(e => selected.includes(e.id)), input));
    setNotice("");
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
  return <main lang="en" className="shell pb-16">
    <header className="flex items-center justify-between gap-4 py-6">
      <Link href="/" aria-label="ULTSPOT home"><Wordmark /></Link>
      <span className="rounded-full border border-line-strong px-3 py-1 text-caption">YOUR SEOUL PLAN</span>
    </header>
    <section className="border-b border-line-strong py-8">
      <p className="text-eyebrow text-text-muted">YOUR DAY, YOUR FANDOM</p>
      <h1 className="mt-4 text-display">Make room for<br />your favorite moments.</h1>
      <p className="mt-5 text-body text-text-muted">Choose a date, pick your spots, and build a day that fits.</p>
      <p className="mt-5 rounded-md border border-line-strong bg-surface p-4 text-body-sm">
        Real places, linked to their sources. Korea time (UTC+9). Check holiday hours before visiting.
        Current birthday-café listings are not yet available. You can add an event from an organizer’s notice to your private plan below.
      </p>
    </section>
    <div className="grid gap-8 py-8 lg:grid-cols-3">
      <section className="min-w-0 lg:col-span-1" aria-labelledby="day-heading">
        <h2 id="day-heading" className="text-subhead">01 / Set your day</h2>
        <div className="mt-5 rounded-xl border border-line-strong bg-surface p-5">
          <label className="block text-label">Travel date<input className={inputClass} type="date" value={date} onChange={e => { setDate(e.target.value); setSelected([]); invalidate(); }} /></label>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-1">
            <label className="min-w-0 text-label">Start time<input className={inputClass} type="time" value={start} onChange={e => { setStart(e.target.value); invalidate(); }} /></label>
            <label className="min-w-0 text-label">End time<input className={inputClass} type="time" value={end} onChange={e => { setEnd(e.target.value); invalidate(); }} /></label>
          </div>
          <label className="mt-5 block text-label">Time at each spot<select className={inputClass} value={stay} onChange={e => { setStay(Number(e.target.value)); invalidate(); }}>
            {[30, 60, 90, 120].map(n => <option key={n} value={n}>{n} minutes</option>)}
          </select></label>
          <label className="mt-5 block text-label">Travel buffer between spots<select className={inputClass} value={transfer} onChange={e => { setTransfer(Number(e.target.value)); invalidate(); }}>{[15, 30, 45, 60, 90, 120].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
          {validation && <p role="alert" className="mt-4 text-body-sm text-danger">{validation}</p>}
          <p className="mt-5 text-body-sm text-text-muted">Start at your first spot. Your travel buffer is a planning allowance, not a route estimate. Check each journey in your map app. Queues and holiday changes are not known.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => device("save")} disabled={!!validation}>Save on device</Button>
            <Button variant="ghost" size="sm" onClick={() => device("load")}>Restore device draft</Button>
            <Button variant="ghost" size="sm" onClick={() => device("delete")}>Delete device draft</Button>
          </div>
          <p className="mt-3 text-caption text-text-muted">Device save replaces one private draft in this browser. Clearing browser data removes it. Nothing is uploaded by these buttons.</p>
        </div>
      </section>
      <section className="min-w-0 lg:col-span-2" aria-labelledby="spots-heading">
        <h2 id="spots-heading" className="text-subhead">02 / Pick your spots <span className="text-text-muted">· {selected.length} selected</span></h2>
        <label className="mt-4 block text-label">Search places<input className={inputClass} value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, neighborhood, or experience" /></label>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {candidates.map((event, index) => <article key={event.id} className="flex flex-col rounded-xl border border-line-strong bg-surface p-5">
            <div className="flex items-center justify-between gap-2 text-caption text-text-muted"><span>{event.area.toUpperCase()}</span><span>0{index + 1} / {event.provenance.mode === "personal" ? "YOUR EVENT" : "REAL PLACE"}</span></div>
            <h3 className="mt-5 text-subhead">{event.title}</h3>
            <p className="mt-2 text-body-sm text-text-muted">{event.kind} · {event.opens !== null && event.closes !== null ? `${clock(event.opens)}–${clock(event.closes)}` : "Hours unconfirmed"}{event.closedDays.includes(1) ? " · Closed Mondays" : ""}</p>
            <details className="my-5 text-body-sm">
              <summary className="cursor-pointer underline underline-offset-4">Visit details</summary>
              <dl className="mt-3 space-y-2 text-text-muted"><dt className="text-text">DO</dt><dd>{event.do}</dd><dt className="text-text">GET</dt><dd>{event.get}</dd></dl>
              <p className="mt-3 text-caption text-text-muted">{event.from ? `${event.from} — ${event.to}` : "Permanent venue · check exceptions"}<br />{event.address}<br />Source: {event.provenance.author}. Checked {event.provenance.checkedOn}.</p>
              <div className="mt-3 flex flex-wrap gap-4"><a href={event.provenance.url} target="_blank" rel="noopener noreferrer" className="underline">Source notice ↗</a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`} target="_blank" rel="noopener noreferrer" className="underline">Find on map ↗</a></div>
            </details>
            <Button className="mt-auto" variant="ghost" aria-pressed={selected.includes(event.id)} aria-label={`${selected.includes(event.id) ? "Remove" : "Select"} ${event.title}`} onClick={() => {
              setSelected(ids => ids.includes(event.id) ? ids.filter(id => id !== event.id) : [...ids, event.id]); invalidate();
            }} disabled={!selected.includes(event.id) && selected.length >= 6}>{selected.includes(event.id) ? "✓ Selected · Remove" : "+ Add to my day"}</Button>
          </article>)}
        </div>
        {personal.length > 0 && <details className="mt-4 text-body-sm"><summary className="cursor-pointer">Manage my events ({personal.length}/12)</summary><ul className="mt-3 space-y-2">{personal.map(event => <li className="flex flex-wrap items-center justify-between gap-2" key={event.id}><span>{event.title} · {event.from}</span><Button size="sm" variant="ghost" onClick={() => { setPersonal(items => items.filter(item => item.id !== event.id)); setSelected(ids => ids.filter(id => id !== event.id)); invalidate(); }}>Delete {event.title}</Button></li>)}</ul><p className="mt-2">Save again to update any saved copies.</p></details>}
        {personal.length < 12 && <PersonalEventForm date={date} onAdd={event => { setPersonal(items => [...items, event]); setQuery(""); invalidate(); setNotice("Event added to your private places. Select it to include it in your itinerary."); }} />}
        {!candidates.length && <p className="mt-5">No places match this search and date. Try another search or add your own event.</p>}
        <Button className="mt-6" block disabled={!selected.length || !!validation} onClick={generate}>Build my itinerary</Button>
      </section>
    </div>
    <section aria-live="polite" aria-labelledby="plan-heading" className="border-t border-line-strong pt-8">
      <h2 id="plan-heading" className="text-title">03 / Your day, connected</h2>
      {!result && <p className="mt-4 text-body text-text-muted">Your itinerary will appear here. Pick a few spots above to get started.</p>}
      {result && <>
        <p className="mt-4 text-body text-text-muted">{result.stops.length} visits · {date} · Korea time · Opening hours + your travel buffer.</p>
        {result.error && <p role="alert">{result.error}</p>}
        <ol className="mt-5 space-y-3">{result.stops.map(stop => <li key={stop.event.id} className="rounded-lg border border-line-strong bg-surface p-5">
          <p className="text-caption text-text-muted">{stop.travel ? `${stop.travel} min travel buffer from previous spot` : "Start here"}</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-4"><span className="font-mono text-subhead">{clock(stop.arrival)}–{clock(stop.departure)}</span><h3 className="text-subhead">{stop.event.title}</h3></div>
          <p className="mt-2 text-body-sm text-text-muted">{stop.event.area} · {stop.event.do}</p>
          <a className="mt-3 inline-block text-body-sm underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.event.address)}`} target="_blank" rel="noopener noreferrer">{stop.event.address} ↗</a>
        </li>)}</ol>
        {result.omitted.length > 0 && <div className="mt-5 rounded-lg border border-line-strong p-5"><h3 className="text-subhead">Couldn’t fit these spots</h3><ul className="mt-3 space-y-3">{result.omitted.map(item => <li key={item.event.id} className="text-body-sm"><b>{item.event.title}</b><p className="text-text-muted">{item.reason}</p></li>)}</ul></div>}
        <p className="mt-5 text-body-sm text-text-muted">To adjust your day, change the times or selected spots above, then build again.</p>
        <Button variant="ghost" className="mt-4" disabled={!result.stops.length} onClick={download}>Download itinerary (.txt)</Button>
      </>}
      {notice && <p role="status" className="mt-4 text-body-sm">{notice}</p>}
      {cloudEnabled && <details className="mt-6 rounded-lg border border-line-strong p-5"><summary className="cursor-pointer text-subhead">Optional private cloud draft</summary><p className="mt-3 text-body-sm text-text-muted">Save sends your travel inputs and personal event notes to ULTSPOT’s Supabase project. A guest identifier is stored in this browser; no email or password is needed. Clearing the session loses access. One draft is kept until you delete it; use Delete cloud draft before clearing browser data. Do not include personal information in event notes.</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" disabled={busy || !!validation} onClick={() => cloud("save")}>Save cloud draft</Button><Button variant="ghost" disabled={busy} onClick={() => cloud("load")}>Restore cloud draft</Button><Button variant="ghost" disabled={busy} onClick={() => cloud("delete")}>Delete cloud draft</Button></div></details>}
    </section>
  </main>;
}
