import type { FanEvent } from './planner';

// Collection receipts b2/b3, 2026-09-20. Organizer posts were read by the collector;
// this import could not independently reopen X. Dates are reported, not live availability.
// No photos, confirmed hours, or artist attendance are asserted.
//
// Coordinates are NOT from the collection. They were derived from each reported address with
// Kakao address search (T-041), reverse-geocoded back to the same road address, and checked by
// hand against the request; `coord.source` records that, not the organizer post. So a coordinate
// is only as right as the address the organizer posted -- it pins the building, never the event.
// Hours stay null on purpose: no organizer post could be reopened, so none is asserted, and the
// planner keeps these out of automatic scheduling.
export const fanCafes: FanEvent[] = [
  {
    id: 'BC-SEUNGMIN-AUTUMN-BREAK', title: 'Seungmin Autumn Break · Tone & Manner', title_ko: '승민이의 가을방학 · 톤앤매너',
    artistIds: ['P-JYP-SEUNGMIN'], area: 'Hongdae', area_ko: '홍대', kind: 'Birthday cafe', category: 'birthdayCafe',
    from: '2026-09-20', to: '2026-09-22', address: '서울시 마포구 와우산로29가길 13 2층',
    coord: { lat: 37.55427, lng: 126.92869, source: 'https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api', checked_on: '2026-09-21' },
    opens: null, closes: null, closedDays: [], reservation: false,
    do: 'Collector-reported fan birthday cafe. Check the organizer post for current hours and entry conditions.',
    do_ko: '수집본에 소개된 팬 주최 생일카페입니다. 방문 시간과 입장 조건은 주최 공지에서 확인해 주세요.',
    get: 'Gifts, purchase and reservation conditions are unconfirmed. Artist attendance is not implied.',
    get_ko: '특전·구매·예약 조건은 미확인입니다. 아티스트가 참석하는 행사는 아닐 수 있습니다.',
    provenance: { mode: 'reported', author: '@stworlday · collection b3', checkedOn: '2026-09-20', url: 'https://x.com/stworlday/status/2096184550208700512' },
  },
  {
    id: 'BC-SEUNGMIN-DANDY-BOY', title: 'Seungmin Dandy Boy · COOKIECOCO', title_ko: '승민 댕디보이 · 쿠키코코',
    artistIds: ['P-JYP-SEUNGMIN'], area: 'Hongdae', area_ko: '홍대', kind: 'Birthday cafe', category: 'birthdayCafe',
    from: '2026-09-20', to: '2026-09-22', address: '서울 마포구 와우산로29다길 11',
    coord: { lat: 37.55499, lng: 126.92781, source: 'https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api', checked_on: '2026-09-21' },
    opens: null, closes: null, closedDays: [], reservation: false,
    do: 'Collector reports one drink per person. Contact the organizer for details and current hours.',
    do_ko: '수집본에 1인 1음료 주문이 안내돼 있습니다. 세부 조건과 방문 시간은 주최자에게 확인해 주세요.',
    get: 'Gift quantities, poster footnotes and reservation conditions remain unconfirmed.',
    get_ko: '특전 수량·포스터 각주·예약 조건은 미확인입니다.',
    provenance: { mode: 'reported', author: '@dandypuppy922 · collection b2/b3', checkedOn: '2026-09-20', url: 'https://x.com/dandypuppy922/status/2088986519025639784' },
  },
  {
    id: 'BC-KYUNGMIN-CURIOUS-ANGEL', title: 'Kyungmin Curious Angel · Tone & Manner', title_ko: '호기심천사 경탱이 키우기 · 톤앤매너',
    area: 'Hongdae', area_ko: '홍대', kind: 'Birthday cafe', category: 'birthdayCafe',
    from: '2026-09-30', to: '2026-10-04', address: '서울 마포구 와우산로29가길 13',
    coord: { lat: 37.55427, lng: 126.92869, source: 'https://developers.kakao.com/docs/latest/ko/kakaomap/rest-api', checked_on: '2026-09-21' },
    opens: null, closes: null, closedDays: [], reservation: false,
    do: 'Collector-reported Kyungmin fan birthday cafe. Read the organizer notice before visiting.',
    do_ko: '수집본에 소개된 경민 팬 주최 생일카페입니다. 방문 전에 주최 공지를 확인해 주세요.',
    get: 'Hours, admission, reservations and gifts are unconfirmed.',
    get_ko: '운영시간·입장·예약·특전 조건은 미확인입니다.',
    provenance: { mode: 'reported', author: '@twsBirth · collection b2/b3', checkedOn: '2026-09-20', url: 'https://x.com/twsBirth/status/2092618884943941776' },
  },
];
