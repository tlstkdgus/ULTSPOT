import { catalog } from "./catalog";
import { artists } from "./artists";
import { isKoreanCoord, roundCoord, type TripEndpoint } from "./geo";
import { validateTrip, type FanEvent, type TripInput } from "./planner";

export const storageKey = "ultspot.trip.v1";
export type SavedTrip = { version: 1; input: TripInput; selected: string[]; personal: FanEvent[]; artistIds?: string[] };

/** 검수 데이터에만 있어야 하는 필드. 개인 저장본에 섞여 오면 저장본 전체를 거부한다. */
const reviewedOnlyKeys = ["title_ko", "do_ko", "get_ko", "area_ko", "image_asset_id", "transit", "participation", "coord", "dateOverrides"] as const;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 300): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
export function safeSource(value: unknown): value is string {
  if (!text(value, 1500)) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

export function isPersonalEvent(value: unknown): value is FanEvent {
  if (!object(value) || !object(value.provenance)) return false;
  // Reviewed catalog metadata is never accepted from a private draft.
  if (reviewedOnlyKeys.some(key => value[key] !== undefined)) return false;
  const p = value.provenance;
  if (!text(value.id, 80) || !value.id.startsWith("personal-") ||
      ![value.title, value.area, value.kind, value.address, value.do, value.get].every(v => text(v)) ||
      typeof value.from !== "string" || value.from !== value.to || typeof value.opens !== "number" ||
      typeof value.closes !== "number" || value.opens >= value.closes || value.opens < 0 || value.closes > 1439 ||
      !Number.isInteger(value.opens) || !Number.isInteger(value.closes) ||
      !Array.isArray(value.closedDays) || value.closedDays.length !== 0 ||
      typeof value.reservation !== "boolean" || value.lastEntry !== undefined || value.artistIds !== undefined || p.mode !== "personal" ||
      !text(p.author) || !safeSource(p.url) || typeof p.checkedOn !== "string") return false;
  return !validateTrip({ date: value.from, start: value.opens, end: value.closes, stay: 30, transfer: 30 }) &&
    !validateTrip({ date: p.checkedOn, start: 600, end: 1200, stay: 30, transfer: 30 });
}

export function parseSavedTrip(value: unknown): SavedTrip | null {
  if (!object(value) || value.version !== 1 || !object(value.input) || !Array.isArray(value.personal) ||
      value.personal.length > 12 || !value.personal.every(isPersonalEvent) || !Array.isArray(value.selected) ||
      value.selected.length > 6 || !value.selected.every(v => typeof v === "string")) return null;
  const { date, start, end, stay, transfer, origin, destination, travelMode } = value.input;
  if (typeof date !== "string" || typeof start !== "number" || typeof end !== "number" || typeof stay !== "number" || typeof transfer !== "number") return null;
  if (travelMode !== undefined && travelMode !== "transit" && travelMode !== "walk") return null;
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
    ...(from ? { origin: from } : {}), ...(to ? { destination: to } : {}) };
  if (validateTrip(input)) return null;
  const artistIds = value.artistIds ?? [];
  if (!Array.isArray(artistIds) || artistIds.length > 5 || new Set(artistIds).size !== artistIds.length || !artistIds.every(id => typeof id === 'string' && artists.some(a => a.id === id))) return null;
  const ids = [...catalog, ...value.personal].map(e => e.id);
  if (new Set(ids).size !== ids.length || new Set(value.selected).size !== value.selected.length || value.selected.some(id => !ids.includes(id))) return null;
  return { version: 1, input, selected: value.selected, personal: value.personal, artistIds };
}
