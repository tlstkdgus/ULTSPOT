import { readFileSync } from 'node:fs';
import { cases, payload } from './fixtures.mjs';

// Offline only. No environment variables, credentials, or network access.
const input = process.argv[2];
if (input === '--requests') {
  console.log(JSON.stringify(cases.map(c => ({ caseId: c.id, request: payload(c) })), null, 2));
} else if (!input) {
  const ids = new Set(cases.map(c => c.id));
  if (cases.length !== 30 || ids.size !== 30) throw new Error('Expected 30 unique cases');
  for (const c of cases) {
    const eligible = c.candidates.filter(x => x.eligible).map(x => x.id);
    if (!c.expected.length || !c.expected.every(id => eligible.includes(id))) throw new Error('Invalid expected candidate');
    if (Object.keys(payload(c).questions).length !== eligible.length) throw new Error('Invalid question coverage');
  }
  console.log(JSON.stringify({ cases: 30, bilingualPairs: 15, requests: 30, questions: cases.reduce((n, c) => n + Object.keys(payload(c).questions).length, 0), liveCalls: 0, modelQuality: 'not measured' }, null, 2));
} else {
  // Results file: [{caseId, response: <raw TypeSafe JSON>, latencyMs}].
  const rows = JSON.parse(readFileSync(input, 'utf8'));
  if (!Array.isArray(rows) || rows.length !== cases.length || new Set(rows.map(r => r.caseId)).size !== cases.length || rows.some(r => !cases.some(c => c.id === r.caseId))) throw new Error('Exactly one response per known case is required');
  const details = cases.map(c => {
    const row = rows.find(r => r.caseId === c.id);
    const candidates = c.candidates.filter(x => x.eligible);
    const scores = candidates.map(x => row.response?.answers?.[`fit_${x.id}`]);
    const valid = scores.every(s => {
      if (s?.type !== 'score' || !Number.isFinite(s.score) || s.score < 0 || s.score > 2 || !Number.isFinite(s.confidence) || s.confidence < 0 || s.confidence > 1) return false;
      const p = s.probabilities;
      if (!p || Object.keys(p).sort().join() !== '0,1,2' || !Object.values(p).every(v => Number.isFinite(v) && v >= 0 && v <= 1)) return false;
      return Math.abs(p[0] + p[1] + p[2] - 1) < 0.001 && Math.abs(p[1] + 2 * p[2] - s.score) < 0.02;
    });
    // Experimental selection gate, not a calibrated production threshold.
    const fallback = !valid || scores.every(s => s.score <= 1);
    const selected = fallback ? candidates[0].id : candidates[scores.reduce((best, s, i) => s.score > scores[best].score ? i : best, 0)].id;
    return { id: c.id, selected, correct: c.expected.includes(selected), valid, fallback, fallbackExpectationMet: !c.expectsFallback || fallback, baselineCorrect: c.expected.includes(candidates[0].id) };
  });
  console.log(JSON.stringify({ total: details.length, correct: details.filter(d => d.correct).length, invalid: details.filter(d => !d.valid).length, fallback: details.filter(d => d.fallback).length, fallbackExpectationFailures: details.filter(d => !d.fallbackExpectationMet).length, firstEligibleBaselineCorrect: details.filter(d => d.baselineCorrect).length, details }, null, 2));
}
