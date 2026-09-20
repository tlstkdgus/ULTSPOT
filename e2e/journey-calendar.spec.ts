import { expect, test } from '@playwright/test';
import { addVisit, createJourney, updateVisit } from '../src/lib/trip/journey';
import { journeyCalendar } from '../src/lib/trip/journey-calendar';

test('calendar preserves Korean time and omits unknown or conflicting visits', () => {
  let journey = createJourney('2026-09-22', '2026-09-23');
  journey = addVisit(journey, { id: 'one', placeId: 'hikr-ground', stay: 60 }, '2026-09-22');
  journey = addVisit(journey, { id: 'two', placeId: 'music-korea', stay: 60 }, '2026-09-22');
  const result = journeyCalendar(journey, {}, 'transit', 'en', 'Not a booking');
  expect(result.count).toBe(1);
  expect(result.excluded).toBe(1);
  expect(result.content).toContain('DTSTART:20260922T010000Z');
  expect(result.content).toContain('DTEND:20260922T020000Z');
  expect(result.content).not.toContain('UID:two@ultspot');
  journey = updateVisit(journey, 'one', 60, 9 * 60);
  expect(journeyCalendar(journey, {}, 'transit', 'en', '').count).toBe(0);
});
