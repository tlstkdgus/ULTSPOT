/**
 * 한국관광공사 국문 관광정보(TourAPI 4.0, KorService2). **서버에서만** import한다. 키는 TOUR_API_KEY.
 *
 * 왜 쓰나: 카카오 장소 검색에는 영업시간이 없다. 빈 시간 추천(T-049)이 전부 "영업시간 미확인"이라
 * 문 닫은 가게를 권할 수 있었다. TourAPI는 음식점·관광지·문화시설의 이용시간과 쉬는 날을 준다.
 *
 * 경계:
 *  - 원문은 사람이 쓴 자유 문장이다("11:30~22:00 (21:20 라스트오더)", "하절기(4월~10월) 09:00~21:00").
 *    **확실히 읽히는 형식만** 시간으로 쓴다. 계절·요일별로 다르거나 "점포별 상이", 예약 필수 같은
 *    문장이 있으면 시간을 모른다고 둔다(null). 틀린 시간을 확정처럼 보여주는 것보다 낫다.
 *  - 공휴일·명절 휴무("설·추석 당일")는 날짜를 판정하지 않는다. 원문을 note로 넘겨 화면이 보여준다.
 *  - 원문이 언제 고쳐졌는지(modifiedtime)를 함께 넘긴다. 공공데이터도 낡는다.
 *
 * 문서: https://www.data.go.kr (한국관광공사_국문 관광정보 서비스_GW) · 활용매뉴얼
 * 한도: 기능별 하루 1,000회(개발계정). 호출하는 쪽(api/recommend)이 캐시와 일일 상한을 둔다.
 */

import { isKoreanCoord, mapLinks, roundCoord, straightLineMeters, type Coord } from "@/lib/trip/geo";
import type { Suggestion, SuggestionKind } from "./nearby";
import { tourPhoto } from "./photo";

export const TOUR_PROVIDER = "한국관광공사 TourAPI";
const BASE = "https://apis.data.go.kr/B551011/KorService2";
/** data.go.kr은 느릴 때 한 건에 5초를 넘긴다(2026-09-24 관광지 조회 7.1초 실측). 서버 전체 마감(9초) 안에 둔다. */
const TIMEOUT_MS = 6_000;
/** 음식점 중 카페/전통찻집. 나머지 음식점(39)은 식사로 본다. */
const CAFE_CAT3 = "A05020900";
/** 종류별 콘텐츠 타입. 12 관광지 · 14 문화시설 · 39 음식점. */
const CONTENT_TYPES: Record<SuggestionKind, string[]> = { meal: ["39"], cafe: ["39"], sightseeing: ["12", "14"] };

export const tourKey = () => process.env.TOUR_API_KEY?.trim() || "";
export const isTourConfigured = () => Boolean(tourKey());

