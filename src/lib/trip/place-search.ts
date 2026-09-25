/**
 * 장소 이름으로 찾기 (T-062). 카카오 로컬 키워드 검색. **서버에서만** 부른다 — REST 키가 서버에만 있다.
 *
 * 왜: 직접 추가한 행사·장소에 좌표가 없어서 이동시간이 늘 "미확인 · 계획용 여유"였고, 지도 핀도, 그 장소 기준의
 * 주변 추천도 없었다. 이름으로 찾아 고르면 이름·주소·좌표가 채워진다.
 *
 * 좌표의 출처는 카카오 장소 페이지 주소(place.map.kakao.com/…)로 남긴다. 저장본을 읽을 때 이 출처인 좌표만
 * 개인 장소에 허용한다(storage.ts). 검수 카탈로그의 좌표처럼 보이는 값이 저장본에 섞이지 않게.
 */

import { isKoreanCoord, roundCoord, type Coord } from "./geo";

export const PLACE_SEARCH_SOURCE = /^https:\/\/place\.map\.kakao\.com\/\d+$/;
/**
 * 관광공사 추천 후보의 좌표 출처 (T-068). 후보를 준 TourAPI 공통정보 조회 주소(콘텐츠 ID)로 남긴다 — 키 없이는 열리지 않지만
 * 어떤 데이터에서 온 좌표인지는 이 주소가 가리킨다. 관광공사 웹 상세 페이지는 콘텐츠 ID와 다른 번호를 써서 만들 수 없다.
 */
export const TOUR_PLACE_SOURCE = /^https:\/\/apis\.data\.go\.kr\/B551011\/KorService2\/detailCommon2\?contentId=\d+$/;

export type PlaceSearchResult = {
  id: string;
  name: string;
  address: string;
  /** 주소의 구·군 (예: 마포구). 없으면 빈 문자열. */
  area: string;
  category: string;
  coord: Coord;
  /** 카카오 장소 페이지. 좌표의 출처로도 쓴다. */
  placeUrl: string;
};

/** "서울 마포구 양화로 ..." → "마포구". 형식이 다르면 빈 문자열. */
export const areaOf = (address: string) => address.split(/\s+/).find(part => /(구|군|시)$/.test(part) && !/^(서울|부산|대구|인천|광주|대전|울산|세종)/.test(part)) ?? "";

/** 키워드 검색 응답 → 결과. 좌표가 한국 밖이거나 이름·ID가 없으면 버린다. 외부 문자열은 화면 데이터로만 쓴다. */
export function parseKeywordSearch(body: unknown): PlaceSearchResult[] {
  const documents = (body as { documents?: unknown })?.documents;
  if (!Array.isArray(documents)) return [];
  return documents.flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const coord = { lat: Number(row.y), lng: Number(row.x) };
    const id = typeof row.id === "string" && /^\d+$/.test(row.id) ? row.id : "";
    const name = typeof row.place_name === "string" ? row.place_name.trim().slice(0, 120) : "";
    if (!id || !name || !isKoreanCoord(coord)) return [];
    const address = ((typeof row.road_address_name === "string" && row.road_address_name.trim())
      || (typeof row.address_name === "string" ? row.address_name.trim() : "")).slice(0, 300);
    const placeUrl = `https://place.map.kakao.com/${id}`;
    return [{
      id, name, address, area: areaOf(address),
      category: typeof row.category_name === "string" ? row.category_name.slice(0, 120) : "",
      coord: roundCoord(coord), placeUrl,
    }];
  });
}
