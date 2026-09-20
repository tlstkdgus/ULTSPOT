import type { CoordRecord, TripEndpoint, TravelPoint } from "./geo";
import { legKey, travelMinutes, travelReasons, unconfirmed, type TravelEstimate, type TravelMode, type TravelTable } from "./travel";

/** 번역 초안과 승인 번역을 구분한다. 미검수 번역을 운영 조건처럼 쓰지 않기 위한 메타데이터 (T-027). */
export type TranslationReview = { author: string; source: string; status: 'draft' | 'reviewed'; checked_on?: string };

/**
 * 특정 날짜의 운영 예외. 요일 휴무(`closedDays`)로는 표현할 수 없는 공휴일 휴관·단축 운영을 담는다.
 * `opens`/`closes`가 null이면 미확인이다 (24시간 운영이나 휴무를 뜻하지 않는다).
 */
export type DateOverride = {
  date: string;
  closed?: boolean;
  opens?: number | null;
  closes?: number | null;
  lastEntry?: number | null;
  note_ko?: string;
  source: string;
  checked_on: string;
};

export type FanEvent = {
  title_ja?: string;
  do_ja?: string;
  get_ja?: string;
  area_ja?: string;
  title_zh?: string;
  do_zh?: string;
  get_zh?: string;
  area_zh?: string;
  translation_review?: Partial<Record<'ja' | 'zh', Partial<Record<'title' | 'do' | 'get' | 'area' | 'station' | 'line' | 'price', TranslationReview>>>>;
  title_ko?: string;
  do_ko?: string;
  get_ko?: string;
  area_ko?: string;
  image_asset_id?: string;
  transit?: { station_ja?: string; line_ja?: string; station_zh?: string; line_zh?: string; station_ko: string; station_en: string; line_ko: string; line_en: string; exit: string; walk_minutes: number; source: string; checked_on: string };
  participation?: { price_ja?: string; price_zh?: string; price_ko: string; price_en: string; cash_required: boolean | null; first_come_quantity: number | null; lucky_draw: boolean | null; source: string; checked_on: string };
  /** 검수된 좌표만 넣는다. 없으면 이동시간을 확정할 수 없고 그 사실을 화면에 알린다. */
  coord?: CoordRecord;
  /** 날짜별 운영 예외. 요일 휴무보다 우선한다. */
  dateOverrides?: DateOverride[];
  /**
   * 탐색 필터용 분류. 없으면 categories.ts가 알려진 `kind`만 매핑하고 나머지는 other로 둔다.
   * 검수 없이 생일카페·맛집으로 분류하지 않는다.
   */
  category?: "birthdayCafe" | "popup" | "filming" | "landmark" | "food" | "other";
  artistIds?: string[];
  id: string;
  title: string;
  area: string;
  kind: string;
  from: string | null;
  to: string | null;
  opens: number | null;
  closes: number | null;
  address: string;
  closedDays: number[];
  lastEntry?: number;
  reservation: boolean;
  do: string;
  get: string;
  provenance: { mode: "reviewed" | "reported" | "personal"; author: string; checkedOn: string; url: string };
};

export type TripInput = {
  date: string; start: number; end: number; stay: number; transfer: number;
  /** 하루를 시작하는 곳(숙소·공항 등). 있으면 첫 장소까지의 이동시간을 일정에 넣는다. */
  origin?: TripEndpoint;
  /** 하루를 끝내는 곳. 있으면 마지막 장소에서 돌아가는 시간을 종료 시각 안에 넣는다. */
  destination?: TripEndpoint;
  /** 조회할 이동수단. 기본 대중교통. */
  travelMode?: TravelMode;
  /**
   * 반드시 가야 하는 행사 id. 팬이 이 행사 때문에 여행을 가는 것이므로 방문 수보다 먼저 지킨다.
   * 비어 있으면 모든 선택지를 동등하게 본다(기존 동작).
   */
  requiredIds?: string[];
};

export type Stop = {
  event: FanEvent; arrival: number; departure: number;
  /** 이 장소에 오기까지 쓴 분. 조회값이거나 계획용 여유 시간이다. */
  travel: number;
  /** 그 분이 어디서 나왔는지. null은 출발 위치가 없어 이동시간을 세지 않은 첫 구간. */
  travelEstimate: TravelEstimate | null;
};

export const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const minutes = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;

const isDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateTrip(input: TripInput): string | null {
  if (!isDate(input.date)) return "Choose a valid travel date.";
  if (![input.start, input.end, input.stay].every(Number.isInteger) || input.start < 0 ||
      input.end > 1439 || input.start >= input.end) return "End time must be later than start time.";
  if (input.stay < 30 || input.stay > 120) return "Choose a visit duration between 30 and 120 minutes.";
  if (!Number.isInteger(input.transfer) || input.transfer < 5 || input.transfer > 120) return "Allow 5–120 minutes between spots.";
  if (input.travelMode !== undefined && input.travelMode !== "transit" && input.travelMode !== "walk")
    return "Choose public transport or walking.";
  if (input.requiredIds !== undefined && (!Array.isArray(input.requiredIds) || input.requiredIds.length > 6 ||
      new Set(input.requiredIds).size !== input.requiredIds.length ||
      !input.requiredIds.every(id => typeof id === "string" && id.length > 0 && id.length <= 80)))
    return "Choose up to 6 different must-visit events.";
  for (const endpoint of [input.origin, input.destination]) {
    if (endpoint === undefined) continue;
    if (!endpoint || typeof endpoint.label !== "string" || !endpoint.label.trim() || endpoint.label.length > 120)
      return "Name your start and end location, or leave it empty.";
  }
  return null;
}

export const runsOn = (event: FanEvent, date: string) => (!event.from || event.from <= date) && (!event.to || date <= event.to);

/** 해당 날짜에 실제로 적용되는 운영 조건. 날짜 예외가 요일·기본 운영시간을 덮는다. */
export function effectiveHours(event: FanEvent, date: string) {
  const override = event.dateOverrides?.find(o => o.date === date);
  if (override?.closed) return { closed: true, opens: null, closes: null, lastEntry: undefined, override };
  const opens = override && override.opens !== undefined ? override.opens : event.opens;
  const closes = override && override.closes !== undefined ? override.closes : event.closes;
  const lastEntry = override && override.lastEntry !== undefined ? (override.lastEntry ?? undefined) : event.lastEntry;
  const closedByWeekday = !override && event.closedDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  return { closed: closedByWeekday, opens, closes, lastEntry, override };
}

export function unavailableReason(event: FanEvent, date: string): string | null {
  if (!runsOn(event, date)) return "Not running on this date.";
  const hours = effectiveHours(event, date);
  if (hours.closed) {
    return hours.override ? "Closed on this date by the venue notice." : "Closed on this day of the week.";
  }
  if (hours.opens === null || hours.closes === null) return "Opening hours are unconfirmed. Check the source before scheduling.";
  if (event.reservation) return "A confirmed timed reservation is required. This service does not issue bookings.";
  return null;
}

export type SpotStatus = "open" | "closed" | "closedByNotice" | "unconfirmed" | "reservation" | "notRunning";

/**
 * 고르기 전에 보여줄 상태. 판정 근거는 unavailableReason 하나이고 이 함수는 뱃지 종류로 나누기만 한다.
 * 화면에서 요일 휴무를 직접 계산하지 말고 이 값을 쓴다 (날짜별 운영 예외가 요일보다 우선한다).
 */
export function statusOn(event: FanEvent, date: string): SpotStatus {
  if (!unavailableReason(event, date)) return "open";
  if (!runsOn(event, date)) return "notRunning";
  const hours = effectiveHours(event, date);
  if (hours.closed) return hours.override ? "closedByNotice" : "closed";
  if (hours.opens === null || hours.closes === null) return "unconfirmed";
  if (event.reservation) return "reservation";
  return "closed";
}

/** 경로 조회·지도 링크에 쓰는 지점으로 바꾼다. 좌표가 없으면 coord가 undefined로 남는다. */
export const eventPoint = (event: FanEvent): TravelPoint => ({
  id: event.id, name: event.title_ko || event.title, address: event.address,
  coord: event.coord ? { lat: event.coord.lat, lng: event.coord.lng } : undefined,
});

const endpointPoint = (endpoint: TripEndpoint, id: string): TravelPoint =>
  ({ id, name: endpoint.label, address: endpoint.address, coord: endpoint.coord });

export const ORIGIN_ID = "trip-origin";
export const DESTINATION_ID = "trip-destination";

export type TripResult = {
  stops: Stop[];
  omitted: { event: FanEvent; reason: string; required: boolean }[];
  error: string | null;
  /** 마지막 장소에서 종료 위치로 돌아가는 구간. 종료 위치를 넣지 않으면 null. */
  returnLeg: { minutes: number; estimate: TravelEstimate | null } | null;
  /** 필수로 지정했는데 넣지 못한 행사. 비어 있지 않으면 일정이 사용자의 목적을 못 지킨 것이다. */
  missingRequired: FanEvent[];
};

/**
 * 선택한 장소 6곳까지 완전 탐색: 방문 수 최대화, 동률이면 가장 이른 종료.
 *
 * 이동시간은 `travel`에 조회 결과가 있으면 그 값을, 없으면 사용자가 정한 계획용 여유 시간을 쓴다.
 * 어느 쪽을 썼는지는 Stop.travelEstimate에 남는다. 조회 실패를 추정값으로 메우지 않는다.
 */
