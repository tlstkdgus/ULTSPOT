// Read-only audit of a trusted local checkout; no real keys or network calls.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import ts from 'typescript';

if (!process.argv[2]) throw new Error('Usage: node scripts/review/travel-contract.mjs <trusted-checkout>');
const root = path.resolve(process.argv[2]);
const files = ['src/lib/trip/geo.ts', 'src/lib/trip/travel.ts', 'src/lib/trip/kakao.ts', 'src/app/api/travel/route.ts'];
const sources = Object.fromEntries(files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
function load(file, fetch, modules = {}) {
  if (modules[file]) return modules[file].exports;
  if (!Object.hasOwn(sources, file)) throw new Error(`Unexpected import: ${file}`);
  const loaded = { exports: {} }; modules[file] = loaded;
  const requireLocal = id => {
    if (id === 'server-only') return {};
    return load(id.startsWith('@/') ? `src/${id.slice(2)}.ts` : path.posix.normalize(path.posix.join(path.posix.dirname(file), `${id}.ts`)), fetch, modules);
  };
  const code = ts.transpileModule(sources[file], { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, {
    module: loaded, exports: loaded.exports, require: requireLocal, fetch, Request, Response, URL,
    AbortSignal, AbortController, TextEncoder, TextDecoder, Buffer, setTimeout, clearTimeout,
    process: { env: { KAKAO_REST_API_KEY: 'synthetic-audit-key' } },
  }, { filename: file });
  return loaded.exports;
}
const from = { id: 'a', name: '출발', coord: { lat: 37.5, lng: 127 } };
const to = { id: 'b', name: '도착', coord: { lat: 37.51, lng: 127.01 } };
const success = { status: 'OK', route: { properties: { totalTime: 3914 } } };
const request = legs => new Request('http://localhost/api/travel', { method: 'POST', body: JSON.stringify({ mode: 'walk', legs }) });
const checks = [];
const record = (name, pass, observed, expected) => checks.push({ name, pass, observed, expected });
const parser = load('src/lib/trip/kakao.ts', () => { throw Error('Network disabled'); });
record('walk-seconds-to-minutes', parser.parseWalkRoute(success, from, to, 45, () => '2026-09-20T00:00:00Z').minutes === 66, parser.parseWalkRoute(success, from, to, 45, () => '').minutes, 66);
const transit = parser.parseTransitRoute({ status: 'OK', routes: [{ properties: { totalTime: 2115 } }, { properties: { totalTime: 1801 } }] }, from, to, 45, () => '2026-09-20T00:00:00Z');
record('transit-shorter-route', transit.minutes === 31, transit.minutes, 31);

let calls = 0;
let route = load('src/app/api/travel/route.ts', async () => { calls++; return Response.json(success); });
let body = await (await route.POST(request(Array(42).fill({ from, to })))).json();
record('duplicate-legs', calls === 1 && Object.keys(body.estimates).length === 1, { calls, estimates: Object.keys(body.estimates).length }, { calls: 1, estimates: 1 });

let signal;
route = load('src/app/api/travel/route.ts', async (_, options) => { signal = options.signal; return Response.json(success); });
await route.POST(request([{ from, to }]));
record('upstream-abort-signal', Boolean(signal), Boolean(signal), true);
// Signal presence alone does not prove a bounded timeout. A hanging-provider test is still required.

const bigLegs = Array.from({ length: 15 }, (_, i) => ({ from: { ...from, id: `a${i}`, name: '가'.repeat(120), address: '가'.repeat(300) }, to: { ...to, id: `b${i}`, name: '나'.repeat(120), address: '나'.repeat(300) } }));
const bigRequest = request(bigLegs);
const raw = await bigRequest.clone().text();
route = load('src/app/api/travel/route.ts', async () => Response.json(success));
const bigResponse = await route.POST(bigRequest);
record('utf8-body-limit', bigResponse.status === 413, { bytes: Buffer.byteLength(raw), characters: raw.length, status: bigResponse.status }, { status: 413 });

calls = 0;
route = load('src/app/api/travel/route.ts', async () => { calls++; return Response.json(success); });
const conflict = await route.POST(request([{ from, to }, { from: { ...from, coord: { lat: 37.6, lng: 127.1 } }, to }]));
record('conflicting-point-id', conflict.status === 400 && calls === 0, { status: conflict.status, calls }, { status: 400, calls: 0 });

calls = 0;
route = load('src/app/api/travel/route.ts', async () => { calls++; return Response.json(success); });
body = await (await route.POST(request([{ from: { id: 'a', name: 'No coordinates' }, to }]))).json();
record('missing-coordinates', calls === 0 && body.estimates['a>b:walk'].status === 'unconfirmed', { calls, status: body.estimates['a>b:walk'].status }, { calls: 0, status: 'unconfirmed' });
route = load('src/app/api/travel/route.ts', async () => { throw Error('Synthetic outage'); });
body = await (await route.POST(request([{ from, to }]))).json();
record('provider-outage', body.estimates['a>b:walk'].status === 'unconfirmed', body.estimates['a>b:walk'].status, 'unconfirmed');

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(), networkCalls: 0,
  sourceHashes: Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(sources[file]).digest('hex')])),
  passed: checks.filter(c => c.pass).length, failed: checks.filter(c => !c.pass).length, checks,
}, null, 2));
process.exitCode = checks.every(c => c.pass) ? 0 : 1;
