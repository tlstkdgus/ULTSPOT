/**
 * Google Places API (New) — 장소 사진 한 장 (T-052). **서버에서만** import한다. 키는 GOOGLE_MAPS_API_KEY.
 *
 * 왜: 관광공사(T-051)에 없는 곳(카카오 후보 등)은 사진이 없다. Google은 장소 사진과 촬영자를 준다.
 *
 * 약관에서 설계로 옮긴 것 (https://developers.google.com/maps/documentation/places/web-service/policies):
 *  - **비구글 지도와 함께 쓰지 않는다.** 그래서 화면은 Google 지도(NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY)가 떠 있을 때만
 *    이 사진을 요청한다. 카카오 지도로 떨어진 화면에는 Google 사진을 싣지 않는다.
 *  - **저장·캐시하지 않는다.** 사진·사진 이름은 요청마다 받고 버린다(장소 ID만 예외인데 쓰지 않는다).
 *  - **촬영자 표기 필수.** authorAttributions를 그대로 넘기고 화면이 "사진: 촬영자 · Google Maps"로 적는다.
 *  - 키는 URL에 싣지 않는다. 사진 주소는 skipHttpRedirect로 받은 photoUri(키 없는 googleusercontent 주소)다.
 *
 * 비용: 요청 한 번에 Text Search(Pro) 1회 + Place Photo 1회. 무료 한도는 월 5,000 · 1,000건이라
 * 서버가 일일 상한(GOOGLE_DAILY_PHOTO_BUDGET, 기본 30)을 둔다.
 */

import { straightLineMeters, type Coord } from "@/lib/trip/geo";
import type { PlacePhoto } from "./photo";

const TIMEOUT_MS = 5_000;
/** 이름으로 찾은 곳이 이보다 멀면 같은 가게로 보지 않는다. 다른 지점 사진을 붙이는 것보다 없는 게 낫다. */
export const GOOGLE_MATCH_METERS = 150;

export const googleKey = () => process.env.GOOGLE_MAPS_API_KEY?.trim() || "";
export const isGoogleConfigured = () => Boolean(googleKey());

type GooglePlace = {
  id?: unknown;
  displayName?: { text?: unknown };
  location?: { latitude?: unknown; longitude?: unknown };
  photos?: { name?: unknown; authorAttributions?: { displayName?: unknown; uri?: unknown }[] }[];
};

/**
 * Text Search 응답에서 같은 가게의 첫 사진을 고른다. 좌표가 GOOGLE_MATCH_METERS 안인 곳 중 가장 가까운 곳.
 * 사진 이름이 places/…/photos/… 형식이 아니면 버린다(그대로 URL 경로에 들어간다).
 */
export function pickGooglePhoto(body: unknown, coord: Coord): { photoName: string; authors: PlacePhoto["authors"] } | null {
  const places = (body as { places?: unknown })?.places;
  if (!Array.isArray(places)) return null;
  const candidates = (places as GooglePlace[]).flatMap(place => {
    const lat = Number(place.location?.latitude); const lng = Number(place.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const meters = straightLineMeters(coord, { lat, lng });
    const photo = place.photos?.find(p => typeof p.name === "string" && /^places\/[\w-]+\/photos\/[\w-]+$/.test(p.name));
    return meters <= GOOGLE_MATCH_METERS && photo ? [{ meters, photo }] : [];
  }).sort((a, b) => a.meters - b.meters);
  const best = candidates[0];
  if (!best) return null;
  const authors = (best.photo.authorAttributions ?? []).flatMap(a =>
    typeof a.displayName === "string" && a.displayName.trim()
      ? [{ name: a.displayName.trim().slice(0, 80), uri: typeof a.uri === "string" && /^https:\/\//.test(a.uri) ? a.uri : "" }] : []);
  // 촬영자를 모르면 표기 의무를 지킬 수 없다. 싣지 않는다.
  if (!authors.length) return null;
  return { photoName: best.photo.name as string, authors };
}

async function googleFetch(url: string, init: RequestInit, signal?: AbortSignal) {
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  return fetch(url, { ...init, cache: "no-store", signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
}

/** 이름·좌표로 사진 한 장. 없거나 실패하면 null. 캐시하지 않는다. */
export async function findGooglePhoto(name: string, coord: Coord, signal?: AbortSignal): Promise<PlacePhoto | null> {
  const key = googleKey();
  if (!key) return null;
  try {
    const search = await googleFetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Goog-Api-Key": key,
        // 필요한 필드만. 필드가 늘면 과금 등급이 올라간다.
        "X-Goog-FieldMask": "places.id,places.location,places.photos",
      },
      body: JSON.stringify({
        textQuery: name, languageCode: "ko", regionCode: "KR", maxResultCount: 3,
        locationBias: { circle: { center: { latitude: coord.lat, longitude: coord.lng }, radius: GOOGLE_MATCH_METERS } },
      }),
    }, signal);
    if (!search.ok) return null;
    const picked = pickGooglePhoto(await search.json(), coord);
    if (!picked) return null;
    const media = await googleFetch(
      `https://places.googleapis.com/v1/${picked.photoName}/media?maxWidthPx=800&skipHttpRedirect=true`,
      { headers: { "X-Goog-Api-Key": key } }, signal);
    if (!media.ok) return null;
    const { photoUri } = await media.json() as { photoUri?: unknown };
    if (typeof photoUri !== "string" || !/^https:\/\/[\w.-]+\.(googleusercontent|ggpht|google)\.com\//.test(photoUri)) return null;
    return { url: photoUri, provider: "google", license: "google", authors: picked.authors };
  } catch {
    return null;
  }
}
