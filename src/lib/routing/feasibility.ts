/** Pure scheduling over a provider's estimates. No invented legs or live-time claims. */
export type Window = { start: number; end: number };
export type Visit = {
  id: string;
  required: boolean;
  duration: number;
  windows: Window[]; // Intersection of opening hours, booking slot and meal preference.
  eligible: boolean; // False for cancelled, unverified or unconfirmed bookings.
};
export type Leg = {
  from: string;
  to: string;
  minutes: number;
  departureWindow: Window;
  source: string;
  checkedAt: string;
};
export type RouteRequest = {
  start: number;
  end: number;
  origin: string;
  destination: string;
  visits: Visit[];
  legs: Leg[];
};
export type Route = {
  stops: { id: string; arrival: number; start: number; end: number; leg: Leg }[];
  returnLeg: Leg;
  finish: number;
  travelMinutes: number;
  waitMinutes: number;
};
export type RouteResult = {
  status: 'ok' | 'invalid_input' | 'no_feasible_route';
  alternatives: { preference: 'most_visits' | 'least_travel' | 'earliest_finish'; route: Route }[];
  reasons: string[];
  estimateOnly: true;
};

const minute = (v: number) => Number.isInteger(v) && v >= 0 && v <= 1440;
const windowValid = (w: Window) => !!w && minute(w.start) && minute(w.end) && w.start < w.end;
const label = (v: string) => typeof v === 'string' && v.length > 0 && v.length <= 100;
const timestamp = (v: string) => typeof v === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));

export function recommendFeasibleRoutes(input: RouteRequest): RouteResult {
  const fail = (status: RouteResult['status'], reason: string): RouteResult => ({ status, alternatives: [], reasons: [reason], estimateOnly: true });
  // The caller validates untrusted JSON before constructing this typed input.
  if (!minute(input.start) || !minute(input.end) || input.start >= input.end ||
      !label(input.origin) || !label(input.destination) || input.visits.length < 1 || input.visits.length > 6 || input.legs.length > 256 ||
      new Set(input.visits.map(v => v.id)).size !== input.visits.length ||
      input.visits.some(v => !label(v.id) || v.id === input.origin || v.id === input.destination ||
        typeof v.required !== 'boolean' || typeof v.eligible !== 'boolean' || !minute(v.duration) || v.duration === 0 ||
        v.windows.length > 2 || v.windows.some(w => !windowValid(w)))) return fail('invalid_input', 'invalid_constraints');
  const nodes = new Set([input.origin, input.destination, ...input.visits.map(v => v.id)]);
  const edges = new Map<string, Leg>();
  const key = (from: string, to: string) => JSON.stringify([from, to]);
  for (const leg of input.legs) {
    if (!nodes.has(leg.from) || !nodes.has(leg.to) || leg.from === leg.to || !minute(leg.minutes) ||
        !windowValid(leg.departureWindow) || !leg.source?.trim() || !timestamp(leg.checkedAt) ||
        edges.has(key(leg.from, leg.to))) return fail('invalid_input', 'invalid_or_duplicate_leg');
    edges.set(key(leg.from, leg.to), leg);
  }
  if (input.visits.some(v => v.required && (!v.eligible || !v.windows.length))) return fail('no_feasible_route', 'required_visit_unavailable');
  const required = input.visits.filter(v => v.required).map(v => v.id);
  const getLeg = (from: string, to: string, departure: number) => {
    const leg = edges.get(key(from, to));
    return leg && departure >= leg.departureWindow.start && departure < leg.departureWindow.end ? leg : undefined;
  };
  const best: Partial<Record<'most_visits' | 'least_travel' | 'earliest_finish', Route>> = {};
  const score = (r: Route, preference: keyof typeof best) => preference === 'most_visits'
    ? [-r.stops.length, r.travelMinutes, r.finish, r.waitMinutes]
    : preference === 'least_travel' ? [r.travelMinutes, -r.stops.length, r.finish, r.waitMinutes]
      : [r.finish, -r.stops.length, r.travelMinutes, r.waitMinutes];
  const better = (a: Route, b: Route, preference: keyof typeof best) => {
    const left = score(a, preference), right = score(b, preference);
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] < right[i];
    return a.stops.map(s => s.id).join('\0') < b.stops.map(s => s.id).join('\0');
  };
  function search(stops: Route['stops'], remaining: Visit[], now: number, travel: number, wait: number) {
    const from = stops.at(-1)?.id ?? input.origin;
    if (stops.length && required.every(id => stops.some(s => s.id === id))) {
      const returnLeg = getLeg(from, input.destination, now);
      if (returnLeg && now + returnLeg.minutes <= input.end) {
        const route: Route = { stops, returnLeg, finish: now + returnLeg.minutes, travelMinutes: travel + returnLeg.minutes, waitMinutes: wait };
        for (const preference of ['most_visits', 'least_travel', 'earliest_finish'] as const)
          if (!best[preference] || better(route, best[preference], preference)) best[preference] = route;
      }
    }
    for (const visit of remaining) {
      if (!visit.eligible) continue;
      const leg = getLeg(from, visit.id, now);
      if (!leg) continue; // A missing route is not zero minutes or a default buffer.
      const arrival = now + leg.minutes;
      for (const window of visit.windows) {
        const start = Math.max(arrival, window.start), end = start + visit.duration;
        if (end > window.end || end > input.end) continue;
        search([...stops, { id: visit.id, arrival, start, end, leg }], remaining.filter(v => v.id !== visit.id), end, travel + leg.minutes, wait + start - arrival);
      }
    }
  }
  search([], [...input.visits].sort((a, b) => a.id.localeCompare(b.id)), input.start, 0, 0);
  const seen = new Set<string>();
  const alternatives: RouteResult['alternatives'] = [];
  for (const preference of ['most_visits', 'least_travel', 'earliest_finish'] as const) {
    const route = best[preference];
    if (!route) continue;
    const signature = JSON.stringify(route.stops.map(s => [s.id, s.start]));
    if (!seen.has(signature)) { seen.add(signature); alternatives.push({ preference, route }); }
  }
  return alternatives.length ? { status: 'ok', alternatives, reasons: [], estimateOnly: true }
    : fail('no_feasible_route', 'no_verified_path_within_constraints');
}
