import type { FanEvent } from './planner';

// 공식 팝업스토어 (T-078). 브랜드·소속사가 보도자료로 알린 행사만 싣는다 — 팬 주최 행사와 달리 보도에 기간·주소가 나온다.
//
// 수퍼드라이 × 박지훈: 한국섬유신문·패션비즈 두 기사(모두 2026-09-23 게재, 2026-09-28 확인)가 같은 내용을 적었다.
// "9월 30일부터 10월 12일까지 슈퍼드라이 성수점과 스토리칸(서울 성동구 연무장길 17)". 두 곳이 같은 건물이라
// 한 곳으로 싣는다(카카오 장소 검색에서 스토리칸·슈퍼드라이 성수플래그십스토어 모두 연무장길 17).
// 운영시간은 두 기사 모두 없어 null이다(자동 편성 제외). 10/2 박지훈 참여 행사는 사전 응모로 뽑힌 사람만이라
// 문구로만 알리고, 그날을 따로 일정처럼 보이게 하지 않는다.
export const popups: FanEvent[] = [
  {
    id: 'PU-PARKJIHOON-SUPERDRY-2026', title: 'Superdry × Park Jihoon pop-up · Seongsu', title_ko: '슈퍼드라이 × 박지훈 팝업 · 성수',
    artistIds: ['P-SOLO-PARKJIHOON'], area: 'Seongsu', area_ko: '성수', kind: 'Pop-up store', category: 'popup',
    from: '2026-09-30', to: '2026-10-12', address: '서울 성동구 연무장길 17 (슈퍼드라이 성수점 · 스토리칸)',
    coord: { lat: 37.54374, lng: 127.05145, source: 'https://place.map.kakao.com/223897826', checked_on: '2026-09-28' },
    opens: null, closes: null, closedDays: [], reservation: false,
    do: 'Brand pop-up with the F/W collection worn by Park Jihoon, collab items and goods. On 2 Oct he joins as "special staff" only for customers picked through a pre-application — walk-ins are not promised.',
    do_ko: '박지훈과 함께한 F/W 컬렉션·컬래버 의류·굿즈를 파는 브랜드 팝업이에요. 10월 2일 박지훈 참여 행사는 사전 응모로 뽑힌 고객만 대상이에요 — 현장 방문으로 만날 수 있다는 뜻은 아니에요.',
    get: 'Opening hours were not published. Check Superdry’s official channels before you go.',
    get_ko: '운영시간은 발표되지 않았어요. 가기 전에 슈퍼드라이 공식 채널을 확인하세요.',
    provenance: { mode: 'reported', author: '패션비즈 · 한국섬유신문 (2026-09-23)', checkedOn: '2026-09-28', url: 'https://fashionbiz.co.kr/article/229795' },
  },
];
