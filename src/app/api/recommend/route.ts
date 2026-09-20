/**
 * 필수 방문 행사 주변의 식사·휴식·관광 제안. 키는 서버에만 있다.
 *
 * 흐름: 카카오 장소 검색(주변 후보) → **코드가** 자격을 정리 → Jev가 취향 순위만 매김.
 * Jev는 영업시간·예약·이동시간·좌표를 만들지 않는다. 그 판단은 코드와 카카오 API가 한다.
 *
 * 어떤 단계가 실패해도 추천은 끊기지 않는다.
 *  - 카카오 실패/키 없음 → 제안 0건을 솔직히 돌려준다 (가짜 장소를 만들지 않는다)
 *  - Jev 실패/느림/근거 부족 → 거리순 기본 추천으로 돌아가고 그 사실을 알린다
 *
 * 자동 편성하지 않는다. 카카오 장소 검색에는 영업시간이 없어 "열려 있다"고 말할 수 없다.
 *
 * 한계: 아래 한도는 프로세스 메모리 기반이라 인스턴스마다 따로 센다. 서비스 전체 상한이 아니다.
 * 공개 배포 전에 공용 저장소나 공급자 측 호출 차단 설정이 필요하다.
 */

import { isKoreanCoord, roundCoord, type Coord } from "@/lib/trip/geo";
import { isKakaoConfigured } from "@/lib/trip/kakao";
import {
  NEARBY_PER_KIND, NEARBY_RADIUS_M, searchNearby, suggestionFacts,
  type Suggestion, type SuggestionKind,
} from "@/lib/recommend/nearby";
import {
  isJevConfigured, jevFallbackReasons, rankByPreference, JEV_MAX_CANDIDATES, JEV_MAX_PREFERENCE,
  type JevRanking,
} from "@/lib/recommend/jev";

export const dynamic = "force-dynamic";

const KINDS: SuggestionKind[] = ["meal", "cafe", "sightseeing"];
const MAX_BODY_BYTES = 8 * 1024;
const SEARCH_CACHE_TTL_MS = 30 * 60_000;  // 주변 장소 목록은 분 단위로 바뀌지 않는다.
const RANK_CACHE_TTL_MS = 10 * 60_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 30;
const DAILY_SEARCH_BUDGET = Math.max(0, Number(process.env.NEARBY_DAILY_SEARCH_BUDGET ?? 600) || 0);
const DAILY_RANK_BUDGET = Math.max(0, Number(process.env.JEV_DAILY_RANK_BUDGET ?? 300) || 0);
const REQUEST_DEADLINE_MS = 9_000;

const searchCache = new Map<string, { suggestions: Suggestion[]; expiresAt: number }>();
const rankCache = new Map<string, { ranking: JevRanking; expiresAt: number }>();
const hits = new Map<string, number[]>();
const budgets = new Map<string, { day: string; used: number }>();

const today = () => new Date().toISOString().slice(0, 10);

