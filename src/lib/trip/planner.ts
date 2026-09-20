export type FanEvent = {
  title_ko?: string;
  do_ko?: string;
  get_ko?: string;
  area_ko?: string;
  image_asset_id?: string;
  transit?: { station_ko: string; station_en: string; line_ko: string; line_en: string; exit: string; walk_minutes: number; source: string; checked_on: string };
  participation?: { price_ko: string; price_en: string; cash_required: boolean | null; first_come_quantity: number | null; lucky_draw: boolean | null; source: string; checked_on: string };
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
  provenance: { mode: "reviewed" | "personal"; author: string; checkedOn: string; url: string };
};

export type TripInput = { date: string; start: number; end: number; stay: number; transfer: number };
export type Stop = { event: FanEvent; arrival: number; departure: number; travel: number };
export const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const minutes = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : NaN;

export function validateTrip(input: TripInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) ||
      new Date(input.date).toISOString().slice(0, 10) !== input.date) return "Choose a valid travel date.";
  if (![input.start, input.end, input.stay].every(Number.isInteger) || input.start < 0 ||
      input.end > 1439 || input.start >= input.end) return "End time must be later than start time.";
  if (input.stay < 30 || input.stay > 120) return "Choose a visit duration between 30 and 120 minutes.";
  if (!Number.isInteger(input.transfer) || input.transfer < 5 || input.transfer > 120) return "Allow 5–120 minutes between spots.";
  return null;
}

export const runsOn = (event: FanEvent, date: string) => (!event.from || event.from <= date) && (!event.to || date <= event.to);

export function unavailableReason(event: FanEvent, date: string): string | null {
  if (!runsOn(event, date)) return "Not running on this date.";
  if (event.closedDays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) return "Closed on this day of the week.";
  if (event.opens === null || event.closes === null) return "Opening hours are unconfirmed. Check the source before scheduling.";
  if (event.reservation) return "A confirmed timed reservation is required. This service does not issue bookings.";
  return null;
}

/** Exhaustive search bounded at 6 selections: maximize visits, then finish earliest. */
export function planTrip(events: FanEvent[], input: TripInput) {
  const error = validateTrip(input);
  if (error) return { stops: [] as Stop[], omitted: [] as { event: FanEvent; reason: string }[], error };
  if (events.length > 6 || new Set(events.map(e => e.id)).size !== events.length)
    return { stops: [] as Stop[], omitted: [], error: "Choose up to 6 different events." };
  const eligible = events.filter(e => !unavailableReason(e, input.date));
  let best: Stop[] = [];
  function search(stops: Stop[], remaining: FanEvent[]) {
    if (stops.length > best.length || (stops.length === best.length && stops.length > 0 &&
        stops.at(-1)!.departure < best.at(-1)!.departure)) best = stops;
    for (const event of remaining) {
      const previous = stops.at(-1);
      const travel = previous ? input.transfer : 0;
      const arrival = Math.max((previous?.departure ?? input.start) + travel, event.opens!);
      const departure = arrival + input.stay;
      if (arrival <= (event.lastEntry ?? event.closes!) && departure <= Math.min(input.end, event.closes!)) {
        search([...stops, { event, arrival, departure, travel }], remaining.filter(e => e.id !== event.id));
      }
    }
  }
  search([], eligible);
  return { stops: best, error: null, omitted: events.filter(e => !best.some(s => s.event.id === e.id)).map(event => ({
    event,
    reason: unavailableReason(event, input.date) ?? "Cannot fit within opening hours, your travel buffer and available time. Try a longer day or shorter visits.",
  })) };
}
