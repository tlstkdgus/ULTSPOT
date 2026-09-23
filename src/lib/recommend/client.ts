/**
 * 브라우저에서 /api/recommend를 부르는 쪽. 키를 다루지 않는다.
 *
 * 실패해도 던지지 않는다. 제안이 없으면 없다고 말하고, 취향 평가가 빠졌으면 그 사실을 알린다.
 * 추천은 자동 확정이 아니다. 화면에서 추가·제외·교체할 수 있어야 한다.
 */

import type { Coord } from "@/lib/trip/geo";
import type { SuggestionKind } from "@/lib/recommend/nearby";
import type { PlaceHours } from "@/lib/recommend/tour";

export type RankedSuggestion = {
  id: string;
  kind: SuggestionKind;
  name: string;
  category: string;
  address: string;
  coord: Coord;
  straightMeters: number;
  evidence: "idol" | "nearby";
  /** TourAPI 원문이 확실히 읽힌 곳만 true. 카카오 후보는 언제나 false (T-050). */
  hoursKnown: boolean;
  hours: PlaceHours | null;
  provider: string;
  placeUrl: string;
  mapUrl: string;
  score: number | null;
  confidence: number | null;
};

export type SuggestionResult = {
  configured: { places: boolean; ranking: boolean };
  anchorKnown: boolean;
  autoScheduled: false;
  suggestions: RankedSuggestion[];
  ranking: { applied: boolean; fallbackReason: string | null; model: string | null; latencyMs: number | null } | null;
  /** 조회 자체가 안 된 이유. 있으면 제안 목록은 비어 있다. */
  unavailable: string | null;
};

const empty = (reason: string): SuggestionResult => ({
  configured: { places: false, ranking: false }, anchorKnown: false, autoScheduled: false,
  suggestions: [], ranking: null, unavailable: reason,
});

export async function fetchSuggestions(input: {
  anchor: Coord | null;
  kinds: SuggestionKind[];
  preference: string;
  excluded: string[];
  radius?: number;
}, signal?: AbortSignal): Promise<SuggestionResult> {
  if (!input.anchor) return empty("no-anchor");
  try {
    const response = await fetch("/api/recommend", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({
        anchor: input.anchor, kinds: input.kinds, preference: input.preference,
        excluded: input.excluded.slice(0, 60), radius: input.radius,
      }),
    });
    if (!response.ok) return empty(`http-${response.status}`);
    const body = await response.json() as Omit<SuggestionResult, "unavailable">;
    return { ...body, suggestions: body.suggestions ?? [], unavailable: null };
  } catch {
    return empty("request-failed");
  }
}