function takeBudget(name: string, limit: number, count: number) {
  const day = today();
  const current = budgets.get(name);
  const state = current && current.day === day ? current : { day, used: 0 };
  const granted = Math.min(count, Math.max(0, limit - state.used));
  budgets.set(name, { day, used: state.used + granted });
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

/** route.ts와 같은 이유로 바이트로 세면서 읽는다. 한글은 글자당 3바이트다. */
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

const coordKey = (coord: Coord) => `${coord.lat},${coord.lng}`;

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "Too many suggestion requests. Try again in a minute." }, { status: 429 });

  const read = await readLimitedBody(request, MAX_BODY_BYTES);
  if ("tooLarge" in read) return Response.json({ error: `Request body must be ${MAX_BODY_BYTES} bytes or fewer.` }, { status: 413 });
  let parsed: unknown;
  try { parsed = JSON.parse(read.text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!parsed || typeof parsed !== "object") return Response.json({ error: "Invalid request." }, { status: 400 });

  const payload = parsed as Record<string, unknown>;
  const anchor = isKoreanCoord(payload.anchor) ? roundCoord(payload.anchor) : null;
  if (!anchor) {
    // 기준 좌표가 없으면 주변을 찾을 수 없다. 아무 장소나 내놓지 않는다.
    return Response.json({
      configured: { places: isKakaoConfigured(), ranking: isJevConfigured() },
      anchorKnown: false, suggestions: [], ranking: null,
      note: "The must-visit event has no checked coordinates yet, so nearby suggestions are unavailable.",
    });
  }
  const kinds = Array.isArray(payload.kinds)
    ? KINDS.filter(kind => (payload.kinds as unknown[]).includes(kind))
    : KINDS;
  if (!kinds.length) return Response.json({ error: "Choose at least one suggestion kind." }, { status: 400 });
  const radius = Number.isFinite(payload.radius) ? Math.min(Math.max(Number(payload.radius), 100), 2_000) : NEARBY_RADIUS_M;
  const preference = typeof payload.preference === "string" ? payload.preference.trim().slice(0, JEV_MAX_PREFERENCE) : "";
  const excluded = new Set(Array.isArray(payload.excluded)
    ? (payload.excluded as unknown[]).filter((id): id is string => typeof id === "string").slice(0, 60) : []);

  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), REQUEST_DEADLINE_MS);
  const clientAbort = () => deadline.abort();
  request.signal?.addEventListener("abort", clientAbort, { once: true });

  let searchCalls = 0;
  let searchBudgetExhausted = false;
  try {
    const now = Date.now();
    const found: Suggestion[] = [];
    const pending: SuggestionKind[] = [];
    for (const kind of kinds) {
      const key = `${kind}|${coordKey(anchor)}|${radius}`;
      const cached = searchCache.get(key);
      // 같은 좌표·반경·종류는 30분 안에 다시 조회하지 않는다.
      if (cached && cached.expiresAt > now) { found.push(...cached.suggestions); continue; }
      pending.push(kind);
    }
    const granted = pending.length ? takeBudget("nearby-search", DAILY_SEARCH_BUDGET, pending.length) : 0;
    searchBudgetExhausted = granted < pending.length;
    const runnable = pending.slice(0, granted);
    if (runnable.length) {
      const results = await Promise.all(runnable.map(kind =>
        searchNearby(kind, anchor, { radius, signal: deadline.signal })));
      runnable.forEach((kind, index) => {
        const suggestions = results[index];
        searchCalls += 1;
        found.push(...suggestions);
        // 빈 결과도 캐시한다. 없는 동네를 반복 조회하지 않는다.
        searchCache.set(`${kind}|${coordKey(anchor)}|${radius}`, { suggestions, expiresAt: now + SEARCH_CACHE_TTL_MS });
      });
    }
    if (searchCache.size > 500) for (const [key, entry] of searchCache) if (entry.expiresAt <= now) searchCache.delete(key);

    // 사용자가 뺀 후보는 다시 올리지 않는다. 추천은 자동 확정이 아니다.
    const kept = found.filter(s => !excluded.has(s.id));
    // 종류별로 고르게 섞어 한 종류가 목록을 독차지하지 않게 한다.
    const byKind = new Map<SuggestionKind, Suggestion[]>();
    for (const suggestion of kept) {
      const list = byKind.get(suggestion.kind) ?? [];
      if (list.length < NEARBY_PER_KIND) list.push(suggestion);
      byKind.set(suggestion.kind, list);
    }
    const shortlist: Suggestion[] = [];
    for (let round = 0; round < NEARBY_PER_KIND && shortlist.length < JEV_MAX_CANDIDATES; round++) {
      for (const kind of kinds) {
        const pick = byKind.get(kind)?.[round];
        if (pick && shortlist.length < JEV_MAX_CANDIDATES) shortlist.push(pick);
      }
    }

    let ranking: JevRanking | null = null;
    if (shortlist.length && preference) {
      const candidates = shortlist.map(s => ({ id: s.id, facts: suggestionFacts(s) }));
      const key = `${preference}|${candidates.map(c => c.id).join(",")}`;
      const cached = rankCache.get(key);
      if (cached && cached.expiresAt > now) {
        ranking = cached.ranking;
      } else if (takeBudget("jev-rank", DAILY_RANK_BUDGET, 1) === 1) {
        ranking = await rankByPreference(preference, candidates, { signal: deadline.signal });
        // 기본 추천으로 돌아간 결과는 캐시하지 않는다. 다음 요청에서 다시 시도할 수 있어야 한다.
        if (!ranking.fallback) rankCache.set(key, { ranking, expiresAt: now + RANK_CACHE_TTL_MS });
      } else {
        ranking = { order: candidates.map(c => c.id), scores: {}, fallback: true,
          fallbackReason: jevFallbackReasons.requestFailed, model: null, latencyMs: null };
      }
      if (rankCache.size > 300) for (const [k, entry] of rankCache) if (entry.expiresAt <= now) rankCache.delete(k);
    }

    const order = ranking && !ranking.fallback ? ranking.order : shortlist.map(s => s.id);
    const ordered = order
      .map(id => shortlist.find(s => s.id === id))
      .filter((s): s is Suggestion => Boolean(s));

    return Response.json({
      configured: { places: isKakaoConfigured(), ranking: isJevConfigured() },
      anchorKnown: true,
      /** 모두 영업시간 미확인이며 자동 편성 대상이 아니다. */
      autoScheduled: false,
      suggestions: ordered.map(s => ({
        ...s,
        score: ranking?.scores[s.id]?.score ?? null,
        confidence: ranking?.scores[s.id]?.confidence ?? null,
      })),
      ranking: ranking && {
        applied: !ranking.fallback, fallbackReason: ranking.fallbackReason,
        model: ranking.model, latencyMs: ranking.latencyMs,
      },
      searchCalls,
      searchBudgetExhausted,
    });
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", clientAbort);
  }
}
