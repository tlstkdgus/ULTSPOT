import type { FanEvent } from "./planner";
import { fanCafes } from './fan-cafes';
import { fanSupports } from './fan-supports';

// Each record carries its review status; collector reports are not confirmed schedules.
export const catalog: FanEvent[] = [
  ...fanCafes,
  ...fanSupports,
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
  // ── T-046 (2026-09-22) — 공식 K팝 매장 3곳. 출처 2개가 일치한 항목만 시간을 확정했다. ──
  {
    id: "ktown4u-coex", title: "Ktown4u COEX", area: "Gangnam-gu", kind: "Album shop",
    title_ko: "케이타운포유 코엑스", area_ko: "강남구",
    do_ko: "2층 매장에서 음반과 공식 굿즈를 고르고 네컷 포토부스를 이용하세요. 3층 아카데미 수업과 4층 팝업은 별도 안내를 확인하세요.",
    get_ko: "구매한 음반·굿즈. 2층 매장은 11–20시, 3층 아카데미는 12–22시로 층마다 시간이 달라요. 입장은 무료이고 아카데미는 유료예요.",
    coord: { lat: 37.51182, lng: 127.05916, source: "https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api", checked_on: "2026-09-22" },
    address: "2F–4F, 513 Yeongdong-daero, Gangnam-gu, Seoul", from: null, to: null,
    // 관광공사·공식 매장 안내 모두 2층 11:00–20:00. 연중무휴는 관광공사 페이지 "Open all year round".
    opens: 660, closes: 1200, closedDays: [], reservation: false,
    do: "Pick albums and official merch on 2F and use the photo booth. 3F academy classes and 4F pop-ups follow separate notices.",
    get: "Albums and merch you buy. Floors keep different hours — 2F store 11:00–20:00, 3F academy 12:00–22:00. Entry is free; the academy is paid.",
    provenance: { mode: "reviewed", author: "Korea Tourism Organization · Ktown4u official store page", checkedOn: "2026-09-22", url: "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=197348" },
  },
  {
    id: "kpop-square-hongdae", title: "K-POP SQUARE Hongdae", area: "Mapo-gu", kind: "Album shop",
    title_ko: "케이팝 스퀘어 홍대", area_ko: "마포구",
    do_ko: "라인프렌즈 홍대 플래그십이 2025년 6월 K팝 전문 매장으로 다시 연 곳이에요. 아티스트 캐릭터 굿즈와 포토존을 둘러보세요.",
    get_ko: "구매한 굿즈. 팝업 전시는 기간이 정해져 있으니 매장 공지를 확인하세요. 특전이나 아티스트 방문은 보장되지 않아요.",
    coord: { lat: 37.55575, lng: 126.92167, source: "https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api", checked_on: "2026-09-22" },
    address: "141 Yanghwa-ro, Mapo-gu, Seoul", from: null, to: null,
    // 관광공사 11:00~22:00 · 서울관광재단 11:00~22:00, 휴무 "Every day"(연중무휴), 2026-09-03 수정.
    opens: 660, closes: 1320, closedDays: [], reservation: false,
    do: "The former LINE FRIENDS Hongdae flagship, reopened in June 2025 as a K-pop specialty store. Browse artist character goods and photo zones.",
    get: "Merch you buy. Pop-up exhibitions run for set periods — check the store notice. No gift or artist visit is guaranteed.",
    provenance: { mode: "reviewed", author: "Korea Tourism Organization · Seoul Tourism Organization", checkedOn: "2026-09-22", url: "https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=199935" },
  },
  {
    id: "kwangya-seoul", title: "KWANGYA@SEOUL", area: "Seongdong-gu", kind: "K-pop experience",
    title_ko: "광야@서울", area_ko: "성동구",
    do_ko: "SM 본사 건물 지하 1층의 공식 플래그십 스토어예요. 음반·공식 굿즈와 아티스트 전시, 포토 프레임을 둘러보세요.",
    get_ko: "구매한 음반·굿즈. 운영시간은 2022년 개관 공지(10:30–20:00) 이후 현행 공식 안내를 확인하지 못해 미확인으로 두었어요. 방문 전 공식 계정을 확인하세요.",
    coord: { lat: 37.54415, lng: 127.04336, source: "https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api", checked_on: "2026-09-22" },
    address: "B1 D Tower Seoul Forest, 83-21 Wangsimni-ro, Seongdong-gu, Seoul", from: null, to: null,
    // 시간은 2022-11 개관 공지(X, SMTOWN &STORE)와 비공식 집계에만 있고 현행 공식 안내가 없다.
    // 확인 안 된 시간을 확정하지 않는다 — 자동 편성에서 빠지고 화면이 그 사실을 알린다.
    opens: null, closes: null, closedDays: [], reservation: false,
    do: "SM Entertainment's official flagship store on B1 of its headquarters. Browse albums, official merch, artist exhibits and photo frames.",
    get: "Albums and merch you buy. Hours are unconfirmed: the only official figure is the 2022 opening notice (10:30–20:00). Check the official account before you go.",
    provenance: { mode: "reviewed", author: "Korea Tourism Organization · SM Entertainment newsroom", checkedOn: "2026-09-22", url: "https://place.tripmate.co.kr/ko/detail.php?contentId=2988778&contentTypeId=38" },
  },
  {
    id: "ktown4u-insadong", title: "Ktown4u Insadong", area: "Jongno-gu", kind: "Album shop",
    title_ko: "케이타운포유 인사동", area_ko: "종로구",
    do_ko: "안녕인사동 3층 매장에서 음반과 공식 굿즈를 고르세요. 안국역 6번 출구에서 인사동길로 들어와요.",
    get_ko: "구매한 음반·굿즈. 시즌별 럭키드로·팝업은 매장 공지를 확인하세요. 휴무일은 출처에 없어 미확인이에요.",
    coord: { lat: 37.57447, lng: 126.98355, source: "https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api", checked_on: "2026-09-23" },
    address: "3F Anyoung Insadong, 49 Insadong-gil, Jongno-gu, Seoul", from: null, to: null,
    // 공식 매장 안내·관광공사 기사(2026-03) 모두 12:00–20:00. 관광공사 기사는 번지를 29로 적었는데
    // 공식 안내·카카오 장소검색(케타포 인사점, 안녕인사동) 모두 49다 — 기사 오기로 판단.
    opens: 720, closes: 1200, closedDays: [], reservation: false,
    do: "Albums and official merch on 3F of the Anyoung Insadong complex. Enter Insadong-gil from Anguk Station Exit 6.",
    get: "Albums and merch you buy. Seasonal lucky draws and pop-ups follow the store notice. Closed days are not stated by any source.",
    provenance: { mode: "reviewed", author: "Ktown4u official store page · Korea Tourism Organization", checkedOn: "2026-09-23", url: "https://www.ktown4u.com/stores" },
  },
];