/** 확인된 영업 정보. 분 단위(0–1440), closedDays는 0=일요일. */
export type PlaceHours = {
  opens: number;
  /** 마지막 주문·입장 마감이 있으면 그 시각. 그 뒤에 도착하면 의미가 없다. */
  closes: number;
  /** 준비시간(브레이크 타임). 이 안에는 도착하지도 머무르지도 않는다. */
  breaks: [number, number][];
  closedDays: number[];
  /** 날짜로 판정하지 않은 휴무(명절·공휴일 등) 원문. 없으면 빈 문자열. */
  note: string;
  source: string;
  /** 원문 수정일 YYYY-MM-DD. 모르면 빈 문자열. */
  modified: string;
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const HOLIDAY_WORDS = /설|추석|명절|공휴일|1월\s*1일|신정|연휴/;
/** 이런 말이 있으면 시간이 날·계절·점포마다 다르다는 뜻이다. 읽지 않는다. */
const UNSURE_WORDS = /하절기|동절기|계절|상이|문의|참조|예약|공연|전시마다|프로그램|평일\s*\d|주말\s*\d|[월화수목금토일]\s*(요일)?\s*[~\-]\s*[월화수목금토일]|[월화수목금토일]요일\s*\d/;

const clean = (text: string) => text.replace(/\ufeff/g, "").replace(/<br\s*\/?>/gi, "\n").replace(/&nbsp;/g, " ").trim();
const toMinutes = (h: string, m: string) => Number(h) * 60 + Number(m);
const RANGE = /(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/g;

/**
 * 이용시간 원문 → 여는·닫는 시각과 준비시간. 확실히 읽히지 않으면 null.
 *
 * 받는 것: "11:00~22:00", "- 11:30~21:00<br>- 준비시간 15:00~17:00<br>- 마지막 주문 20:30",
 *          "11:30~22:00 (21:20 라스트오더)", "10:00~17:00 (입장마감 16:30)", "상시 개방", "24시간"
 * 안 받는 것: 계절·요일별 시간, "점포 별로 상이함", "※ 사전 예약 필수", 시간 범위가 둘 이상인 문장
 */
export function parseOpeningHours(raw: string): Pick<PlaceHours, "opens" | "closes" | "breaks"> | null {
  const text = clean(raw);
  if (!text) return null;
  if (/^(상시\s*개방|24\s*시간)$/.test(text)) return { opens: 0, closes: 1440, breaks: [] };
  // "※ 재료 소진 시 조기 마감"은 시간을 바꾸지 않는다. 그 외의 ※ 단서는 모르는 조건이다.
  const withoutSoldOut = text.replace(/※\s*재료\s*소진[^\n]*/g, "");
  if (/※/.test(withoutSoldOut) || UNSURE_WORDS.test(withoutSoldOut)) return null;

  const breaks: [number, number][] = [];
  let lastCall: number | null = null;
  const main: [number, number][] = [];
  for (const line of withoutSoldOut.split("\n").map(l => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean)) {
    const lastOrder = line.match(/(?:마지막\s*주문|라스트\s*오더|L\.?\s*O\.?|입장\s*마감)\s*(\d{1,2}):(\d{2})/i)
      ?? line.match(/(\d{1,2}):(\d{2})\s*(?:마지막\s*주문|라스트\s*오더|입장\s*마감)/);
    const ranges = [...line.matchAll(RANGE)].map(m => [toMinutes(m[1], m[2]), toMinutes(m[3], m[4])] as [number, number]);
    if (/준비\s*시간|브레이크/.test(line)) {
      if (ranges.length !== 1) return null;
      breaks.push(ranges[0]);
      continue;
    }
    if (lastOrder) lastCall = toMinutes(lastOrder[1], lastOrder[2]);
    main.push(...ranges);
    // 시간도 마감도 아닌 줄은 모르는 조건이다.
    if (!ranges.length && !lastOrder) return null;
  }
  if (main.length !== 1) return null;
  const [opens, rawCloses] = main[0];
  if (opens >= 1440) return null;
  // 자정을 넘기면 그날 안에서는 끝까지 연다.
  const closes = rawCloses <= opens || rawCloses > 1440 ? 1440 : rawCloses;
  const effective = lastCall !== null && lastCall > opens && lastCall < closes ? lastCall : closes;
  if (breaks.some(([from, to]) => from >= to || from < opens || to > effective)) return null;
  return { opens, closes: effective, breaks };
}

/**
 * 쉬는 날 원문 → 요일 휴무와 판정하지 않은 휴무 원문. 확실히 읽히지 않으면 null.
 *
 * 받는 것: "연중무휴", "매주 화요일", "매주 월요일~수요일", "매주 일요일, 월요일 정기휴무",
 *          "매주 일요일 / 설·추석 연휴"(요일은 판정, 명절은 note), "설·추석 당일"
 */
export function parseClosedDays(raw: string): Pick<PlaceHours, "closedDays" | "note"> | null {
  const text = clean(raw).replace(/\n/g, " ");
  if (!text) return null;
  if (/상이|문의|참조/.test(text)) return null;
  const days = new Set<number>();
  let rest = text;
  for (const m of text.matchAll(/매주\s*([월화수목금토일])요일\s*~\s*([월화수목금토일])요일/g)) {
    const from = WEEKDAYS.indexOf(m[1]); const to = WEEKDAYS.indexOf(m[2]);
    for (let d = from; ; d = (d + 1) % 7) { days.add(d); if (d === to) break; }
    rest = rest.replace(m[0], "");
  }
  for (const m of rest.matchAll(/매주\s*((?:[월화수목금토일]요일\s*[,·]?\s*)+)/g)) {
    for (const d of m[1].matchAll(/([월화수목금토일])요일/g)) days.add(WEEKDAYS.indexOf(d[1]));
    rest = rest.replace(m[0], "");
  }
  rest = rest.replace(/연중\s*무휴|정기\s*휴무|휴무|휴관|[/,·()]/g, " ").trim();
  // 공휴일·명절은 날짜 판정을 하지 않고 원문을 넘긴다. "(단, 월요일이 공휴일일 경우 익일 휴관)"도 여기로 간다.
  if (rest && !HOLIDAY_WORDS.test(rest)) return null;
  return { closedDays: [...days].sort(), note: rest ? text : "" };
}

const HOURS_FIELDS: Record<string, [string, string]> = {
  "39": ["opentimefood", "restdatefood"],
  "12": ["usetime", "restdate"],
  "14": ["usetimeculture", "restdateculture"],
};

/** detailIntro2 한 건 → 영업 정보. 시간이나 쉬는 날 중 하나라도 확실하지 않으면 null. */
export function parseTourIntro(item: Record<string, unknown>, contentTypeId: string, modified = ""): PlaceHours | null {
  const fields = HOURS_FIELDS[contentTypeId];
  if (!fields) return null;
  const hours = parseOpeningHours(String(item[fields[0]] ?? ""));
  const closed = parseClosedDays(String(item[fields[1]] ?? ""));
  if (!hours || !closed) return null;
  return { ...hours, ...closed, source: TOUR_PROVIDER, modified };
}

const modifiedDate = (value: unknown) => {
  const text = String(value ?? "");
  return /^\d{8}/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}` : "";
};

/** 외부 호출 공통. 실패는 던지지 않고 null이다. 키는 URL에만 싣고 응답·로그로 내보내지 않는다. */
async function call(operation: string, params: Record<string, string>, signal?: AbortSignal): Promise<Record<string, unknown>[] | null> {
  const key = tourKey();
  if (!key) return null;
  const url = new URL(`${BASE}/${operation}`);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("MobileOS", "ETC");
  url.searchParams.set("MobileApp", "ULTSPOT");
  url.searchParams.set("_type", "json");
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, deadline]) : deadline, cache: "no-store" });
    if (!response.ok) return null;
    const body = await response.json() as { response?: { header?: { resultCode?: string }; body?: { items?: { item?: unknown } | "" } } };
    if (body.response?.header?.resultCode !== "0000") return null;
    const items = body.response.body?.items;
    const list = items && typeof items === "object" ? items.item : [];
    return (Array.isArray(list) ? list : list ? [list] : []).filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  } catch {
    return null;
  }
}

/** TourAPI 후보가 영업 정보를 받으러 갈 때 쓰는 값. 화면으로는 나가지 않는다. */
export type TourRef = { contentId: string; contentTypeId: string; modified: string };

/** 위치기반 목록 한 줄 → 후보. 종류에 맞지 않거나 좌표가 이상하면 버린다. */
export function parseTourRow(row: Record<string, unknown>, kind: SuggestionKind, anchor: Coord, radius: number): (Suggestion & { tour: TourRef }) | null {
  const coord = { lat: Number(row.mapy), lng: Number(row.mapx) };
  const contentId = String(row.contentid ?? "");
  const contentTypeId = String(row.contenttypeid ?? "");
  const name = typeof row.title === "string" ? row.title.trim() : "";
  if (!isKoreanCoord(coord) || !/^\d+$/.test(contentId) || !name || !HOURS_FIELDS[contentTypeId]) return null;
  const isCafe = row.cat3 === CAFE_CAT3;
  if (kind === "cafe" && !isCafe) return null;
  if (kind === "meal" && isCafe) return null;
  const meters = Number.isFinite(Number(row.dist)) && row.dist !== undefined && row.dist !== "" ? Number(row.dist) : straightLineMeters(anchor, coord);
  if (meters > radius) return null;
  const address = [row.addr1, row.addr2].filter(v => typeof v === "string" && v.trim()).join(" ").slice(0, 300);
  const label = kind === "meal" ? "음식점" : kind === "cafe" ? "카페" : contentTypeId === "14" ? "문화시설" : "관광지";
  return {
    id: `tour-${contentId}`, kind, name: name.slice(0, 120), category: `${label} (한국관광공사)`,
    address, coord: roundCoord(coord), straightMeters: Math.round(meters),
    evidence: "nearby", hoursKnown: false, hours: null, provider: TOUR_PROVIDER,
    photo: tourPhoto(row.firstimage, row.cpyrhtDivCd),
    // 화면의 링크 문구가 "카카오맵에서 보기"라 카카오 지도 좌표 링크를 쓴다. 같은 가게가 카카오 후보에도 있으면
    // 합칠 때 카카오 장소 페이지로 바뀐다(route.ts mergeCandidates).
    placeUrl: mapLinks.place({ id: contentId, name, coord }),
    mapUrl: mapLinks.place({ id: contentId, name, coord }),
    tour: { contentId, contentTypeId, modified: modifiedDate(row.modifiedtime) },
  };
}

/** 한 종류의 주변 후보. 가까운 순 limit개. 근처에 없으면 빈 배열, **조회 실패는 null**(캐시하지 않게). */
export async function searchTour(kind: SuggestionKind, anchor: Coord,
  options: { radius: number; signal?: AbortSignal; limit?: number }): Promise<(Suggestion & { tour: TourRef })[] | null> {
  if (!isTourConfigured() || !isKoreanCoord(anchor)) return [];
  const lists = await Promise.all(CONTENT_TYPES[kind].map(type => call("locationBasedList2", {
    mapX: String(anchor.lng), mapY: String(anchor.lat), radius: String(options.radius),
    contentTypeId: type, arrange: "E", numOfRows: "30", pageNo: "1",
  }, options.signal)));
  if (lists.some(rows => rows === null)) return null;
  return lists.flatMap(rows => rows ?? [])
    .map(row => parseTourRow(row, kind, anchor, options.radius))
    .filter((s): s is Suggestion & { tour: TourRef } => s !== null)
    .sort((a, b) => a.straightMeters - b.straightMeters)
    .slice(0, options.limit ?? 3);
}

/** 한 곳의 영업 정보. 확실히 읽히지 않으면 null, **조회 실패는 undefined**(캐시하지 않게). */
export async function tourHours(ref: TourRef, signal?: AbortSignal): Promise<PlaceHours | null | undefined> {
  const rows = await call("detailIntro2", { contentId: ref.contentId, contentTypeId: ref.contentTypeId }, signal);
  if (rows === null) return undefined;
  return rows[0] ? parseTourIntro(rows[0], ref.contentTypeId, ref.modified) : null;
}
