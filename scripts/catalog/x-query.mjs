// X(트위터) 팬 이벤트 수집용 검색어 만들기와 1차 분류 (T-065). 설계는 docs/data/x-collection-plan.md.
//
// 이 파일은 네트워크를 쓰지 않는다. X를 연결한 수집기가 여기서 만든 검색어로 검색하고, 받은 게시물 본문을
// classifyPost()로 1차 분류한 뒤 사람 검수로 넘긴다. 키워드 사전은 2026-09-25 기준 팬 이벤트 공지 관행
// (생일카페·컵홀더·특전·럭드·선착 등)에서 모았다. 실제 X 응답으로는 아직 검증하지 않았다 — 연결 후 첫 수집에서 고친다.

/** 이벤트 종류 → 우리 장소 분류(categories.ts의 FilterCategory). support는 새 분류 후보(광고·서포트). */
export const EVENT_TERMS = {
  birthdayCafe: ['생일카페', '생카', '생일 카페', '컵홀더', '컵홀더 이벤트', '생일 이벤트', '카페 이벤트', '생일카페 이벤트', 'birthday cafe', 'cupsleeve', 'cup sleeve', 'cupholder'],
  popup: ['팝업', '팝업스토어', '팝업 스토어', 'pop-up', 'popup', '전시회', '전시', '포토존'],
  filming: ['촬영지', '뮤비 촬영지', 'MV 촬영지', '성지순례'],
  support: ['생일광고', '생일 광고', '지하철 광고', '전광판', '서포트', '옥외광고'],
};

/** 특전·참여 조건 용어. 분류가 아니라 추출 대상(무엇을 받나, 어떻게 받나)을 표시한다. */
export const PERK_TERMS = {
  cupsleeve: ['컵홀더', 'cupsleeve', 'cup sleeve'],
  photocard: ['포카', '포토카드', 'photocard'],
  luckyDraw: ['럭드', '럭키드로우', '럭키 드로우', 'lucky draw'],
  firstCome: ['선착', '선착순', 'first come'],
  postcard: ['엽서', 'postcard'],
  sticker: ['스티커', 'sticker'],
  photoBooth: ['인생네컷', '포토부스', '포토이즘', 'photo booth'],
};

/** 거래·양도 글. 장소 이벤트가 아니라 굿즈 거래라 수집에서 뺀다. */
export const EXCLUDE_TERMS = ['양도', '판매', '대리', '구해요', '구합니다', '교환', '공구', '분철', '급처', '삽니다', '팝니다', 'WTS', 'WTB'];

/** 사생활 공간. 이런 장소는 공개하지 않는다(정책 PL-RMCLJT). */
export const PRIVATE_PLACE_TERMS = ['숙소', '자택', '사옥 앞', '공항 출국', '공항 입국', '출근길', '퇴근길'];

const quote = term => (/[\s\-()]/.test(term) ? `"${term}"` : term);
const any = terms => `(${terms.map(quote).join(' OR ')})`;

/**
 * 아티스트 한 명(팀)의 생일카페 검색어. 이름·한국어 이름·별칭 중 하나 AND 이벤트 용어 중 하나.
 * 사진이 있는 원글만(-is:retweet -is:reply has:images) — 주최 공지는 대부분 포스터 이미지다.
 * 거래 글은 뺀다. X 검색어 길이 한도(512자)를 넘으면 별칭부터 줄인다.
 */
export function buildArtistQuery(artist, { kinds = ['birthdayCafe'], maxLength = 512 } = {}) {
  const names = [...new Set([artist.korean, artist.name, ...(artist.aliases ?? [])].filter(Boolean))];
  const events = kinds.flatMap(kind => EVENT_TERMS[kind] ?? []);
  const tail = `${any(events)} has:images -is:retweet -is:reply -${any(EXCLUDE_TERMS.slice(0, 6))}`;
  for (let n = names.length; n >= 1; n--) {
    const query = `${any(names.slice(0, n))} ${tail}`;
    if (query.length <= maxLength) return query;
  }
  throw new Error(`Query for ${artist.name} is longer than ${maxLength} characters even with one name.`);
}

/**
 * 생일 전후 검색 기간. 생일카페는 보통 생일 전후 며칠 열리고 공지는 1~3주 전에 올라온다.
 * 기본: 생일 21일 전 ~ 생일 3일 후. 연도는 부르는 쪽이 준다.
 */
export function birthdayWindow(mmdd, year, { before = 21, after = 3 } = {}) {
  if (!/^\d{2}-\d{2}$/.test(mmdd)) throw new Error('Birthday must be MM-DD.');
  const day = Date.parse(`${year}-${mmdd}T00:00:00+09:00`);
  const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { start_time: iso(day - before * 86_400_000), end_time: iso(day + (after + 1) * 86_400_000) };
}

const has = (text, term) => text.toLowerCase().includes(term.toLowerCase());

/**
 * 게시물 본문 1차 분류. 결정이 아니라 **검수 대기열을 나누는 용도**다 — 최종 판단은 사람이 원문과 포스터를 보고 한다.
 *  - excluded: 거래 글이거나 사생활 공간 언급이면 사유와 함께 뺀다.
 *  - category: 이벤트 용어가 가장 많이 나온 분류. 없으면 null(검수 대기열 "분류 없음").
 *  - perks: 본문에 나온 특전 종류.
 *  - artistIds: artists 목록의 이름·한국어 이름·별칭이 본문에 나온 아티스트. 여럿이면 모두(사람이 고른다).
 */
export function classifyPost(text, artists = []) {
  const body = String(text ?? '');
  const reason = EXCLUDE_TERMS.find(term => has(body, term)) ? 'trade'
    : PRIVATE_PLACE_TERMS.find(term => has(body, term)) ? 'private-place' : null;
  const scores = Object.entries(EVENT_TERMS)
    .map(([kind, terms]) => [kind, terms.filter(term => has(body, term)).length])
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  const perks = Object.entries(PERK_TERMS).filter(([, terms]) => terms.some(term => has(body, term))).map(([kind]) => kind);
  // 두 글자 별칭(예: 예나·유리)은 다른 사람과 겹치기 쉽다. 본문에 그대로 있어도 약한 신호로만 표시한다.
  const artistIds = [];
  const weakArtistIds = [];
  for (const artist of artists) {
    const names = [artist.korean, artist.name, ...(artist.aliases ?? [])].filter(Boolean);
    const hit = names.find(name => has(body, name));
    if (!hit) continue;
    (hit.length <= 2 ? weakArtistIds : artistIds).push(artist.id);
  }
  return { excluded: reason, category: scores[0]?.[0] ?? null, perks, artistIds, weakArtistIds };
}
