/**
 * 장소 사진과 그 이용 조건 (T-051). 화면과 서버가 같이 쓴다. 키를 다루지 않는다.
 *
 * 사진은 **이용 조건을 아는 것만** 싣는다. 조건을 모르면 사진이 없는 것으로 둔다 — 없는 사진을
 * 다른 데서 긁어 채우지 않는다.
 *
 *  - 한국관광공사 TourAPI: `firstimage` + `cpyrhtDivCd`(공공누리 유형). 제1유형은 출처 표시,
 *    제3유형은 출처 표시 + **변경 금지**다. 잘라내기도 변경이므로 화면은 사진을 자르지 않고
 *    전체를 보여준다(object-contain). 두 유형 모두 같은 방식으로 보여줘 규칙을 하나로 둔다.
 *  - Google Places(T-052): 촬영자 표기(authorAttributions)가 필수다.
 */

export type PhotoLicense = "kogl-1" | "kogl-3" | "google";

export type PlacePhoto = {
  /** https만. 화면은 이 주소를 그대로 <img>로 건다. */
  url: string;
  provider: "tour" | "google";
  license: PhotoLicense;
  /** Google 사진의 촬영자. TourAPI는 빈 배열이고 출처는 한국관광공사다. */
  authors: { name: string; uri: string }[];
};

const TOUR_IMAGE_HOST = /^https?:\/\/tong\.visitkorea\.or\.kr\//;

/**
 * TourAPI 목록 한 줄의 대표 사진. 관광공사 이미지 서버의 주소이고 공공누리 유형을 아는 것만.
 * 주소는 http로 오지만 https로도 열린다(2026-09-24 확인). 화면이 https라 섞인 콘텐츠를 피한다.
 */
export function tourPhoto(firstimage: unknown, copyright: unknown): PlacePhoto | null {
  const url = typeof firstimage === "string" ? firstimage.trim() : "";
  if (!TOUR_IMAGE_HOST.test(url) || url.length > 500) return null;
  const license = copyright === "Type1" ? "kogl-1" : copyright === "Type3" ? "kogl-3" : null;
  if (!license) return null;
  return { url: url.replace(/^http:/, "https:"), provider: "tour", license, authors: [] };
}
