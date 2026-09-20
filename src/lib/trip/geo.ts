/**
 * 좌표와 지도 링크. 여기에는 API 키가 필요한 코드가 없다.
 *
 * 좌표가 없으면 없다고 말한다. 주소 문자열만 있는 장소를 좌표가 있는 것처럼 다루지 않는다.
 * 경로 조회는 travel.ts가, 실제 호출은 서버(src/app/api/travel)가 담당한다.
 */

export type Coord = { lat: number; lng: number };

/** 좌표의 출처와 확인일. 검수 없이 들어온 좌표를 공개 카탈로그에 넣지 않기 위해 함께 저장한다. */
export type CoordRecord = Coord & { source: string; checked_on: string };

/** 경로 조회·지도 링크에 쓰는 지점. coord가 없으면 이동시간을 확정할 수 없다. */
export type TravelPoint = { id: string; name: string; address?: string; coord?: Coord };

/** 출발지·종료지. 사용자가 직접 넣는 값이라 좌표 없이 이름만 있을 수 있다. */
export type TripEndpoint = { label: string; address?: string; coord?: Coord };

/** 대한민국 육상·근해 대략 범위. 0,0이나 위경도 뒤바뀜 같은 흔한 오류를 걸러낸다. */
const KOREA_BOUNDS = { minLat: 33.0, maxLat: 38.7, minLng: 124.5, maxLng: 132.0 };

export function isCoord(value: unknown): value is Coord {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value as Record<string, unknown>;
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
}

/** 한국 범위 안의 좌표인지. 범위를 벗어나면 좌표 미확인으로 취급한다. */
export function isKoreanCoord(value: unknown): value is Coord {
  if (!isCoord(value)) return false;
  return value.lat >= KOREA_BOUNDS.minLat && value.lat <= KOREA_BOUNDS.maxLat &&
    value.lng >= KOREA_BOUNDS.minLng && value.lng <= KOREA_BOUNDS.maxLng;
}

/** 소수점 5자리(약 1m)로 줄인다. 캐시 키를 안정적으로 만들고 불필요한 정밀도를 저장하지 않는다. */
export const roundCoord = (coord: Coord): Coord => ({
  lat: Math.round(coord.lat * 1e5) / 1e5,
  lng: Math.round(coord.lng * 1e5) / 1e5,
});

/**
 * 두 좌표 사이 직선 거리(미터).
 *
 * 이동시간이 아니다. 주변 후보를 거리순으로 줄이거나 "같은 건물" 여부를 볼 때만 쓴다.
 * 직선 거리를 분으로 환산해 소요시간처럼 보여주면 안 된다.
 */
export function straightLineMeters(from: Coord, to: Coord) {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** 카카오맵 링크 경로에는 쉼표·슬래시가 구분자다. 이름에서 빼고 길이를 제한한다. */
const linkName = (name: string) => encodeURIComponent(name.replace(/[,/]/g, " ").trim().slice(0, 40) || "위치");

/**
 * 사용자가 직접 확인할 수 있는 지도 링크. 키가 필요 없다.
 * 규칙 출처: https://apis.map.kakao.com/web/guide/ (지도 URL)
 */
export const mapLinks = {
  /** 주소·키워드 검색 결과. 좌표가 없을 때의 최소 경로. */
  search: (query: string) => `https://map.kakao.com/link/search/${encodeURIComponent(query)}`,
  /** 좌표 한 곳 표시. */
  place: (point: TravelPoint) => point.coord
    ? `https://map.kakao.com/link/map/${linkName(point.name)},${point.coord.lat},${point.coord.lng}`
    : mapLinks.search(point.address ?? point.name),
  /**
   * 구간 길찾기. 이동수단은 traffic(대중교통) 또는 walk(도보).
   * 양쪽 좌표가 있어야 한다. 하나라도 없으면 도착지 검색 링크로 떨어진다.
   */
  route: (from: TravelPoint, to: TravelPoint, mode: "traffic" | "walk") => {
    if (!from.coord || !to.coord) return mapLinks.search(to.address ?? to.name);
    return `https://map.kakao.com/link/by/${mode}/${linkName(from.name)},${from.coord.lat},${from.coord.lng}` +
      `/${linkName(to.name)},${to.coord.lat},${to.coord.lng}`;
  },
};
