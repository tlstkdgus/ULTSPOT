/**
 * 여행 지출 합계. 계정 없이 브라우저 안에서만 계산하고 저장한다.
 *
 * 원(KRW) 정수만 다룬다. 환율·다중 통화를 만들지 않은 이유는 문서에 요구사항이 없고,
 * 환산율을 임의로 정하면 화면의 숫자가 사실이 아닌 값이 되기 때문이다. 단위는 이름에 박아 둔다.
 *
 * 합계는 저장하지 않고 항목에서 매번 센다. 저장된 합계와 항목이 어긋날 경로를 만들지 않는다.
 */

import type { Journey, Spend } from "./journey";

export type DayTotal = { date: string; totalKrw: number; entries: number };
export type PlaceTotal = { placeId: string | null; totalKrw: number; entries: number };
export type SpendingTotal = { totalKrw: number; entries: number; days: number; places: number };

const entries = (journey: Pick<Journey, "spend">): Spend[] => journey.spend ?? [];

/** 날짜순. 지출이 없는 날은 넣지 않는다 — 0원과 "쓰지 않음"을 구분한다. */
export function spendingByDay(journey: Pick<Journey, "spend">): DayTotal[] {
  const totals = new Map<string, DayTotal>();
  for (const item of entries(journey)) {
    const day = totals.get(item.on) ?? { date: item.on, totalKrw: 0, entries: 0 };
    day.totalKrw += item.amountKrw;
    day.entries += 1;
    totals.set(item.on, day);
  }
  return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 많이 쓴 곳부터. 장소를 적지 않은 지출은 `placeId: null` 한 묶음으로 마지막에 둔다.
 * 어디에 썼는지 모르는 돈을 아무 장소에 붙이지 않는다.
 */
export function spendingByPlace(journey: Pick<Journey, "spend">): PlaceTotal[] {
  const totals = new Map<string, PlaceTotal>();
  for (const item of entries(journey)) {
    const key = item.placeId ?? "";
    const place = totals.get(key) ?? { placeId: item.placeId ?? null, totalKrw: 0, entries: 0 };
    place.totalKrw += item.amountKrw;
    place.entries += 1;
    totals.set(key, place);
  }
  return [...totals.values()].sort((a, b) => {
    if ((a.placeId === null) !== (b.placeId === null)) return a.placeId === null ? 1 : -1;
    return b.totalKrw - a.totalKrw || (a.placeId ?? "").localeCompare(b.placeId ?? "");
  });
}

export function spendingTotal(journey: Pick<Journey, "spend">): SpendingTotal {
  const list = entries(journey);
  return {
    totalKrw: list.reduce((sum, item) => sum + item.amountKrw, 0),
    entries: list.length,
    days: new Set(list.map(item => item.on)).size,
    places: new Set(list.flatMap(item => (item.placeId ? [item.placeId] : []))).size,
  };
}

/**
 * 원화 표기. 원은 소수 단위가 없으므로 자리수를 0으로 고정한다.
 * Intl을 쓸 수 없는 환경에서도 숫자를 잃지 않게 천 단위 구분만 넣어 돌려준다.
 */
export function formatKrw(amountKrw: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency: "KRW", minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amountKrw);
  } catch {
    return `₩${amountKrw.toLocaleString("en-US")}`;
  }
}
