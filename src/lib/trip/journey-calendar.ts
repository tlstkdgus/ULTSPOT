import { buildCalendar, type CalendarEvent } from '../calendar';
import { eventCopy, type DataLocale } from './event-copy';
import { scheduleJourneyDay, type Journey } from './journey';
import { journeyPlaces } from './journey-places';
import { travelLookup } from './journey-travel';
import type { TravelMode, TravelTable } from './travel';

/** Export only timed, conflict-free visits. Unassigned and unresolved visits stay in the plan. */
export function journeyCalendar(journey: Journey, table: TravelTable, mode: TravelMode, locale: DataLocale, note: string, now = new Date()) {
  const places = new Map(journeyPlaces(journey).map(place => [place.id, place]));
  const events: CalendarEvent[] = [];
  let excluded = journey.unassigned.length;
  for (const day of journey.days) {
    for (const item of scheduleJourneyDay(journey, day.date, travelLookup(table, mode))) {
      const place = places.get(item.visit.placeId);
      if (!place || item.arrival === null || item.departure === null || item.issues.length || item.departure <= item.arrival) {
        excluded++;
        continue;
      }
      const copy = place.event ? eventCopy(place.event, locale) : null;
      events.push({
        uid: `${encodeURIComponent(item.visit.id)}@ultspot`,
        date: day.date, start: item.arrival, end: item.departure,
        title: copy?.title ?? place.title, location: place.address,
        description: [copy?.do, place.event?.provenance.url, note].filter(Boolean).join('\n'),
      });
    }
  }
  return { content: buildCalendar(events, now), count: events.length, excluded };
}
