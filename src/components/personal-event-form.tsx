"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { minutes, type FanEvent } from "@/lib/trip/planner";
import { isPersonalEvent } from "@/lib/trip/storage";

export function PersonalEventForm({ date, onAdd }: { date: string; onAdd: (event: FanEvent) => void }) {
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) ?? "").trim();
    const event: FanEvent = {
      id: `personal-${crypto.randomUUID()}`, title: field("title"), address: field("address"), area: field("area"),
      kind: "Personal event", from: date, to: date, opens: minutes(field("opens")), closes: minutes(field("closes")),
      closedDays: [], reservation: data.get("reservation") === "on", do: field("do"), get: field("get"),
      provenance: { mode: "personal", author: "Entered by you · not independently verified", checkedOn: new Date().toISOString().slice(0, 10), url: field("source") },
    };
    if (!isPersonalEvent(event)) { setError("Check the date, HTTPS source link and opening/closing times. All text fields must be 300 characters or fewer."); return; }
    onAdd(event); form.reset(); setError("");
  }
  const cls = "mt-2 block w-full min-w-0 rounded-sm border border-line-strong bg-bg px-3 py-3 text-body";
  return <details className="mt-6 rounded-xl border border-line-strong p-5">
    <summary className="cursor-pointer text-subhead">Add an event from its notice</summary>
    <p className="mt-3 text-body-sm text-text-muted">For {date || "your selected day"} only. Enter the facts you checked in the organizer’s notice, in your own words. This stays in your private plan and is not published to other visitors. Do not enter names, phone numbers, ticket codes or other personal information.</p>
    <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
      {[{ name: "title", label: "Event name" }, { name: "area", label: "Neighborhood" }, { name: "address", label: "Venue address" }, { name: "source", label: "Organizer notice URL" }].map(f => <label key={f.name} className="text-label">{f.label}<input required name={f.name} type={f.name === "source" ? "url" : "text"} maxLength={f.name === "source" ? 1500 : 300} className={cls} /></label>)}
      <label className="text-label">Opens<input required name="opens" type="time" className={cls} /></label>
      <label className="text-label">Closes<input required name="closes" type="time" className={cls} /></label>
      <label className="text-label">What to do<input name="do" required maxLength={300} className={cls} placeholder="e.g. Order the specified drink" /></label>
      <label className="text-label">What you get<input name="get" required maxLength={300} className={cls} placeholder="e.g. Cup sleeve while supplies last" /></label>
      <label className="flex items-center gap-3 text-body-sm sm:col-span-2"><input name="reservation" type="checkbox" />Timed reservation required (kept out of automatic scheduling)</label>
      {error && <p role="alert" className="text-body-sm text-danger sm:col-span-2">{error}</p>}
      <Button type="submit" variant="ghost">Add to my places</Button>
    </form>
  </details>;
}
