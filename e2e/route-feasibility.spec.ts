import { test, expect } from '@playwright/test';
import { recommendFeasibleRoutes, type RouteRequest, type Leg } from '../src/lib/routing/feasibility';

const leg = (from: string, to: string, minutes: number): Leg => ({ from, to, minutes, departureWindow: { start: 0, end: 1440 }, source: 'test-fixture-not-live', checkedAt: '2026-09-20T10:00:00+09:00' });
const fixture = (): RouteRequest => ({ start: 600, end: 900, origin: 'hotel-start', destination: 'hotel-end',
  visits: [
    { id: 'birthday', required: true, eligible: true, duration: 60, windows: [{ start: 660, end: 780 }] },
    { id: 'lunch', required: false, eligible: true, duration: 45, windows: [{ start: 720, end: 840 }] },
  ], legs: [leg('hotel-start', 'birthday', 20), leg('birthday', 'hotel-end', 20), leg('birthday', 'lunch', 10), leg('lunch', 'hotel-end', 20)] });

test('required cafe, lunch window, waiting and return travel are respected', () => {
  const input = fixture(), before = JSON.stringify(input), result = recommendFeasibleRoutes(input);
  expect(result.status).toBe('ok');
  expect(result.alternatives[0].route.stops.map(s => s.id)).toEqual(['birthday', 'lunch']);
  expect(result.alternatives[0].route.waitMinutes).toBe(40);
  expect(result.alternatives[0].route.finish).toBe(795);
  for (const a of result.alternatives) expect(a.route.stops.some(s => s.id === 'birthday')).toBe(true);
  expect(result.alternatives.find(a => a.preference === 'least_travel')?.route.stops).toHaveLength(1);
  expect(JSON.stringify(input)).toBe(before);
});

test('missing, reverse-only and expired legs cannot fabricate feasible travel', () => {
  const input = fixture();
  input.legs = [leg('birthday', 'hotel-start', 20)];
  expect(recommendFeasibleRoutes(input).status).toBe('no_feasible_route');
  const expired = fixture(); expired.legs[0].departureWindow.end = 600;
  expect(recommendFeasibleRoutes(expired).status).toBe('no_feasible_route');
  const noReturn = fixture(); noReturn.legs = noReturn.legs.filter(l => l.to !== 'hotel-end');
  expect(recommendFeasibleRoutes(noReturn).status).toBe('no_feasible_route');
});

test('required unavailable visit never becomes an optional omission', () => {
  const input = fixture(); input.visits[0].eligible = false;
  expect(recommendFeasibleRoutes(input).reasons).toEqual(['required_visit_unavailable']);
  input.visits[0].eligible = true; input.visits[0].windows = [];
  expect(recommendFeasibleRoutes(input).status).toBe('no_feasible_route');
});

test('return deadline, split opening intervals and malformed inputs are enforced', () => {
  const input = fixture(); input.end = 730;
  expect(recommendFeasibleRoutes(input).status).toBe('no_feasible_route');
  input.end = 900; input.visits[0].windows = [{ start: 620, end: 650 }, { start: 700, end: 780 }];
  expect(recommendFeasibleRoutes(input).alternatives[0].route.stops[0].start).toBe(700);
  input.legs.push(input.legs[0]);
  expect(recommendFeasibleRoutes(input).status).toBe('invalid_input');
  const negative = fixture(); negative.legs[0].minutes = -1;
  expect(recommendFeasibleRoutes(negative).status).toBe('invalid_input');
});
