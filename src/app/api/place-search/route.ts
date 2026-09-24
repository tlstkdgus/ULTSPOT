/**
 * 장소 이름 검색 (T-062). 카카오 REST 키는 서버에만 있다.
 *
 * 입력 검사, IP당 분당 상한, 일일 상한, 30분 캐시만 한다. 해석은 src/lib/trip/place-search.ts.
 */

import { isKakaoConfigured, searchKeyword } from "@/lib/trip/kakao";
import type { PlaceSearchResult } from "@/lib/trip/place-search";
import { seoulDate } from "@/lib/seoul-date";

export const dynamic = "force-dynamic";

const MAX_BODY = 512;
const MAX_QUERY = 60;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 20;
const DAILY_BUDGET = Math.max(0, Number(process.env.PLACE_SEARCH_DAILY_BUDGET ?? 500) || 0);
const CACHE_TTL_MS = 30 * 60_000;

const hits = new Map<string, number[]>();
const cache = new Map<string, { results: PlaceSearchResult[]; expiresAt: number }>();
let budget = { day: "", used: 0 };

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(at => now - at < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) for (const [key, times] of hits) if (!times.some(at => now - at < RATE_WINDOW_MS)) hits.delete(key);
  return recent.length > RATE_MAX_REQUESTS;
}

function takeBudget() {
  const day = seoulDate();
  if (budget.day !== day) budget = { day, used: 0 };
  if (budget.used >= DAILY_BUDGET) return false;
  budget.used += 1;
  return true;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (rateLimited(ip)) return Response.json({ error: "Too many searches. Try again in a minute." }, { status: 429 });
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: `Request body must be ${MAX_BODY} bytes or fewer.` }, { status: 413 });
  let payload: { query?: unknown };
  try { payload = JSON.parse(text); } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const query = typeof payload?.query === "string" ? payload.query.replace(/\s+/g, " ").trim() : "";
  if (query.length < 2 || query.length > MAX_QUERY) return Response.json({ error: `Search with 2–${MAX_QUERY} characters.` }, { status: 400 });

  if (!isKakaoConfigured()) return Response.json({ configured: false, results: [] });
  const key = query.toLowerCase();
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return Response.json({ configured: true, results: cached.results });
  if (!takeBudget()) return Response.json({ configured: true, results: [], budgetExhausted: true });
  const results = await searchKeyword(query, request.signal);
  if (results === null) return Response.json({ configured: true, results: [], failed: true });
  cache.set(key, { results, expiresAt: now + CACHE_TTL_MS });
  if (cache.size > 1_000) for (const [k, entry] of cache) if (entry.expiresAt <= now) cache.delete(k);
  return Response.json({ configured: true, results });
}
