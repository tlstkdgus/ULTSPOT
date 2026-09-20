import { createHash } from 'node:crypto';
import { readFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { schema, tabs, enums, optionalTabs } from './schema.mjs';

const unknown = (v) => ['미확인', '해당 없음', 'unknown', 'not_applicable'].includes(v);
const missing = (v) => v === undefined || v === null || v === '';
const known = (v) => !missing(v) && !unknown(v);
const id = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const lists = new Set(['source_ids', 'aliases', 'supported_fields']);
const dateFields = new Set(['start_date', 'end_date', 'date', 'debut_date', 'anniversary_date', 'content_date', 'applicable_date']);
const timeFields = new Set(['opens', 'closes', 'last_entry', 'last_order']);
const stampFields = new Set(['checked_at', 'rights_checked_at', 'published_at', 'booking_start', 'booking_end', 'sold_out_at', 'expires_at', 'starts_at', 'ends_at', 'opens_at', 'closes_at']);
const numericFields = new Set(['latitude', 'longitude', 'price_amount', 'visit_minutes_estimate', 'quantity', 'per_person_limit', 'close_day_offset', 'weekday']);
export const validDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v).toISOString().slice(0, 10) === v;
const minutes = (v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));

export async function readBundle(path) {
  const info = await stat(path);
  const read = async (file) => {
    if ((await stat(file)).size > 5_000_000) throw new Error('Input file exceeds 5 MB limit');
    return (await readFile(file, 'utf8')).replace(/^\uFEFF/, '');
  };
  if (!info.isDirectory()) return JSON.parse(await read(path));
  // Sidecars belong in audit receipts, never silently disappear from strict intake.
  if ((await readdir(path)).some((file) => /\.csv$/i.test(file) && !tabs.some((tab) => file === `${tab}.csv`))) throw new Error('Unsupported CSV files; run data:audit to preserve sidecars first');
  const bundle = {};
  for (const name of tabs) {
    let contents;
    try { contents = await read(join(path, `${name}.csv`)); }
    catch (error) { if (error.code === 'ENOENT' && optionalTabs.includes(name)) continue; throw error; }
    const records = parse(contents, { bom: true, skip_empty_lines: true });
    const headers = records.shift();
    if (!headers || new Set(headers).size !== headers.length) throw new Error(`${name}: missing or duplicate CSV headers`);
    if (schema[name].required.some((key) => !headers.includes(key)) || headers.some((key) => !schema[name].fields.includes(key))) throw new Error(`${name}: invalid CSV headers`);
    bundle[name] = records.map((values) => Object.fromEntries(headers.map((key, i) => [key, values[i]])));
  }
  return bundle;
}

