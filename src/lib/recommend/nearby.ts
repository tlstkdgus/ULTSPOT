/**
 * 필수 방문 행사 주변의 식사·휴식·관광 후보. **서버에서만** import한다.
 *
 * 출처는 카카오 장소 검색(카테고리)이다. 여기서 **반드시 알아야 할 한계**:
 * 카카오 장소 검색 응답에는 **영업시간이 없다**(문서의 Document 필드 참고).
 * 그래서 주변 후보는 검수된 행사와 같은 자격이 아니다.
 *   - 자동 편성하지 않는다. "지금 열려 있다"고 말하지 않는다.
 *   - 영업시간 미확인으로 표시하고 지도 링크로 직접 확인하게 한다.
 *   - 사용자가 직접 추가할 때만 일정에 들어가고, 그때도 시간 미확인 상태를 유지한다.
 *
 * 아이돌 관련 근거가 있는 장소(검수 카탈로그)와 일반 주변 추천을 `evidence`로 구분한다.
 * 근처에 있다는 사실이 아이돌과 관련 있다는 뜻이 아니다.
 *
 * 문서: https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api (카테고리로 장소 검색)
 */

import { isKoreanCoord, mapLinks, roundCoord, straightLineMeters, type Coord } from "@/lib/trip/geo";
import { kakaoKey } from "@/lib/trip/kakao";

/** 팬 하루에서 행사 사이를 메우는 세 가지 역할. */
export type SuggestionKind = "meal" | "cafe" | "sightseeing";

/** 카카오 카테고리 그룹 코드. FD6 음식점 · CE7 카페 · AT4 관광명소. */
const CATEGORY: Record<SuggestionKind, string> = { meal: "FD6", cafe: "CE7", sightseeing: "AT4" };

export type Suggestion = {
  id: string;
  kind: SuggestionKind;
  name: string;
  category: string;
  address: string;
  coord: Coord;
  /** 기준 좌표에서의 직선 거리(m). 이동시간이 아니다. */
  straightMeters: number;
  /** idol: 아이돌 관련 근거가 검수된 장소. nearby: 근처에 있다는 사실만 확인된 일반 장소. */
  evidence: "idol" | "nearby";
  /** 영업시간은 이 출처에 없다. 언제나 false이며 화면에서 미확인으로 표시한다. */
  hoursKnown: false;
  provider: string;
  placeUrl: string;
  mapUrl: string;
};

export const NEARBY_PROVIDER = "카카오맵 장소 검색";
/** 도보로 갈 만한 범위. 이보다 멀면 행사 사이에 끼울 수 없다. */
export const NEARBY_RADIUS_M = 800;
export const NEARBY_TIMEOUT_MS = 4_000;
/** 한 종류당 돌려줄 최대 개수. Jev 질문 수와 토큰 비용에 직접 연결된다. */
export const NEARBY_PER_KIND = 5;

const isFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

/**
 * 응답 파싱. 좌표가 한국 범위를 벗어나거나 이름이 없으면 버린다.
 * 외부 문자열은 화면 데이터로만 쓰고 코드·HTML·SQL로 실행하지 않는다.
 */
export function parseNearby(body: unknown, kind: SuggestionKind, anchor: Coord, radius: number): Suggestion[] {
  const documents = (body as { documents?: unknown })?.documents;
  if (!Array.isArray(documents)) return [];
  const out: Suggestion[] = [];
  for (const raw of documents) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const coord = { lat: Number(row.y), lng: Number(row.x) };
    if (!isKoreanCoord(coord)) continue;
    const name = typeof row.place_name === "string" ? row.place_name.trim() : "";
    const id = typeof row.id === "string" ? row.id : "";
    if (!name || !id) continue;
    const meters = isFiniteNumber(Number(row.distance)) && row.distance !== undefined
      ? Number(row.distance) : straightLineMeters(anchor, coord);
    if (meters > radius) continue;
    const address = (typeof row.road_address_name === "string" && row.road_address_name.trim())
      || (typeof row.address_name === "string" ? row.address_name : "");
    const placeUrl = typeof row.place_url === "string" && row.place_url.startsWith("https://") ? row.place_url : "";
    out.push({
      id: `kakao-${id}`, kind, name: name.slice(0, 120),
      category: typeof row.category_name === "string" ? row.category_name.slice(0, 120) : "",
      address: address.slice(0, 300), coord: roundCoord(coord), straightMeters: Math.round(meters),
      // 카카오 장소 검색만으로는 아이돌 관련성을 알 수 없다. 언제나 일반 주변이다.
      evidence: "nearby", hoursKnown: false, provider: NEARBY_PROVIDER,
      placeUrl: placeUrl || mapLinks.place({ id, name, coord }),
      mapUrl: mapLinks.place({ id, name, address, coord }),
    });
  }
  return out.sort((a, b) => a.straightMeters - b.straightMeters).slice(0, NEARBY_PER_KIND);
}

function withDeadline(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const relay = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", relay, { once: true });
  }
  return { signal: controller.signal, done() { clearTimeout(timer); signal?.removeEventListener("abort", relay); } };
}

/** 한 종류를 조회한다. 실패는 던지지 않고 빈 배열이다. 추천이 없으면 없다고 말한다. */
export async function searchNearby(
  kind: SuggestionKind, anchor: Coord,
  options: { radius?: number; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Suggestion[]> {
  const key = kakaoKey();
  if (!key || !isKoreanCoord(anchor)) return [];
  const radius = Math.min(Math.max(options.radius ?? NEARBY_RADIUS_M, 100), 20_000);
  const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  url.searchParams.set("category_group_code", CATEGORY[kind]);
  url.searchParams.set("x", String(anchor.lng));
  url.searchParams.set("y", String(anchor.lat));
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("sort", "distance");
  url.searchParams.set("size", "15");
  const deadline = withDeadline(options.signal, options.timeoutMs ?? NEARBY_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` }, signal: deadline.signal, cache: "no-store",
    });
    if (!response.ok) return [];
    return parseNearby(await response.json(), kind, anchor, radius);
  } catch {
    return [];
  } finally {
    deadline.done();
  }
}

/** Jev에 보낼 사실 문장. 검수되지 않은 추정은 넣지 않는다. */
export function suggestionFacts(suggestion: Suggestion) {
  return [
    suggestion.category || suggestion.kind,
    suggestion.address,
    `약 ${suggestion.straightMeters}m (직선 거리)`,
    // 모델이 영업시간을 추론하지 않도록 미확인임을 명시한다.
    "영업시간 미확인",
  ].filter(Boolean).join(" · ").slice(0, 400);
}
