/**
 * 구간별 이동시간 조회. 브라우저는 좌표와 이동수단만 보내고, 카카오 REST API 키는 서버에만 있다.
 *
 * 인증이 없는 공개 엔드포인트다. 대신 다음으로 남용과 요금을 막는다.
 *  - 본문을 **읽는 중에** 바이트로 세어 상한을 넘으면 끊는다 (Content-Length가 없어도 막힌다)
 *  - 구간 수 상한, 한국 좌표만 허용, 같은 id에 다른 좌표가 오면 거부
 *  - **좌표·방향·수단이 같으면 외부 호출 1회.** 여러 구간 id가 같은 좌표를 가리켜도 호출은 한 번이다
 *  - 모든 외부 호출에 AbortSignal과 시간 제한. 무응답이면 이동시간 미확인으로 떨어진다
 *  - IP별 분당 요청 상한, 고유 호출 기준 일일 예산, 성공 응답만 10분 캐시
 *
 * 한계 (T-024 검토 반영): 일일 예산과 분당 상한은 **프로세스 메모리 기반**이라 서버 인스턴스마다
 * 따로 센다. 서비스 전체 요금 상한이 아니다. 공개 배포 전에 공용 예산 저장소를 붙이거나
 * 카카오 콘솔에서 실제 호출 차단(무료 쿼터 초과 시 중단) 설정을 확인해야 한다.
 * 무료 초과분을 유료로 켜는 것으로 해결하지 않는다.
 */

import { seoulDate } from "@/lib/seoul-date";
import { isKoreanCoord, roundCoord, type Coord, type TravelPoint } from "@/lib/trip/geo";
import { isKakaoConfigured, lookupLeg, UPSTREAM_TIMEOUT_MS } from "@/lib/trip/kakao";
import { legKey, travelReasons, unconfirmed, type TravelEstimate, type TravelMode, type TravelReason } from "@/lib/trip/travel";

export const dynamic = "force-dynamic";

const MAX_LEGS = 42;              // 6곳 선택의 구간 조합 30개 + 출발/종료 12개
const MAX_BODY_BYTES = 16 * 1024;
const CACHE_TTL_MS = 10 * 60_000; // 대중교통 소요시간은 시간대에 따라 변한다. 길게 두지 않는다.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;
/** 무료 쿼터(일 1,000건) 아래로 여유를 둔 고유 호출 상한. 운영에서 환경 변수로 낮출 수 있다. */
const DAILY_LOOKUP_BUDGET = Math.max(0, Number(process.env.TRAVEL_DAILY_LOOKUP_BUDGET ?? 800) || 0);
/** 한 요청이 외부 조회에 쓸 수 있는 전체 시간. 넘으면 남은 구간은 미확인으로 돌려준다. */
const REQUEST_DEADLINE_MS = 9_000;

type CacheEntry = { estimate: TravelEstimate; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const hits = new Map<string, number[]>();
let budget = { day: "", used: 0 };

/** 일일 상한은 한국 시간 자정에 초기화한다(T-059). */
const today = () => seoulDate();

/** 고유 호출 수만큼 예산을 쓴다. 중복 구간은 예산을 소모하지 않는다. */
function takeBudget(count: number) {
  const day = today();
  if (budget.day !== day) budget = { day, used: 0 };
  const available = Math.max(0, DAILY_LOOKUP_BUDGET - budget.used);
  const granted = Math.min(count, available);
  budget.used += granted;
  return granted;
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

/**
 * 본문을 바이트로 세면서 읽는다.
 *
 * `request.text()`로 먼저 다 읽고 문자열 길이를 보면 두 번 틀린다. UTF-8 한글은 글자 하나가
 * 3바이트라 14,884자가 40,084바이트가 되고, 이미 다 읽은 뒤라 상한이 방어가 되지 않는다.
 * Content-Length는 청크 전송에서 없을 수 있으므로 스트림을 세는 쪽이 본선이다.
 */
async function readLimitedBody(request: Request, limit: number): Promise<{ text: string } | { tooLarge: true }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) return { tooLarge: true };
  const stream = request.body;
  if (!stream) {
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > limit) return { tooLarge: true };
    return { text: new TextDecoder().decode(buffer) };
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > limit) { try { await reader.cancel(); } catch { /* 이미 닫힌 스트림 */ } return { tooLarge: true }; }
      chunks.push(value);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* 취소 후에는 잠금이 이미 풀려 있다 */ }
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return { text: new TextDecoder().decode(merged) };
}

function readPoint(value: unknown): TravelPoint | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (!text(raw.id, 80) || !text(raw.name, 120)) return null;
  if (raw.address !== undefined && !text(raw.address, 300)) return null;
  // 좌표가 없거나 한국 범위를 벗어나면 좌표 없는 지점으로 받는다 (조회하지 않고 미확인으로 돌려준다).
  const coord = isKoreanCoord(raw.coord) ? roundCoord(raw.coord) : undefined;
  return { id: raw.id as string, name: raw.name as string, address: raw.address as string | undefined, coord };
}

