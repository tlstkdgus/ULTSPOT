/**
 * 카카오맵 REST API 어댑터. **서버에서만** import한다 (REST API 키가 필요하다).
 *
 * 문서: https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api
 * 무료 쿼터·요금: https://devtalk.kakao.com/t/api-notice-on-name-kakao-map-api-features-and-free-quota-policy/150222
 *   (대중교통·도보 경로 각 일 1,000건, 초과 시 건당 10원 — 2026-07-21 공지)
 *
 * 응답 파싱은 fetch와 분리해 두었다. 키 없이도 파싱 규칙을 테스트할 수 있다.
 */

import { parseKeywordSearch } from "./place-search";
import { isKoreanCoord, mapLinks, roundCoord, type Coord, type TravelPoint } from "./geo";
import { travelReasons, unconfirmed, type TravelEstimate, type TravelMode, type TravelStep } from "./travel";

export const KAKAO_PROVIDER = "카카오맵 REST API";
const KAKAO_HOST = "https://dapi.kakao.com";

/** 키는 서버 환경 변수에서만 읽는다. NEXT_PUBLIC_ 접두사를 붙이면 안 된다. */
export const kakaoKey = () => process.env.KAKAO_REST_API_KEY?.trim() || null;
export const isKakaoConfigured = () => Boolean(kakaoKey());

const seconds2minutes = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.max(1, Math.ceil(value / 60)) : null;

const stepMode = (type: unknown): TravelStep["mode"] =>
  type === "BUS" ? "bus" : type === "SUBWAY" ? "subway" : "walk";

/**
 * 대중교통 경로 응답 → TravelEstimate.
 * status가 OK가 아니거나 경로가 비어 있으면 unconfirmed다. 0분이나 추정값으로 바꾸지 않는다.
 */
