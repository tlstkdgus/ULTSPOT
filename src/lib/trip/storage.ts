import { catalog } from "./catalog";
import { validateTrip, type FanEvent, type TripInput } from "./planner";

export const storageKey = "ultspot.trip.v1";
export type SavedTrip = { version: 1; input: TripInput; selected: string[]; personal: FanEvent[] };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 300): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
export function safeSource(value: unknown): value is string {
  if (!text(value, 1500)) return false;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

export function isPersonalEvent(value: unknown): value is FanEvent {
  if (!object(value) || !object(value.provenance)) return false;
  const p = value.provenance;
  if (!text(value.id, 80) || !value.id.startsWith("personal-") ||
      ![value.title, value.area, value.kind, value.address, value.do, value.get].every(v => text(v)) ||
      typeof value.from !== "string" || value.from !== value.to || typeof value.opens !== "number" ||
      typeof value.closes !== "number" || value.opens >= value.closes || value.opens < 0 || value.closes > 1439 ||
      !Number.isInteger(value.opens) || !Number.isInteger(value.closes) ||
      !Array.isArray(value.closedDays) || value.closedDays.length !== 0 ||
      typeof value.reservation !== "boolean" || value.lastEntry !== undefined || p.mode !== "personal" ||
      !text(p.author) || !safeSource(p.url) || typeof p.checkedOn !== "string") return false;
  return !validateTrip({ date: value.from, start: value.opens, end: value.closes, stay: 30, transfer: 30 }) &&
    !validateTrip({ date: p.checkedOn, start: 600, end: 1200, stay: 30, transfer: 30 });
}

export function parseSavedTrip(value: unknown): SavedTrip | null {
  if (!object(value) || value.version !== 1 || !object(value.input) || !Array.isArray(value.personal) ||
      value.personal.length > 12 || !value.personal.every(isPersonalEvent) || !Array.isArray(value.selected) ||
      value.selected.length > 6 || !value.selected.every(v => typeof v === "string")) return null;
  const { date, start, end, stay, transfer } = value.input;
  if (typeof date !== "string" || typeof start !== "number" || typeof end !== "number" || typeof stay !== "number" || typeof transfer !== "number") return null;
  const input = { date, start, end, stay, transfer };
  if (validateTrip(input)) return null;
  const ids = [...catalog, ...value.personal].map(e => e.id);
  if (new Set(ids).size !== ids.length || new Set(value.selected).size !== value.selected.length || value.selected.some(id => !ids.includes(id))) return null;
  return { version: 1, input, selected: value.selected, personal: value.personal };
}
