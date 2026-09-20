import type { FanEvent } from "./planner";

// Individually reviewed factual records. No copied descriptions, photos, or competitor listings.
export const catalog: FanEvent[] = [
  {
    id: "hikr-ground", title: "HiKR Ground · K-pop floors", area: "Jung-gu", kind: "K-pop experience",
    title_ko: "하이커 그라운드 · K팝 체험 공간", area_ko: "중구",
    do_ko: "운영시간 안에 공개된 K팝 전시 공간을 둘러보세요. 별도 프로그램은 시설 안내를 확인하세요.",
    get_ko: "K팝 세트와 체험형 전시를 즐길 수 있습니다. 일반 입장은 무료이며 특별 프로그램에는 별도 조건이 있을 수 있습니다.",
    transit: { station_ko: "종각역", station_en: "Jonggak", line_ko: "1호선", line_en: "Line 1", exit: "5", walk_minutes: 2, source: "https://english.visitkorea.or.kr/svc/sp/hikr", checked_on: "2026-09-20" },
    // 카카오 주소 검색이 도로명주소를 정확히 일치로 돌려준 값. pnpm data:geocode 검수 후 반영 (T-025).
    coord: { lat: 37.56853, lng: 126.98163, source: "https://dapi.kakao.com/v2/local/search/address.json", checked_on: "2026-09-20" },
    participation: { price_ko: "일반 입장 무료 · 유료 프로그램 별도 안내", price_en: "General admission free; paid programs announced separately", cash_required: null, first_come_quantity: null, lucky_draw: null, source: "https://english.visitkorea.or.kr/svc/sp/hikr", checked_on: "2026-09-20" },
    address: "40 Cheonggyecheon-ro, Jung-gu, Seoul", from: null, to: null,
    opens: 600, closes: 1200, lastEntry: 1180, closedDays: [1], reservation: false,
    do: "Visit the public K-pop exhibition floors during opening hours. Check separate programs with the venue.",
    get: "Explore K-pop sets and interactive exhibits. General admission is free; special programs may have separate conditions.",
    provenance: { mode: "reviewed", author: "Korea Tourism Organization · venue website", checkedOn: "2026-09-19", url: "https://english.visitkorea.or.kr/svc/sp/hikr" },
  },
  {
    id: "music-korea", title: "Music Korea · Myeongdong 2", area: "Jung-gu", kind: "Album shop",
    title_ko: "뮤직코리아 · 명동 2호점", area_ko: "중구",
    do_ko: "매장을 둘러보고 원하는 음반을 구매하세요. 재고와 구매 특전은 직원에게 확인하세요.",
    get_ko: "구매한 음반이나 굿즈를 받을 수 있습니다. 팬사인회 참여나 무료 특전은 보장되지 않습니다.",
    coord: { lat: 37.56072, lng: 126.98659, source: "https://dapi.kakao.com/v2/local/search/address.json", checked_on: "2026-09-20" },
    address: "1F, 134 Toegye-ro, Jung-gu, Seoul", from: null, to: null,
    opens: 600, closes: 1320, closedDays: [], reservation: false,
    do: "Browse the store and pay for any albums you choose. Confirm stock and purchase benefits with staff.",
    get: "Purchased albums or merchandise. No fan-sign access or free gift is guaranteed.",
    provenance: { mode: "reviewed", author: "Music Korea · official store page", checkedOn: "2026-09-19", url: "https://www.musickorea.com/Mobile/Paper/view/code/store" },
  },
  {
    id: "k-star-road", title: "K-Star Road", area: "Gangnam-gu", kind: "Public fan landmark",
    title_ko: "한류스타거리 K-STAR ROAD", area_ko: "강남구",
    do_ko: "방문 전 현장 접근 조건을 확인하고, 일반인에게 공개된 거리에서만 관람하세요.",
    get_ko: "K팝 테마 조형물을 둘러보는 산책 장소입니다. 아티스트 만남이나 사유 건물 출입은 포함되지 않습니다.",
    // 거리 전체가 약 1km라 이 좌표는 시작 지점 기준이다. 거리 전 구간을 가리키지 않는다.
    coord: { lat: 37.52792, lng: 127.04183, source: "https://dapi.kakao.com/v2/local/search/address.json", checked_on: "2026-09-20" },
    address: "407 Apgujeong-ro, Gangnam-gu, Seoul", from: null, to: null,
    opens: null, closes: null, closedDays: [], reservation: false,
    do: "Check local access conditions before visiting the public street. Stay in public visitor areas.",
    get: "A public walking stop with K-pop themed sculptures. No artist meeting or private-building access is included.",
    provenance: { mode: "reviewed", author: "Korea Tourism Organization · destination listing", checkedOn: "2026-09-19", url: "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=72790" },
  },
];