export function validate(input) {
  const errors = [], warnings = [], bundle = {};
  const issue = (name, row, field, code) => errors.push({ tab: name, row, field, code });
  if (!input || Array.isArray(input) || typeof input !== 'object') return { errors: [{ code: 'expected_object' }], warnings, bundle };
  for (const name of Object.keys(input)) if (!tabs.includes(name)) issue(name, 0, '', 'unexpected_tab');
  for (const name of tabs) {
    if (!(name in input) && optionalTabs.includes(name)) continue;
    if (!Array.isArray(input[name]) || input[name].length > 10000) { issue(name, 0, '', 'expected_array_max_10000'); bundle[name] = []; continue; }
    const spec = schema[name];
    bundle[name] = input[name].map((raw, i) => {
      if (!raw || Array.isArray(raw) || typeof raw !== 'object') { issue(name, i + 1, '', 'expected_row_object'); return {}; }
      const row = {};
      for (const field of Object.keys(raw)) {
        if (!spec.fields.includes(field)) { issue(name, i + 1, field, 'unexpected_field'); continue; }
        let value = raw[field];
        if (lists.has(field)) {
          value = Array.isArray(value) ? value : typeof value === 'string' ? value.split('|').filter(Boolean) : [];
          if (!value.every((item) => typeof item === 'string' && item.length <= 2000)) issue(name, i + 1, field, 'expected_string_list');
        } else if (!['string', 'number', 'boolean'].includes(typeof value) || String(value).length > 10000 || String(value).includes('\0')) issue(name, i + 1, field, 'expected_scalar_max_10000');
        row[field] = value;
        if (unknown(value)) warnings.push({ tab: name, row: i + 1, field, code: 'unresolved_fact' });
        if (!known(value) || lists.has(field)) continue;
        if (field.endsWith('_id') && !id.test(String(value)) && field !== 'target_id') issue(name, i + 1, field, 'invalid_id');
        if (dateFields.has(field) && !safeDate(value)) issue(name, i + 1, field, 'invalid_date');
        if (['valid_from', 'valid_to'].includes(field) && !partialDateBounds(value)) issue(name, i + 1, field, 'invalid_partial_date');
        if (timeFields.has(field) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) issue(name, i + 1, field, 'invalid_time');
        if (stampFields.has(field) && (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(value) || !safeDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value)))) issue(name, i + 1, field, 'invalid_timestamp');
        if (field === 'url' || field.endsWith('_url')) {
          try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
          catch { issue(name, i + 1, field, 'expected_https_url_without_credentials'); }
        }
        if (enums[field] && !enums[field].includes(value)) issue(name, i + 1, field, 'invalid_enum');
        if (field === 'timezone' && value !== 'Asia/Seoul') issue(name, i + 1, field, 'unsupported_timezone');
        if (numericFields.has(field)) {
          const n = typeof value === 'boolean' ? NaN : Number(value);
          const range = field === 'latitude' ? [-90, 90] : field === 'longitude' ? [-180, 180] : field === 'weekday' ? [0, 6] : field === 'close_day_offset' ? [0, 1] : [0, 1000000000];
          if (!Number.isFinite(n) || n < range[0] || n > range[1] || (!['latitude', 'longitude', 'price_amount'].includes(field) && !Number.isInteger(n))) issue(name, i + 1, field, 'invalid_number');
        }
      }
      for (const field of spec.required) if (missing(row[field]) || (Array.isArray(row[field]) && row[field].length === 0)) issue(name, i + 1, field, 'required');
      for (const field of spec.key) if (typeof row[field] !== 'string' || !id.test(row[field]) || unknown(row[field])) issue(name, i + 1, field, 'required_id');
      return row;
    });
  }
  const keys = {};
  for (const name of tabs) {
    keys[name] = new Set();
    (bundle[name] || []).forEach((row, i) => {
      const key = schema[name].key.map((field) => row[field]).join('::');
      if (keys[name].has(key)) issue(name, i + 1, '', 'duplicate_id');
      keys[name].add(key);
    });
  }
  const targetTabs = { artist: 'artists', artist_relation: 'artist_relations', place: 'places', event: 'events', event_artist: 'event_artists', place_artist: 'place_artists', hours: 'hours', benefit: 'benefits', asset: 'assets', event_session: 'event_sessions', booking_window: 'booking_windows', event_condition: 'event_conditions' };
  for (const name of tabs) (bundle[name] || []).forEach((row, i) => {
    const fail = (field, code) => issue(name, i + 1, field, code);
    const ref = (field, table, required = false) => { if ((required || known(row[field])) && !keys[table]?.has(row[field])) fail(field, 'unresolved_reference'); };
    for (const field of ['artist_id', 'parent_artist_id', 'child_artist_id']) if (name !== 'artists' && field in row) ref(field, 'artists', true);
    if (name !== 'places' && 'place_id' in row) ref('place_id', 'places', true);
    if (name !== 'events' && 'event_id' in row) ref('event_id', 'events', true);
    if (name === 'booking_windows') {
      ref('session_id', 'event_sessions', true);
      const session = bundle.event_sessions?.find((s) => s.session_id === row.session_id);
      if (session && session.event_id !== row.event_id) fail('session_id', 'session_event_mismatch');
      if (!['presale', 'general', 'accessible', 'other', 'unknown'].includes(row.booking_type)) fail('booking_type', 'invalid_enum');
    }
    ref('image_asset_id', 'assets'); ref('coordinate_source_id', 'sources');
    if (Array.isArray(row.source_ids)) for (const value of row.source_ids) if (!keys.sources.has(value)) fail('source_ids', 'unresolved_reference');
    if (name === 'hours' || name === 'sources') {
      const target = Object.hasOwn(targetTabs, row.target_type) ? targetTabs[row.target_type] : undefined;
      if (!target || (name === 'hours' && !['event', 'place'].includes(row.target_type))) fail('target_type', 'invalid_target');
      else if (!keys[target].has(row.target_id)) fail('target_id', 'unresolved_reference');
      if (name === 'sources' && target && Array.isArray(row.supported_fields) && row.supported_fields.some((field) => !schema[target].fields.includes(field))) fail('supported_fields', 'unknown_target_field');
    }
    for (const [start, end] of [['start_date', 'end_date'], ['booking_start', 'booking_end'], ['starts_at', 'ends_at'], ['opens_at', 'closes_at']]) if (known(row[start]) && known(row[end]) && Date.parse(row[start]) > Date.parse(row[end])) fail(end, 'end_before_start');
    if (name === 'event_sessions' && known(row.starts_at) && Number.isFinite(Date.parse(row.starts_at)) && row.date !== new Date(Date.parse(row.starts_at) + 9 * 3600000).toISOString().slice(0, 10)) fail('date', 'session_date_mismatch');
    if (name === 'events' && known(row.status) && !['scheduled', 'ongoing', 'ended', 'cancelled', 'postponed'].includes(row.status)) fail('status', 'invalid_enum');
    if (name === 'artist_relations') {
      const from = partialDateBounds(row.valid_from), to = partialDateBounds(row.valid_to);
      if (from && to && from.min > to.max) fail('valid_to', 'end_before_start');
      if (row.parent_artist_id === row.child_artist_id) fail('child_artist_id', 'self_relation');
      if (known(row.status) && !['current', 'past'].includes(row.status)) fail('status', 'invalid_enum');
    }
    if (name === 'hours') {
      if (row.schedule_type === 'date' && !safeDate(row.date)) fail('date', 'required_date');
      if (row.schedule_type === 'weekday' && (!known(row.weekday) || !Number.isInteger(Number(row.weekday)) || Number(row.weekday) < 0 || Number(row.weekday) > 6)) fail('weekday', 'required_weekday_0_sunday');
      if (row.state === 'open') {
        if (![row.opens, row.closes].every((v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v))) fail('opens', 'open_requires_times');
        else if (minutes(row.closes) + (Number(row.close_day_offset) || 0) * 1440 <= minutes(row.opens)) fail('closes', 'nonpositive_interval');
      }
    }
  });
  const children = new Map(), degree = new Map();
  for (const row of bundle.artist_relations) {
    const a = row.parent_artist_id, b = row.child_artist_id;
    if (!children.has(a)) children.set(a, []);
    children.get(a).push(b);
    degree.set(a, degree.get(a) || 0);
    degree.set(b, (degree.get(b) || 0) + 1);
  }
  const queue = [...degree.keys()].filter((key) => degree.get(key) === 0);
  for (let n = 0; n < queue.length; n++) for (const child of children.get(queue[n]) || []) {
    degree.set(child, degree.get(child) - 1);
    if (degree.get(child) === 0) queue.push(child);
  }
  if (queue.length !== degree.size) issue('artist_relations', 0, '', 'relation_cycle');
  return { errors, warnings, bundle };
}
function safeDate(value) { try { return validDate(value); } catch { return false; } }

