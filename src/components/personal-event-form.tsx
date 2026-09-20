"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/locale";
import { minutes, type FanEvent } from "@/lib/trip/planner";
import { isPersonalEvent } from "@/lib/trip/storage";

const TEXT_FIELDS = ["title", "area", "address", "do", "get"] as const;
type FieldName = (typeof TEXT_FIELDS)[number] | "source" | "opens" | "closes";

/**
 * 공지를 보고 사용자가 직접 넣는 행사. 저장 전 검사는 lib의 isPersonalEvent가 최종 관문이고,
 * 여기서는 "어느 칸이 왜 틀렸는지"를 칸 옆에 보여주기 위해 같은 조건을 미리 확인한다.
 */
export function PersonalEventForm({ date, onAdd, requestOpen = 0 }: { date: string; onAdd: (event: FanEvent) => void; requestOpen?: number }) {
  const { t } = useI18n();
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [summary, setSummary] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const firstField = useRef<HTMLInputElement>(null);

  // 빈 상태의 "공지 보고 행사 추가"에서 이 폼을 직접 열어 준다.
  useEffect(() => {
    if (!requestOpen || !details.current) return;
    details.current.open = true;
    details.current.scrollIntoView({ block: "center", behavior: "smooth" });
    firstField.current?.focus({ preventScroll: true });
  }, [requestOpen]);

  function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const form = submitEvent.currentTarget;
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) ?? "").trim();
    const found: Partial<Record<FieldName, string>> = {};
    for (const name of TEXT_FIELDS) {
      if (!field(name)) found[name] = t.event.errors.required;
      else if (field(name).length > 300) found[name] = t.event.errors.tooLong;
    }
    const source = field("source");
    if (!source) found.source = t.event.errors.required;
    else if (!/^https:\/\/\S+$/i.test(source) || source.length > 1500) found.source = t.event.errors.url;
    const opens = minutes(field("opens"));
    const closes = minutes(field("closes"));
    if (Number.isNaN(opens)) found.opens = t.event.errors.time;
    if (Number.isNaN(closes)) found.closes = t.event.errors.time;
    else if (!Number.isNaN(opens) && closes <= opens) found.closes = t.event.errors.order;

    const event: FanEvent = {
      id: `personal-${crypto.randomUUID()}`, title: field("title"), address: field("address"), area: field("area"),
      kind: "Personal event", from: date, to: date, opens, closes,
      closedDays: [], reservation: data.get("reservation") === "on", do: field("do"), get: field("get"),
      provenance: { mode: "personal", author: "Entered by you · not independently verified", checkedOn: new Date().toISOString().slice(0, 10), url: source },
    };
    const count = Object.keys(found).length;
    if (count) {
      setErrors(found);
      setSummary(t.event.errors.summary(count));
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    if (!isPersonalEvent(event)) { setErrors({}); setSummary(t.event.errors.invalid); return; }
    onAdd(event);
    form.reset();
    setErrors({});
    setSummary("");
  }

  const inputClass = "mt-2 block w-full min-w-0 rounded-sm border bg-bg px-3 py-3 text-body";
  const border = (name: FieldName) => (errors[name] ? "border-danger" : "border-line-strong");
  const describedBy = (name: FieldName) => (errors[name] ? `${name}-error` : undefined);
  const fieldError = (name: FieldName) =>
    errors[name] ? <span id={`${name}-error`} className="mt-1 block text-caption text-danger">{errors[name]}</span> : null;

  return <details ref={details} className="mt-6 rounded-xl border border-line-strong p-5">
    <summary className="min-h-11 cursor-pointer py-2 text-subhead">{t.spots.addFromNotice}</summary>
    <p className="mt-3 text-body-sm text-text-muted">{t.event.intro(date || "—")}</p>
    <form onSubmit={submit} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
      {([
        { name: "title", label: t.event.fields.title },
        { name: "area", label: t.event.fields.area },
        { name: "address", label: t.event.fields.address },
        { name: "source", label: t.event.fields.source },
      ] as const).map((field, index) => (
        <label key={field.name} className="text-label">{field.label}
          <input ref={index === 0 ? firstField : undefined} name={field.name} type={field.name === "source" ? "url" : "text"}
            maxLength={field.name === "source" ? 1500 : 300} aria-invalid={!!errors[field.name]} aria-describedby={describedBy(field.name)}
            className={`${inputClass} ${border(field.name)}`} />
          {fieldError(field.name)}
        </label>
      ))}
      <label className="text-label">{t.event.fields.opens}
        <input name="opens" type="time" aria-invalid={!!errors.opens} aria-describedby={describedBy("opens")} className={`${inputClass} ${border("opens")}`} />
        {fieldError("opens")}
      </label>
      <label className="text-label">{t.event.fields.closes}
        <input name="closes" type="time" aria-invalid={!!errors.closes} aria-describedby={describedBy("closes")} className={`${inputClass} ${border("closes")}`} />
        {fieldError("closes")}
      </label>
      <label className="text-label">{t.event.fields.do}
        <input name="do" maxLength={300} placeholder={t.event.placeholders.do} aria-invalid={!!errors.do} aria-describedby={describedBy("do")}
          className={`${inputClass} ${border("do")}`} />
        {fieldError("do")}
      </label>
      <label className="text-label">{t.event.fields.get}
        <input name="get" maxLength={300} placeholder={t.event.placeholders.get} aria-invalid={!!errors.get} aria-describedby={describedBy("get")}
          className={`${inputClass} ${border("get")}`} />
        {fieldError("get")}
      </label>
      <label className="flex items-center gap-3 text-body-sm sm:col-span-2">
        <input name="reservation" type="checkbox" className="size-5" />{t.event.reservation}
      </label>
      {summary && <p role="alert" className="text-body-sm text-danger sm:col-span-2">{summary}</p>}
      <Button type="submit" variant="ghost">{t.event.submit}</Button>
    </form>
  </details>;
}