export function parseTransitRoute(
  body: unknown, from: TravelPoint, to: TravelPoint, bufferMinutes: number, now: () => string,
): TravelEstimate {
  const fail = (reason: Parameters<typeof unconfirmed>[4]) => unconfirmed(from, to, "transit", bufferMinutes, reason);
  if (!body || typeof body !== "object") return fail(travelReasons.lookupFailed);
  const data = body as Record<string, unknown>;
  if (data.status === "EQUAL_POINTS") return fail(travelReasons.samePoint);
  if (data.status !== "OK") return fail(travelReasons.noRoute);
  const routes = Array.isArray(data.routes) ? data.routes : [];
  // 응답은 여러 경로를 준다. 가장 빠른 것 하나만 쓴다.
  let bestMinutes: number | null = null;
  let best: Record<string, unknown> | null = null;
  for (const route of routes) {
    const properties = (route as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
    const value = seconds2minutes(properties?.totalTime);
    if (value !== null && (bestMinutes === null || value < bestMinutes)) { bestMinutes = value; best = route as Record<string, unknown>; }
  }
  if (bestMinutes === null || !best) return fail(travelReasons.noRoute);
  const properties = best.properties as Record<string, unknown>;
  const fare = properties.fare as Record<string, unknown> | undefined;
  const steps: TravelStep[] = (Array.isArray(best.steps) ? best.steps : []).flatMap(raw => {
    const step = (raw as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
    const minutes = seconds2minutes(step?.time);
    if (!step || minutes === null) return [];
    const vehicles = Array.isArray(step.vehicles) ? step.vehicles : [];
    const name = (vehicles[0] as Record<string, unknown> | undefined)?.name;
    return [{ mode: stepMode(step.type), minutes, name: typeof name === "string" ? name : undefined }];
  });
  const landing = properties.landingURL ?? (data.properties as Record<string, unknown> | undefined)?.landingURL;
  return {
    status: "known", mode: "transit", minutes: bestMinutes,
    transfers: typeof properties.transfers === "number" ? properties.transfers : null,
    fareKrw: typeof fare?.value === "number" ? fare.value : null,
    steps, provider: KAKAO_PROVIDER, fetchedAt: now(),
    manualUrl: typeof landing === "string" && landing.startsWith("https://") ? landing : mapLinks.route(from, to, "traffic"),
  };
}

/** 도보 경로 응답 → TravelEstimate. */
export function parseWalkRoute(
  body: unknown, from: TravelPoint, to: TravelPoint, bufferMinutes: number, now: () => string,
): TravelEstimate {
  const fail = (reason: Parameters<typeof unconfirmed>[4]) => unconfirmed(from, to, "walk", bufferMinutes, reason);
  if (!body || typeof body !== "object") return fail(travelReasons.lookupFailed);
  const data = body as Record<string, unknown>;
  if (data.status === "SAME_POINT") return fail(travelReasons.samePoint);
  if (data.status === "TOO_FAR_AWAY") return fail(travelReasons.tooFar);
  if (data.status !== "OK") return fail(travelReasons.noRoute);
  const properties = (data.route as Record<string, unknown> | undefined)?.properties as Record<string, unknown> | undefined;
  const minutes = seconds2minutes(properties?.totalTime);
  if (minutes === null) return fail(travelReasons.noRoute);
  const landing = properties?.landingUrl;
  return {
    status: "known", mode: "walk", minutes, transfers: 0, fareKrw: 0,
    steps: [{ mode: "walk", minutes }], provider: KAKAO_PROVIDER, fetchedAt: now(),
    manualUrl: typeof landing === "string" && landing.startsWith("https://") ? landing : mapLinks.route(from, to, "walk"),
  };
}

/** 주소 → 좌표 응답 파싱. 한국 범위를 벗어난 좌표는 버린다. */
export function parseAddressSearch(body: unknown): { coord: Coord; addressName: string } | null {
  const documents = (body as { documents?: unknown })?.documents;
  if (!Array.isArray(documents) || !documents.length) return null;
  const first = documents[0] as Record<string, unknown>;
  const coord = { lat: Number(first.y), lng: Number(first.x) };
  if (!isKoreanCoord(coord)) return null;
  return { coord: roundCoord(coord), addressName: typeof first.address_name === "string" ? first.address_name : "" };
}

/** 조회 하나에 허용하는 최대 시간. 사용자가 일정 화면에서 기다릴 수 있는 범위로 잡았다. */
export const UPSTREAM_TIMEOUT_MS = 4_000;

/** 타임아웃이 걸려 중단됐다는 표시. 일반 실패와 다른 사유로 보여주기 위해 구분한다. */
export class TravelTimeoutError extends Error {
  constructor() { super("Kakao route lookup timed out"); this.name = "TravelTimeoutError"; }
}

/**
 * 호출자 신호와 자체 타임아웃을 합친다.
 *
 * 왜 직접 엮는가: `AbortSignal.any`/`AbortSignal.timeout`은 런타임에 따라 없을 수 있고,
 * 무응답 공급자를 기다리다 요청이 영원히 매달리면 화면이 멈춘다. 타임아웃이 없으면
 * "이동시간 미확인"으로 떨어지는 안전한 경로 자체가 동작하지 못한다.
 */
function withDeadline(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const relay = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", relay, { once: true });
  }
  return {
    signal: controller.signal,
    get timedOut() { return timedOut; },
    done() { clearTimeout(timer); signal?.removeEventListener("abort", relay); },
  };
}

async function kakaoGet(path: string, params: Record<string, string>, signal?: AbortSignal, timeoutMs = UPSTREAM_TIMEOUT_MS) {
  const key = kakaoKey();
  if (!key) throw new Error("KAKAO_REST_API_KEY is not set.");
  const url = new URL(path, KAKAO_HOST);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const deadline = withDeadline(signal, timeoutMs);
  try {
    // signal은 항상 넘긴다. 없으면 무응답 공급자에게 매달린다.
    const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: deadline.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Kakao ${path} responded ${response.status}`);
    return await response.json() as unknown;
  } catch (error) {
    if (deadline.timedOut) throw new TravelTimeoutError();
    throw error;
  } finally {
    deadline.done();
  }
}

/** 구간 하나를 조회한다. 실패는 예외로 올리지 않고 unconfirmed로 돌려준다. */
export async function lookupLeg(
  from: TravelPoint, to: TravelPoint, mode: TravelMode, bufferMinutes: number,
  options: { signal?: AbortSignal; now?: () => string; timeoutMs?: number } = {},
): Promise<TravelEstimate> {
  const now = options.now ?? (() => new Date().toISOString());
  if (!isKakaoConfigured()) return unconfirmed(from, to, mode, bufferMinutes, travelReasons.noKey);
  if (!from.coord || !to.coord) return unconfirmed(from, to, mode, bufferMinutes, travelReasons.noCoord);
  const params = {
    start_x: String(from.coord.lng), start_y: String(from.coord.lat), s_name: from.name.slice(0, 40),
    end_x: String(to.coord.lng), end_y: String(to.coord.lat), e_name: to.name.slice(0, 40),
  };
  try {
    const body = await kakaoGet(mode === "walk" ? "/v2/routing/walk" : "/v2/routing/publictraffic",
      params, options.signal, options.timeoutMs ?? UPSTREAM_TIMEOUT_MS);
    return mode === "walk"
      ? parseWalkRoute(body, from, to, bufferMinutes, now)
      : parseTransitRoute(body, from, to, bufferMinutes, now);
  } catch (error) {
    // 시간 초과와 그 밖의 실패를 구분한다. 어느 쪽이든 추정값을 만들지 않는다.
    return unconfirmed(from, to, mode, bufferMinutes,
      error instanceof TravelTimeoutError ? travelReasons.timedOut : travelReasons.lookupFailed);
  }
}

/** 주소 한 건을 좌표로. 검수용 CLI와 서버에서만 쓴다. */
export async function geocodeAddress(address: string, signal?: AbortSignal) {
  const body = await kakaoGet("/v2/local/search/address.json", { query: address, size: "1" }, signal);
  return parseAddressSearch(body);
}

/**
 * 장소 이름 검색 (T-062). 카카오 로컬 키워드 검색 상위 8건. 실패는 null(캐시하지 않게), 결과 없음은 빈 배열.
 * 서울 시청 좌표를 기준점으로 넘겨 같은 이름이면 서울 쪽이 앞에 오게 한다(반경은 두지 않는다 — 공항 숙소도 찾아야 한다).
 */
export async function searchKeyword(query: string, signal?: AbortSignal) {
  try {
    const body = await kakaoGet("/v2/local/search/keyword.json",
      { query, size: "8", x: "126.9780", y: "37.5665", sort: "accuracy" }, signal);
    return parseKeywordSearch(body);
  } catch {
    return null;
  }
}
