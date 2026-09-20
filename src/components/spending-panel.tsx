"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui";
import { CloseIcon } from "@/components/icons";
import { useI18n } from "@/i18n/locale";
import { intlLocale } from "@/i18n/config";
import { addSpend, removeSpend, type Journey } from "@/lib/trip/journey";
import { formatKrw, spendingByDay, spendingByPlace, spendingTotal } from "@/lib/trip/spending";

/**
 * 가계부. 계정 없이 이 브라우저의 여정 스냅샷에만 기록한다.
 *
 * 합계는 저장하지 않고 항목에서 매번 센다. 원 단위 정수만 받고, 환산을 만들지 않는다.
 * 장소를 고르지 않은 지출은 아무 장소에 붙이지 않고 "장소 없음"으로 둔다.
 */

/** 금액 입력 한 벌. 방문 줄 안에서도, 아래 패널에서도 같은 검사를 쓴다. */
export function SpendInput({ onAdd, notice, withNote = true, placeOptions }: {
  onAdd: (amountKrw: number, label?: string, placeId?: string) => void;
  notice: (message: string) => void;
  withNote?: boolean;
  /** 있으면 장소 선택을 보여준다. 첫 항목은 언제나 "장소 없음"이다. */
  placeOptions?: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const id = useId();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [placeId, setPlaceId] = useState("");

  function submit() {
    const value = Number(amount);
    // 1원 이상 정수만. 소수·음수·빈칸을 조용히 0으로 바꾸지 않는다.
    if (!Number.isInteger(value) || value < 1 || value > 100_000_000) { notice(t.records.spendInvalid); return; }
    onAdd(value, note.trim() === "" ? undefined : note.trim(), placeId === "" ? undefined : placeId);
    setAmount(""); setNote("");
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label htmlFor={`${id}-amount`} className="text-caption text-text-muted">{t.records.spendAmount}
        <input id={`${id}-amount`} type="number" inputMode="numeric" min={1} step={1} value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          className="mt-1 block w-28 min-h-11 rounded-sm border border-line-strong bg-bg px-2 text-body-sm" />
      </label>
      {withNote && <label htmlFor={`${id}-note`} className="min-w-0 flex-1 text-caption text-text-muted">{t.records.spendNote}
        <input id={`${id}-note`} type="text" maxLength={80} value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          className="mt-1 block w-full min-w-0 min-h-11 rounded-sm border border-line-strong bg-bg px-2 text-body-sm" />
      </label>}
      {placeOptions && <label htmlFor={`${id}-place`} className="min-w-0 text-caption text-text-muted">{t.records.byPlace}
        <select id={`${id}-place`} value={placeId} onChange={e => setPlaceId(e.target.value)}
          className="mt-1 block min-h-11 max-w-[14rem] rounded-sm border border-line-strong bg-bg px-2 text-body-sm">
          <option value="">{t.records.noPlace}</option>
          {placeOptions.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}
        </select>
      </label>}
      <Button size="sm" variant="primary" onClick={submit}>{t.records.spendAdd}</Button>
    </div>
  );
}

export function SpendingPanel({ journey, onChange, activeDate, placeName, notice }: {
  journey: Journey;
  onChange: (next: Journey) => void;
  activeDate: string;
  placeName: (placeId: string) => string;
  notice: (message: string) => void;
}) {
  const { locale: uiLocale, t } = useI18n();
  const money = (amountKrw: number) => formatKrw(amountKrw, intlLocale[uiLocale]);
  const byDay = spendingByDay(journey);
  const byPlace = spendingByPlace(journey);
  const total = spendingTotal(journey);
  const today = byDay.find(day => day.date === activeDate);
  const dayEntries = journey.spend.filter(entry => entry.on === activeDate);

  const dayPlaces = (journey.days.find(day => day.date === activeDate)?.visits ?? [])
    .map(visit => ({ id: visit.placeId, name: placeName(visit.placeId) }))
    .filter((place, index, list) => list.findIndex(p => p.id === place.id) === index);

  function add(amountKrw: number, label?: string, placeId?: string) {
    try {
      onChange(addSpend(journey, { id: `spend-${crypto.randomUUID()}`, on: activeDate, amountKrw, label, placeId }));
    } catch (error) {
      notice(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <section aria-label={t.records.spendLegend} className="mt-4 rounded-xl border border-line-strong p-4 sm:p-5">
      <h2 className="text-label">{t.records.spendLegend}</h2>
      <p className="mt-1 text-caption text-text-muted">{t.records.currencyNote}</p>

      <div className="mt-3">
        <SpendInput onAdd={add} notice={notice} placeOptions={dayPlaces.length > 0 ? dayPlaces : undefined} />
      </div>

      <p role="status" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption">
        <span className="text-text">{t.records.dayTotal(money(today?.totalKrw ?? 0))}</span>
        <span className="text-text-muted">{t.records.tripTotal(money(total.totalKrw))}</span>
        <span className="text-text-muted">{t.records.entryCount(total.entries)}</span>
      </p>

      {dayEntries.length === 0
        ? <p className="mt-3 text-caption text-text-muted">{t.records.spendEmpty}</p>
        : <ul className="mt-3 space-y-2">
            {dayEntries.map(entry => <li key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-strong px-3 py-2">
              <span className="min-w-0 text-body-sm">
                <span className="font-mono">{money(entry.amountKrw)}</span>
                {entry.label && <span className="ml-2 text-text-muted">{entry.label}</span>}
                <span className="ml-2 text-caption text-text-faint">
                  {entry.placeId ? placeName(entry.placeId) : t.records.noPlace}
                </span>
              </span>
              <Button size="sm" variant="ghost" aria-label={`${t.records.spendRemove}: ${money(entry.amountKrw)}`}
                onClick={() => onChange(removeSpend(journey, entry.id))}>
                <CloseIcon />
              </Button>
            </li>)}
          </ul>}

      {total.entries > 0 && <div className="mt-4 grid gap-4 border-t border-line-strong pt-4 sm:grid-cols-2">
        <div>
          <h3 className="text-caption text-text-muted">{t.records.byDay}</h3>
          {/* 지출이 없는 날은 넣지 않는다. 0원 쓴 날과 기록하지 않은 날을 같게 보이지 않게 한다. */}
          <ul className="mt-2 space-y-1 text-body-sm">
            {byDay.map(day => <li key={day.date} className="flex justify-between gap-3">
              <span className="text-text-muted">{day.date}</span>
              <span className="font-mono">{money(day.totalKrw)}</span>
            </li>)}
          </ul>
        </div>
        <div>
          <h3 className="text-caption text-text-muted">{t.records.byPlace}</h3>
          <ul className="mt-2 space-y-1 text-body-sm">
            {byPlace.map(place => <li key={place.placeId ?? "none"} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-text-muted">
                {place.placeId ? placeName(place.placeId) : t.records.noPlace}
              </span>
              <span className="font-mono">{money(place.totalKrw)}</span>
            </li>)}
          </ul>
        </div>
      </div>}

      <p className="mt-4 text-caption text-text-faint">{t.records.storedHere}</p>
    </section>
  );
}
