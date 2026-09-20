import { createHash } from 'node:crypto';
import { readFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { schema, tabs, optionalTabs } from './schema.mjs';
import { validate } from './intake.mjs';

// A receipt/audit accepts extra collector notes; the strict importer still rejects them.
// No facts, evidence claims, dates or approval states are inferred here.
export async function auditCollection(directory, asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0, 10) !== asOf) throw new Error('Invalid audit date');
  const files = [], original = {}, candidate = {}, sidecar = {}, changes = [];
  for (const tab of tabs) {
    const path = join(directory, `${tab}.csv`);
    try { await stat(path); } catch (error) { if (error.code === 'ENOENT' && optionalTabs.includes(tab)) continue; throw error; }
    if ((await stat(path)).size > 5_000_000) throw new Error(`${tab}: oversized`);
    const bytes = await readFile(path);
    const records = parse(bytes, { bom: true, skip_empty_lines: true });
    const headers = records.shift();
    if (!headers?.length || new Set(headers).size !== headers.length) throw new Error(`${tab}: missing/duplicate headers`);
    original[tab] = records.map((values) => Object.fromEntries(headers.map((key, i) => [key, values[i]])));
    files.push({ tab, bytes: bytes.length, rows: records.length, sha256: createHash('sha256').update(bytes).digest('hex'), headers });
    sidecar[tab] = [];
    candidate[tab] = original[tab].map((raw, index) => {
      const row = { ...raw };
      const rename = (from, to) => {
        if (from in row && !(to in row)) { row[to] = row[from]; delete row[from]; changes.push({ tab, row: index + 1, from, to, operation: 'rename' }); }
      };
      if (tab === 'event_artists') rename('설명', 'description');
      if (tab === 'place_artists') rename('사실_요약', 'description');
      if (tab === 'hours' && ['date', 'weekday'].includes(row.schedule_type)) rename('date_or_weekday', row.schedule_type);
      const translate = (field, map) => {
        if (Object.hasOwn(map, row[field])) { const from = row[field]; row[field] = map[from]; changes.push({ tab, row: index + 1, field, from, to: row[field], operation: 'enum' }); }
      };
      if (tab === 'artist_relations') translate('status', { '현재': 'current', '과거': 'past' });
      if (tab === 'events') translate('organizer_type', { '공식': 'official', '팬': 'fan', '매장': 'store' });
      if (tab === 'sources' && ['event_artist', 'place_artist'].includes(row.target_type) && /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(row.target_id)) {
        const from = row.target_id; row.target_id = from.replace(':', '::');
        changes.push({ tab, row: index + 1, field: 'target_id', from, to: row.target_id, operation: 'compound_key_separator' });
      }
      const extra = Object.fromEntries(Object.entries(row).filter(([key]) => !schema[tab].fields.includes(key)));
      if (Object.keys(extra).length) sidecar[tab].push({ row: index + 1, key: schema[tab].key.map((key) => raw[key]).join('::'), fields: extra });
      return Object.fromEntries(Object.entries(row).filter(([key]) => schema[tab].fields.includes(key)));
    });
  }
  const result = validate(candidate);
  // Preserve collector changelogs and future tabs verbatim, outside the candidate.
  const supplementalFiles = [];
  for (const file of (await readdir(directory)).filter((file) => /\.csv$/i.test(file) && !tabs.some((tab) => file === `${tab}.csv`)).sort()) {
    const path = join(directory, file);
    if ((await stat(path)).size > 5_000_000) throw new Error('Supplemental CSV exceeds 5 MB');
    const bytes = await readFile(path);
    supplementalFiles.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    // Base64 retains BOM, encoding and line endings without interpreting unknown schemas.
    sidecar.supplementalFiles ??= [];
    sidecar.supplementalFiles.push({ file, encoding: 'base64', content: bytes.toString('base64') });
  }
  const grouped = (rows, field) => rows.reduce((counts, row) => { const key = String(row[field]); counts[key] = (counts[key] || 0) + 1; return counts; }, Object.create(null));
  const unknown = (v) => !v || ['미확인', '해당 없음', 'unknown', 'not_applicable'].includes(v);
  const report = {
    version: 1, asOf, publication: 'hold', files, supplementalFiles,
    counts: Object.fromEntries(files.map(({ tab, rows }) => [tab, rows])),
    changes, sidecarRows: Object.fromEntries(Object.keys(sidecar).map((tab) => [tab, sidecar[tab].length])),
    errors: result.errors, errorCounts: grouped(result.errors, 'code'), warningCount: result.warnings.length,
    factsFromSubmission: {
      artistTypes: grouped(original.artists, 'entity_type'),
      missingOfficialArtistUrls: original.artists.filter((r) => unknown(r.official_url)).length,
      eventStatuses: grouped(original.events, 'status'),
      endedBeforeAudit: original.events.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.end_date) && r.end_date < asOf).length,
      sourceReviewStatuses: grouped(original.sources, 'review_status'),
      uniqueSourceUrls: new Set(original.sources.map((r) => r.url)).size,
      sourceMethods: grouped(original.sources, 'collection_method'),
      sourceHosts: grouped(original.sources.map((r) => { try { return { host: new URL(r.url).hostname }; } catch { return { host: 'invalid' }; } }), 'host'),
      unknownPlaceOperatingStatus: original.places.filter((r) => unknown(r.operating_status)).length,
      completeHourIntervals: original.hours.filter((r) => /^([01]\d|2[0-3]):[0-5]\d$/.test(r.opens) && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.closes)).length,
    },
    note: 'Receipt and format audit only. Candidate omits extra fields; original and sidecar must be retained. No automatic upload/publication or factual approval.',
  };
  return { report, original, candidate, sidecar };
}