// Bounds are only for contradiction checks, never published as invented exact dates.
export function partialDateBounds(value) {
  if (typeof value !== 'string') return null;
  if (/^\d{4}$/.test(value) && value !== '0000') return { precision: 'year', min: `${value}-01-01`, max: `${value}-12-31` };
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value) && !value.startsWith('0000')) {
    const [year, month] = value.split('-').map(Number);
    const last = new Date(`${value}-01T00:00:00Z`); last.setUTCMonth(month); last.setUTCDate(0);
    return { precision: 'month', min: `${value}-01`, max: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${last.getUTCDate()}` };
  }
  return safeDate(value) ? { precision: 'day', min: value, max: value } : null;
}

export function prepare(bundle, batchId) {
  if (!id.test(batchId)) throw new Error('Invalid batch ID');
  const result = validate(bundle);
  if (result.errors.length) throw new Error('Validation failed; run check first');
  const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
  const payload = JSON.stringify(canonical(result.bundle));
  if (Buffer.byteLength(payload) > 10_000_000) throw new Error('Bundle exceeds 10 MB');
  const digest = createHash('sha256').update(payload).digest('hex');
  const encoded = Buffer.from(payload).toString('base64');
  const sql = `-- Private intake only. This never publishes catalog records.\nBEGIN;\nINSERT INTO catalog_private.intake_versions (batch_id, digest, payload_text)\nVALUES ('${batchId}', '${digest}', convert_from(decode('${encoded}', 'base64'), 'UTF8'))\nON CONFLICT (batch_id, digest) DO NOTHING;\nCOMMIT;\n`;
  return { digest, sql, warnings: result.warnings };
}
