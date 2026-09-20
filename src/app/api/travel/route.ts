/**
 * 구간별 이동시간 조회. 브라우저는 좌표와 이동수단만 보내고, 카카오 REST API 키는 서버에만 있다.
 *
 * 인증이 없는 공개 엔드포인트다. 대신 다음으로 남용과 요금을 막는다.
 *  - 한 요청당 구간 수 상한, 좌표는 한국 범위만 허용, 이름 길이 제한
 *  - 같은 구간은 프로세스 메모리에 짧게 캐시 (일 1,000건 무료 쿼터 보호)
 *  - IP별 분당 요청 상한, 프로세스 단위 일일 외부 조회 상한
 * 한계: 메모리 기반이라 서버 인스턴스마다 따로 센다. 운영 규모가 커지면 공용 저장소로 옮겨야 한다.
 */

import { isKoreanCoord, roundCoord, type TravelPoint } from "@/lib/trip/geo";
import { isKakaoConfigured, lookupLeg } from "@/lib/trip/kakao";
import { legKey, travelReasons, unconfirmed, type TravelEstimate, type TravelMode } from "@/lib/trip/travel";

export const dynamic = "force-dynamic";

const MAX_LEGS = 42;              // 6곳 선택의 구간 조합 30개 + 출발/종료 12개
const MAX_BODY_BYTES = 16 * 1024;
const CACHE_TTL_MS = 10 * 60_000; // 대중교통 소요시간은 시간대에 따라 변한다. 길게 두지 않는다.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;
const DAILY_LOOKUP_BUDGET = 800;  // 무료 쿼터 1,000건 아래로 여유를 둔다.

type CacheEntry = { estimate: TravelEstimate; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const hits = new Map<string, number[]>();
let budget = { day: "", used: 0 };

const today = () => new Date().toISOString().slice(0, 10);

function withinBudget(count: number) {
  const day = today();
  if (budget.day !== day) budget = { day, used: 0 };
  if (budget.used + count > DAILY_LOOKUP_BUDGET) return false;
  budget.used += count;
  return true;
}

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(at => now - at < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) for (const [key, times] of hits) if (!times.some(at => now - at < RATE_WINDOW_MS)) hits.delete(key);
  return recent.length > RATE_MAX_REQUESTS;
}

const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max;

function readPoint(value: unknown): TravelPoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!text(raw.id, 80) || !text(raw.name, 120)) return null;
  if (raw.address !== undefined && !text(raw.address, 300)) return null;
  // 좌표가 없거나 한국 범위를 벗어나면 좌표 없는 지점으로 받는다 (조회하지 않고 미확인으로 돌려준다).
  const coord = isKoreanCoord(raw.coord) ? roundCoord(raw.coord) : undefined;
  return { id: raw.id as string, name: raw.name as string, address: raw.address as string | undefined, coord };
}

const cacheKey = (from: TravelPoint, to: TravelPoint, mode: TravelMode) =>
  `${mode}|${from.coord?.lat},${from.coord?.lng}|${to.coord?.lat},${to.coord?.lng}`;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "Too many route lookups. Try again in a minute." }, { status: 429 });

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return Response.json({ error: "Request is too large." }, { status: 413 });
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!parsed || typeof parsed !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });

  const payload = parsed as Record<string, unknown>;
  const mode: TravelMode = payload.mode === "walk" ? "walk" : "transit";
  const bufferMinutes = Number.isInteger(payload.bufferMinutes) && (payload.bufferMinutes as number) >= 5 && (payload.bufferMinutes as number) <= 120
    ? payload.bufferMinutes as number : 45;
  const rawLegs = Array.isArray(payload.legs) ? payload.legs : null;
  if (!rawLegs || !rawLegs.length) return Response.json({ error: "Send at least one leg." }, { status: 400 });
  if (rawLegs.length > MAX_LEGS) return Response.json({ error: `Send at most ${MAX_LEGS} legs.` }, { status: 400 });

  const legs: { from: TravelPoint; to: TravelPoint }[] = [];
  for (const raw of rawLegs) {
    const from = readPoint((raw as Record<string, unknown>)?.from);
    const to = readPoint((raw as Record<string, unknown>)?.to);
    if (!from || !to) return Response.json({ error: "Each leg needs a from and to with id and name." }, { status: 400 });
    legs.push({ from, to });
  }

  const configured = isKakaoConfigured();
  const estimates: Record<string, TravelEstimate> = {};
  const now = Date.now();
  const pending: { from: TravelPoint; to: TravelPoint; key: string; cache: string }[] = [];

  for (const { from, to } of legs) {
    const key = legKey(from.id, to.id, mode);
    if (estimates[key]) continue;
    if (!configured) { estimates[key] = unconfirmed(from, to, mode, bufferMinutes, travelReasons.noKey); continue; }
    if (!from.coord || !to.coord) { estimates[key] = unconfirmed(from, to, mode, bufferMinutes, travelReasons.noCoord); continue; }
    const cached = cache.get(cacheKey(from, to, mode));
    if (cached && cached.expiresAt > now) { estimates[key] = cached.estimate; continue; }
    pending.push({ from, to, key, cache: cacheKey(from, to, mode) });
  }

  if (pending.length && !withinBudget(pending.length)) {
    for (const leg of pending) estimates[leg.key] = unconfirmed(leg.from, leg.to, mode, bufferMinutes, travelReasons.lookupFailed);
    return Response.json({ configured, estimates, budgetExhausted: true });
  }

  const results = await Promise.all(pending.map(leg => lookupLeg(leg.from, leg.to, mode, bufferMinutes)));
  pending.forEach((leg, index) => {
    const estimate = results[index];
    estimates[leg.key] = estimate;
    // 실패는 캐시하지 않는다. 다음 요청에서 다시 시도할 수 있어야 한다.
    if (estimate.status === "known") cache.set(leg.cache, { estimate, expiresAt: now + CACHE_TTL_MS });
  });
  if (cache.size > 2_000) for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);

  return Response.json({ configured, estimates });
}