export function planTrip(events: FanEvent[], input: TripInput, travel?: TravelTable): TripResult {
  const empty = { stops: [] as Stop[], omitted: [] as TripResult["omitted"], returnLeg: null, missingRequired: [] as FanEvent[] };
  const error = validateTrip(input);
  if (error) return { ...empty, error };
  if (events.length > 6 || new Set(events.map(e => e.id)).size !== events.length)
    return { ...empty, error: "Choose up to 6 different events." };
  const requiredIds = new Set((input.requiredIds ?? []).filter(id => events.some(e => e.id === id)));
  const isRequired = (event: FanEvent) => requiredIds.has(event.id);
  const requiredCount = (stops: Stop[]) => stops.reduce((n, s) => n + (isRequired(s.event) ? 1 : 0), 0);

  const mode: TravelMode = input.travelMode ?? "transit";
  const originPoint = input.origin ? endpointPoint(input.origin, ORIGIN_ID) : null;
  const destinationPoint = input.destination ? endpointPoint(input.destination, DESTINATION_ID) : null;
  /**
   * 조회 결과가 없으면 비워 두지 않고 미확인으로 만든다.
   * 그래야 화면이 늘 사유와 직접 확인 경로를 보여줄 수 있고, 여유 시간을 조회값으로 오해하지 않는다.
   */
  const lookup = (from: TravelPoint, to: TravelPoint): TravelEstimate =>
    travel?.[legKey(from.id, to.id, mode)] ?? unconfirmed(from, to, mode, input.transfer, travelReasons.notRequested);

  const eligible = events.filter(e => !unavailableReason(e, input.date));
  let best: Stop[] = [];
  let bestReturn: { minutes: number; estimate: TravelEstimate | null } | null = null;

  /** 마지막 장소에서 종료 위치까지. 종료 위치가 없으면 0분이고 제약도 없다. */
  function returnLeg(last: Stop | undefined) {
    if (!last || !destinationPoint) return { minutes: 0, estimate: null };
    const estimate = lookup(eventPoint(last.event), destinationPoint);
    return { minutes: travelMinutes(estimate, input.transfer), estimate };
  }

  /**
   * 더 나은 일정인가. 순서대로: 필수 방문지 수 → 총 방문 수 → 이른 종료.
   * 필수를 먼저 보기 때문에, 필수 1곳만 있는 일정이 선택 6곳을 다 넣은 일정보다 우선한다.
   */
  function better(stops: Stop[], finish: number) {
    if (!best.length) return true;
    const bestFinish = best.at(-1)!.departure + (bestReturn?.minutes ?? 0);
    const left = [-requiredCount(stops), -stops.length, finish];
    const right = [-requiredCount(best), -best.length, bestFinish];
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] < right[i];
    return false;
  }

  function search(stops: Stop[], remaining: FanEvent[]) {
    const back = returnLeg(stops.at(-1));
    const finish = (stops.at(-1)?.departure ?? input.start) + back.minutes;
    if (stops.length && finish <= input.end && better(stops, finish)) {
      best = stops;
      bestReturn = destinationPoint ? back : null;
    }
    for (const event of remaining) {
      const previous = stops.at(-1);
      const fromPoint = previous ? eventPoint(previous.event) : originPoint;
      const toPoint = eventPoint(event);
      // 출발 위치를 넣지 않았으면 첫 구간 이동시간을 세지 않는다 (기존 동작 유지).
      const estimate = fromPoint ? lookup(fromPoint, toPoint) : null;
      const travelLeg = estimate ? travelMinutes(estimate, input.transfer) : 0;
      const hours = effectiveHours(event, input.date);
      const arrival = Math.max((previous?.departure ?? input.start) + travelLeg, hours.opens!);
      const departure = arrival + input.stay;
      if (arrival <= (hours.lastEntry ?? hours.closes!) && departure <= Math.min(input.end, hours.closes!)) {
        search([...stops, { event, arrival, departure, travel: travelLeg, travelEstimate: estimate }],
          remaining.filter(e => e.id !== event.id));
      }
    }
  }
  search([], eligible);

  const omitted = events.filter(e => !best.some(s => s.event.id === e.id)).map(event => ({
    event,
    required: isRequired(event),
    reason: unavailableReason(event, input.date) ?? (isRequired(event)
      // 필수 방문지를 못 넣었다면 다른 선택을 줄여야 한다는 뜻이다. 일반 제외와 다르게 말한다.
      ? "This must-visit event does not fit. Remove other stops, widen your day, or shorten each visit."
      : "Cannot fit within opening hours, your travel buffer and available time. Try a longer day or shorter visits."),
  }));

  return {
    stops: best,
    error: null,
    returnLeg: bestReturn,
    omitted,
    missingRequired: omitted.filter(o => o.required).map(o => o.event),
  };
}