const coordKey = (coord: Coord | undefined) => coord ? `${coord.lat},${coord.lng}` : "none";
/** 같은 id가 같은 대상을 가리키는지 확인하는 지문. 좌표만 다른데 id가 같으면 구간 키가 충돌한다. */
const identity = (point: TravelPoint) => `${coordKey(point.coord)}|${point.name}|${point.address ?? ""}`;
/** 외부 호출 단위. id가 아니라 좌표·방향·수단으로 묶어야 중복 호출이 사라진다. */
const callKey = (from: TravelPoint, to: TravelPoint, mode: TravelMode) =>
  `${mode}|${coordKey(from.coord)}>${coordKey(to.coord)}`;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "Too many route lookups. Try again in a minute." }, { status: 429 });

  const read = await readLimitedBody(request, MAX_BODY_BYTES);
  if ("tooLarge" in read) return Response.json({ error: `Request body must be ${MAX_BODY_BYTES} bytes or fewer.` }, { status: 413 });
  let parsed: unknown;
  try { parsed = JSON.parse(read.text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!parsed || typeof parsed !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });

  const payload = parsed as Record<string, unknown>;
  const mode: TravelMode = payload.mode === "walk" ? "walk" : "transit";
  const bufferMinutes = Number.isInteger(payload.bufferMinutes) && (payload.bufferMinutes as number) >= 5 && (payload.bufferMinutes as number) <= 120
    ? payload.bufferMinutes as number : 45;
  const rawLegs = Array.isArray(payload.legs) ? payload.legs : null;
  if (!rawLegs || !rawLegs.length) return Response.json({ error: "Send at least one leg." }, { status: 400 });
  if (rawLegs.length > MAX_LEGS) return Response.json({ error: `Send at most ${MAX_LEGS} legs.` }, { status: 400 });

  const legs: { from: TravelPoint; to: TravelPoint }[] = [];
  // 같은 id는 같은 지점이어야 한다. 좌표가 다르면 구간 키가 겹쳐 엉뚱한 응답이 붙는다.
  const identities = new Map<string, string>();
  for (const raw of rawLegs) {
    const from = readPoint((raw as Record<string, unknown>)?.from);
    const to = readPoint((raw as Record<string, unknown>)?.to);
    if (!from || !to) return Response.json({ error: "Each leg needs a from and to with id and name." }, { status: 400 });
    for (const point of [from, to]) {
      const seen = identities.get(point.id);
      if (seen !== undefined && seen !== identity(point)) {
        return Response.json({ error: `Point id ${point.id} was sent with different coordinates or names in one request.` }, { status: 400 });
      }
      identities.set(point.id, identity(point));
    }
    legs.push({ from, to });
  }

  const configured = isKakaoConfigured();
  const estimates: Record<string, TravelEstimate> = {};
  const now = Date.now();
  /** 고유 외부 호출 1건 = pending 1건. legKeys는 그 답을 붙일 구간 키들이다. */
  const pending = new Map<string, { from: TravelPoint; to: TravelPoint; legKeys: string[] }>();

  const settle = (from: TravelPoint, to: TravelPoint, key: string, reason: TravelReason) => {
    estimates[key] = unconfirmed(from, to, mode, bufferMinutes, reason);
  };

  for (const { from, to } of legs) {
    const key = legKey(from.id, to.id, mode);
    if (estimates[key] !== undefined) continue;
    if (!configured) { settle(from, to, key, travelReasons.noKey); continue; }
    if (!from.coord || !to.coord) { settle(from, to, key, travelReasons.noCoord); continue; }
    const call = callKey(from, to, mode);
    const cached = cache.get(call);
    if (cached && cached.expiresAt > now) { estimates[key] = cached.estimate; continue; }
    const existing = pending.get(call);
    // 이미 같은 좌표·방향·수단을 조회 대기 중이면 호출을 늘리지 않고 응답만 공유한다.
    if (existing) { existing.legKeys.push(key); continue; }
    pending.set(call, { from, to, legKeys: [key] });
  }

  const queued = [...pending.entries()];
  const granted = queued.length ? takeBudget(queued.length) : 0;
  const runnable = queued.slice(0, granted);
  for (const [, leg] of queued.slice(granted)) {
    // 예산을 넘긴 구간은 조용히 비우지 않고 사유를 남긴다.
    for (const key of leg.legKeys) settle(leg.from, leg.to, key, travelReasons.budgetReached);
  }

  if (runnable.length) {
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), REQUEST_DEADLINE_MS);
    const clientAbort = () => deadline.abort();
    request.signal?.addEventListener("abort", clientAbort, { once: true });
    try {
      const results = await Promise.all(runnable.map(([, leg]) =>
        lookupLeg(leg.from, leg.to, mode, bufferMinutes, { signal: deadline.signal, timeoutMs: UPSTREAM_TIMEOUT_MS })));
      runnable.forEach(([call, leg], index) => {
        const estimate = results[index];
        for (const key of leg.legKeys) estimates[key] = estimate;
        // 실패는 캐시하지 않는다. 다음 요청에서 다시 시도할 수 있어야 한다.
        if (estimate.status === "known") cache.set(call, { estimate, expiresAt: now + CACHE_TTL_MS });
      });
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", clientAbort);
    }
  }
  if (cache.size > 2_000) for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);

  return Response.json({
    configured,
    estimates,
    /** 이번 요청이 실제로 외부에 보낸 고유 호출 수. 중복 구간은 포함되지 않는다. */
    upstreamCalls: runnable.length,
    budgetExhausted: granted < queued.length,
  });
}
