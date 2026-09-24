/**
 * 추천 장소 한 곳의 Google 사진 (T-052). 키는 서버에만 있다.
 *
 * 화면은 Google 지도가 떠 있고, 관광공사 사진이 없는 빈 시간 추천 카드에서만 부른다. 약관·비용 설명은
 * `src/lib/recommend/google.ts`. 여기서는 입력 검사, IP당 분당 상한, 일일 상한만 한다.
 * 응답을 캐시하지 않는다(Google 콘텐츠 저장 금지). 그래서 Cache-Control: no-store.
 */

import { seoulDate } from "@/lib/seoul-date";
import { isKoreanCoord } from "@/lib/trip/geo";
import { findGooglePhoto, isGoogleConfigured } from "@/lib/recommend/google";

export const dynamic = "force-dynamic";

const MAX_BODY = 1_024;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 20;
/** 월 무료 한도(사진 1,000건) 안에 머물게 하루 30건. 인스턴스마다 따로 센다(다른 라우트와 같은 한계). */
const DAILY_BUDGET = Math.max(0, Number(process.env.GOOGLE_DAILY_PHOTO_BUDGET ?? 30) || 0);

const hits = new Map<string, number[]>();
let budget = { day: "", used: 0 };

const noStore = { "Cache-Control": "no-store" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: noStore });

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
  if (rateLimited(ip)) return reply({ error: "Too many photo requests. Try again in a minute." }, 429);
  const text = await request.text();
  if (text.length > MAX_BODY) return reply({ error: `Request body must be ${MAX_BODY} bytes or fewer.` }, 413);
  let payload: { name?: unknown; coord?: unknown };
  try { payload = JSON.parse(text); } catch { return reply({ error: "Invalid JSON." }, 400); }
  const name = typeof payload?.name === "string" ? payload.name.trim().slice(0, 120) : "";
  if (!name || !isKoreanCoord(payload.coord)) return reply({ error: "Send a place name and a coordinate in Korea." }, 400);

  if (!isGoogleConfigured()) return reply({ configured: false, photo: null });
  if (!takeBudget()) return reply({ configured: true, photo: null, budgetExhausted: true });
  const photo = await findGooglePhoto(name, payload.coord, request.signal);
  return reply({ configured: true, photo });
}
