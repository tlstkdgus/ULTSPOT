import type { FanEvent } from './planner';

// 생일 광고·서포트 (T-070). 팬이 모금해 지하철·전광판에 거는 생일 광고다.
//
// 출처는 보도 기사다(2026-09-21 스타데일리뉴스·톱스타뉴스, 2026-09-25 확인). 두 기사 모두 "합정역 CM보드,
// 9월 15일부터 30일까지"라고만 적고 호선·출구·화면 위치는 적지 않았다. 그래서 좌표는 광고판이 아니라
// **역**(카카오 장소 "합정역 2호선")을 가리킨다. 역 안 어디에 있는지는 미확인이라고 문구에 적는다.
// 운영시간은 null이다 — 광고 송출 시간이 기사에 없고, 역 운영시간을 광고 시간으로 바꿔 적지 않는다.
// 이 때문에 자동 편성에서는 빠지고 목록·지도에만 나온다(생일카페 수집본과 같은 규칙).
export const fanSupports: FanEvent[] = [
  {
    id: 'AD-FELIX-HAPJEONG-2026', title: 'Felix birthday ad · Hapjeong Station', title_ko: '필릭스 생일 광고 · 합정역',
    artistIds: ['P-JYP-FELIX'], area: 'Hapjeong', area_ko: '합정', kind: 'Birthday ad', category: 'support',
    from: '2026-09-15', to: '2026-09-30', address: '서울 마포구 양화로 지하 55 (합정역)',
    coord: { lat: 37.54991, lng: 126.91445, source: 'https://place.map.kakao.com/21160542', checked_on: '2026-09-25' },
    opens: null, closes: null, closedDays: [], reservation: false,
    do: 'A fan-funded birthday message for Felix on the CM board in Hapjeong Station. Reports do not say which line or exit — look for the digital board inside the station.',
    do_ko: '팬 모금으로 합정역 CM보드에 걸린 필릭스 생일 축하 광고예요. 기사에 호선·출구가 없어요 — 역 안 디지털 광고판을 찾아보세요.',
    get: 'Photos of the ad only. No gifts or events are reported. Screening hours are unconfirmed.',
    get_ko: '광고 사진만 찍을 수 있어요. 특전·행사는 보도되지 않았고 송출 시간은 미확인이에요.',
    provenance: { mode: 'reported', author: '스타데일리뉴스 · 톱스타뉴스 (2026-09-21)', checkedOn: '2026-09-25', url: 'https://www.stardailynews.co.kr/news/articleView.html?idxno=550422' },
  },
];
