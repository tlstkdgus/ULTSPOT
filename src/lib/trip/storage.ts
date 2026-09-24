import { catalog } from "./catalog";
import { PLACE_SEARCH_SOURCE } from "./place-search";
import { artists } from "./artists";
import { isKoreanCoord, roundCoord, type CoordRecord, type TripEndpoint } from "./geo";
import { validateTrip, type FanEvent, type TripInput } from "./planner";

export const storageKey = "ultspot.trip.v1";
export type SavedTrip = { version: 1; input: TripInput; selected: string[]; personal: FanEvent[]; artistIds?: string[] };

/**
 * 검수 데이터에만 있어야 하는 필드. 개인 저장본에 섞여 오면 저장본 전체를 거부한다.
 *
 * 내보내는 이유: 테스트가 "검수 전용 메타데이터를 모두 지운 개인 초안"을 만들 때 이 목록을 써야
 * 새 필드가 늘어도 fixture가 어긋나지 않는다. T-025의 coord를 추가했을 때 실제로 어긋났다.
 */
export const reviewedOnlyKeys = [
  "title_ko", "do_ko", "get_ko", "area_ko",
  // T-027: 일본어·중국어 번역과 번역 검수 메타데이터도 검수 데이터에만 있어야 한다.
  "title_ja", "do_ja", "get_ja", "area_ja",
  "title_zh", "do_zh", "get_zh", "area_zh", "translation_review",
  "image_asset_id", "transit", "participation",
  // T-025: 검수 좌표와 날짜별 운영 예외.
  "coord", "dateOverrides",
] as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 300): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
export function safeSource(value: unknown): value is string {
  if (!text(value, 1500)) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

/**
 * 개인 장소 좌표(T-062). 카카오 장소 검색으로 고른 좌표만 받는다 — 출처가 카카오 장소 페이지 주소이고 한국 범위다.
 * 검수 카탈로그 좌표(출처가 주소 검색 API)나 손으로 만든 좌표는 여전히 거부한다.
 */
export function isSearchedCoord(value: unknown): value is CoordRecord {
  if (!object(value) || !isKoreanCoord(value)) return false;
  const { source, checked_on: checkedOn } = value as Record<string, unknown>;
  return typeof source === "string" && PLACE_SEARCH_SOURCE.test(source)
    && typeof checkedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(checkedOn)
    && Object.keys(value).every(key => ["lat", "lng", "source", "checked_on"].includes(key));
}

export function isPersonalEvent(value: unknown): value is FanEvent {
  if (!object(value) || !object(value.provenance)) return false;
  // Reviewed catalog metadata is never accepted from a private draft. 좌표만 예외로, 장소 검색 출처일 때 받는다.
  if (reviewedOnlyKeys.some(key => key !== "coord" && value[key] !== undefined)) return false;
  if (value.coord !== undefined && !isSearchedCoord(value.coord)) return false;
  const p = value.provenance;
  /**
   * 운영시간은 둘 다 숫자이거나 둘 다 null이다.
   * null은 주변 추천처럼 영업시간을 확인하지 못한 항목이다. 자동 편성에서 빠지고 목록에만 남는다.
   * 한쪽만 채운 값은 받지 않는다 (여는 시각만 아는 일정은 계산할 수 없다).
   */
  const hoursUnconfirmed = value.opens === null && value.closes === null;
  const hoursValid = hoursUnconfirmed || (typeof value.opens === "number" && typeof value.closes === "number" &&
    Number.isInteger(value.opens) && Number.isInteger(value.closes) &&
    value.opens < value.closes && value.opens >= 0 && value.closes <= 1439);
  if (!text(value.id, 80) || !value.id.startsWith("personal-") ||
      ![value.title, value.area, value.kind, value.address, value.do, value.get].every(v => text(v)) ||
      typeof value.from !== "string" || value.from !== value.to || !hoursValid ||
      !Array.isArray(value.closedDays) || value.closedDays.length !== 0 ||
      typeof value.reservation !== "boolean" || value.lastEntry !== undefined || value.artistIds !== undefined || p.mode !== "personal" ||
      !text(p.author) || !safeSource(p.url) || typeof p.checkedOn !== "string") return false;
  const dayWindow = hoursUnconfirmed
    ? { start: 600, end: 1200 }
    : { start: value.opens as number, end: value.closes as number };
  return !validateTrip({ date: value.from, ...dayWindow, stay: 30, transfer: 30 }) &&
    !validateTrip({ date: p.checkedOn, start: 600, end: 1200, stay: 30, transfer: 30 });
}

export function parseSavedTrip(value: unknown): SavedTrip | null {
  if (!object(value) || value.version !== 1 || !object(value.input) || !Array.isArray(value.personal) ||
      value.personal.length > 12 || !value.personal.every(isPersonalEvent) || !Array.isArray(value.selected) ||
      value.selected.length > 6 || !value.selected.every(v => typeof v === "string")) return null;
  const selected = value.selected as string[];
  const { date, start, end, stay, transfer, origin, destination, travelMode, requiredIds } = value.input;
  if (typeof date !== "string" || typeof start !== "number" || typeof end !== "number" || typeof stay !== "number" || typeof transfer !== "number") return null;
  if (travelMode !== undefined && travelMode !== "transit" && travelMode !== "walk") return null;
  // 필수 방문지는 고른 장소의 부분집합이어야 한다. 아닌 값이 오면 저장본을 거부한다.
  if (requiredIds !== undefined && (!Array.isArray(requiredIds) ||
      !requiredIds.every(id => typeof id === "string" && selected.includes(id)))) return null;
  const readEndpoint = (raw: unknown): TripEndpoint | null | undefined => {
    if (raw === undefined || raw === null) return undefined;
    if (!object(raw) || !text(raw.label, 120)) return null;
    if (raw.address !== undefined && !text(raw.address, 300)) return null;
    // 범위를 벗어난 좌표는 버리고 주소만 남긴다. 좌표 미확인 상태로 이어진다.
    const coord = isKoreanCoord(raw.coord) ? roundCoord(raw.coord) : undefined;
    return { label: raw.label, address: raw.address as string | undefined, coord };
  };
  const from = readEndpoint(origin);
  const to = readEndpoint(destination);
  if (from === null || to === null) return null;
  const input: TripInput = { date, start, end, stay, transfer, travelMode,
    ...(requiredIds ? { requiredIds: requiredIds as string[] } : {}),
    ...(from ? { origin: from } : {}), ...(to ? { destination: to } : {}) };
  if (validateTrip(input)) return null;
  const artistIds = value.artistIds ?? [];
  if (!Array.isArray(artistIds) || artistIds.length > 5 || new Set(artistIds).size !== artistIds.length || !artistIds.every(id => typeof id === 'string' && artists.some(a => a.id === id))) return null;
  const ids = [...catalog, ...value.personal].map(e => e.id);
  if (new Set(ids).size !== ids.length || new Set(value.selected).size !== value.selected.length || value.selected.some(id => !ids.includes(id))) return null;
  return { version: 1, input, selected: value.selected, personal: value.personal, artistIds };
}
