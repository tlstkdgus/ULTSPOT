/**
 * ultspot-research-v1 조사 배치 → 기존 intake 13탭 + 보존 사이드카.
 *
 * 왜 별도 변환기인가: 조사 스키마는 `facts[]`에 `status`(confirmed/unknown)와 `applies_to`(지점·날짜)를
 * 붙여 놓은 구조라, 13탭 CSV에 그대로 넣을 수 없다. 그대로 넣으면
 *  - 한 행사에 여러 지점의 주소·운영시간이 합쳐지고,
 *  - `reservation_status`의 긴 한국어 설명이 enum 칸에 들어가고,
 *  - `lucky_draw='사인 CD 응모 이벤트'`가 boolean true로 뭉개지고,
 *  - `booking_start='2026-09-13 19:00 PDT'`가 KST timestamp로 오해된다.
 *
 * 그래서 이 변환기는 세 갈래로 나눈다.
 *  1. 기존 탭에 **의미가 같은 칸이 있는 것**만 CSV 행으로 만든다.
 *  2. enum·숫자·timestamp로 손실되는 원문 조건은 `event_conditions` 행으로 옮긴다.
 *  3. 탭에 칸이 아예 없는 것(역·출구·도보 분, 공개 범위 등)은 `sidecar`에 보존한다. 조용히 버리지 않는다.
 *
 * 이 변환기는 아무것도 공개하지 않는다. `confirmed`를 `public=true`로 바꾸지 않고,
 * 이미지 URL을 승인 자산으로 만들지 않는다. 출력은 .local-data(git 제외)로만 간다.
 *
 * 검토 근거: .local-data/incoming/perplexity-20260920-01/codex-review.md "Kiro 변환 주의점"
 */

export const RESEARCH_SCHEMA = 'ultspot-research-v1';

/** 수집 CSV에서 미확인은 빈칸이 아니라 이 문자열이다. 빈칸과 구분해야 "없음"으로 읽히지 않는다. */
export const UNKNOWN = '미확인';

/**
 * 조사 reference_key → 기존 ID. **사람이 대조해서 적는다.** 이름 유사도로 자동 연결하지 않는다.
 *
 * `collectionId`: .local-data/audits/second-20260920 의 CSV ID (EV-/PL-/A- 네임스페이스)
 * `runtimeId`: src/lib/trip/catalog.ts 의 런타임 ID. 두 네임스페이스는 서로 다르다.
 * `decision`: reuse(기존 행 갱신) | new(신규 후보) | hold(보류)
 */
export const referenceMap = {
  'evt-lsf-2026fw-popup': { collectionId: 'EV-006', placeId: 'PL-004', runtimeId: null, decision: 'reuse', region: 'seoul',
    note: '기존 EV-006과 날짜(9/22~27)·장소(하이브 용산)·주최 일치. 신규 행사로 만들지 않는다.' },
  'evt-exo-planet6-encore': { collectionId: 'EV-007', placeId: 'PL-008', runtimeId: null, decision: 'reuse', region: 'seoul',
    note: '기존 EV-007과 날짜(11/6~8)·KSPO DOME 일치. 30일 창 밖.' },
  'evt-day6-5th-fanmeeting': { collectionId: 'EV-008', placeId: 'PL-009', runtimeId: null, decision: 'reuse', region: 'outside_seoul',
    note: '기존 EV-008과 일치. 인천이라 서울 배치에서는 서울 외로 구분.' },
  'evt-mighteez-rock-the-stage': { collectionId: null, placeId: 'PL-006', runtimeId: null, decision: 'new', region: 'mixed',
    note: '홍대 지점은 기존 PL-006(케이팝 스퀘어 홍대점) 재사용. 롯데월드몰·부산 지점은 장소 행이 없어 신규 필요. 지점별로 행사 행을 나눈다.' },
  'evt-rescene-scent-archive': { collectionId: null, placeId: null, runtimeId: null, decision: 'new', region: 'seoul',
    note: '기존 행 없음. 더현대 서울 5층 에픽서울 장소 행이 필요하다. 9/23 종료.' },
  'evt-enhypen-house-of-vampire': { collectionId: null, placeId: null, runtimeId: null, decision: 'new', region: 'seoul',
    note: '기존 행 없음. 아라아트센터 장소 행이 필요하다. 장소 공식 페이지 404.' },
  'evt-jeon-soyeon-popup-times-square': { collectionId: null, placeId: null, runtimeId: null, decision: 'hold', region: 'seoul',
    note: '2차 출처 1건, 아티스트 동일 인물·앨범명 불일치, 조사일 당일 종료. 이름 일치만으로 기존 아티스트에 연결하지 않는다.' },
  'place-hikr-ground': { collectionId: null, placeId: null, runtimeId: 'hikr-ground', decision: 'reuse',
    note: '런타임 카탈로그에 이미 있다. 이번 배치는 주소·운영시간·교통이 전부 unknown이라 기존 검수값을 덮지 않는다.' },
  'place-musickorea-myeongdong-2': { collectionId: null, placeId: null, runtimeId: 'music-korea', decision: 'reuse',
    note: '런타임 값(퇴계로 134 1층, 10:00~22:00)과 공식 페이지 원문이 일치. 20% 할인 특전은 새 사실.' },
  'place-kstar-road': { collectionId: null, placeId: null, runtimeId: 'k-star-road', decision: 'reuse',
    note: '런타임 값과 일치. 운영시간은 양쪽 모두 미확인.' },
  'art-le-sserafim': { collectionId: 'A-HY-LSF', placeId: null, runtimeId: null, decision: 'reuse',
    note: '기존 수집 아티스트 A-HY-LSF. 런타임 목록에는 없다.' },
  'art-enhypen': { collectionId: 'A-HY-ENHYPEN', placeId: null, runtimeId: null, decision: 'reuse',
    note: '기존 수집 아티스트 A-HY-ENHYPEN.' },
  'art-ateez': { collectionId: null, placeId: null, runtimeId: null, decision: 'new',
    note: '기존 수집 228건에 없음. 공식 프로필 확인 후 신규 추가 후보.' },
  'art-rescene': { collectionId: null, placeId: null, runtimeId: null, decision: 'new',
    note: '기존 수집 228건에 없음. 신규 추가 후보.' },
  'img-lsf-press-photo': { collectionId: null, placeId: null, runtimeId: null, decision: 'hold', note: '권리 미확인.' },
  'img-mighteez-event-thumbnail': { collectionId: null, placeId: null, runtimeId: null, decision: 'hold', note: '권리 미확인.' },
  'img-rescene-popga': { collectionId: null, placeId: null, runtimeId: null, decision: 'hold', note: '경쟁 플랫폼 게재본. 사용 대상 아님.' },
  'img-kstarroad-visitkorea': { collectionId: null, placeId: null, runtimeId: null, decision: 'hold', note: '공공누리 유형 미확인.' },
  'img-exo-encore-poster': { collectionId: null, placeId: null, runtimeId: null, decision: 'hold', note: '기사 게재본. 권리 미확인.' },
};

/**
 * 조사 field → intake 목적지.
 *  { tab, field }        기존 탭에 의미가 같은 칸이 있다
 *  { condition }         enum/숫자/timestamp로 손실되므로 event_conditions로 옮긴다
 *  { sidecar }           탭에 칸이 없다. 사이드카에 보존한다
 */
export const fieldMap = {
  title_ko: { tab: 'events', field: 'title_ko' },
  title_en: { tab: 'events', field: 'title_en' },
  event_type: { tab: 'events', field: 'event_type' },
  start_date: { tab: 'events', field: 'start_date' },
  end_date: { tab: 'events', field: 'end_date' },
  status: { tab: 'events', field: 'status' },
  event_status: { tab: 'events', field: 'status' },
  organizer: { tab: 'events', field: 'organizer_name' },
  organizer_name: { tab: 'events', field: 'organizer_name' },
  organizer_type: { tab: 'events', field: 'organizer_type' },
  reservation_url: { tab: 'events', field: 'reservation_url' },
  foreign_visitor_conditions: { tab: 'events', field: 'overseas_booking_conditions' },
  venue_name: { tab: 'places', field: 'name_ko' },
  address_ko: { tab: 'places', field: 'address_ko' },
  address_en: { tab: 'places', field: 'address_en' },
  area_ko: { tab: 'places', field: 'neighborhood' },
  floor: { tab: 'places', field: 'floor' },
  opens: { tab: 'hours', field: 'opens' },
  closes: { tab: 'hours', field: 'closes' },
  last_entry: { tab: 'hours', field: 'last_entry' },
  closed_dates: { tab: 'hours', field: 'date' },
  benefit: { tab: 'benefits', field: 'benefit' },
  first_come_quantity: { tab: 'benefits', field: 'quantity' },
  per_person_limit: { tab: 'benefits', field: 'per_person_limit' },
  artist_names: { tab: 'artists', field: 'name_en' },
  birthday_mm_dd: { tab: 'artists', field: 'birthday_mm_dd' },
  session_date: { tab: 'event_sessions', field: 'date' },
  original_url: { tab: 'assets', field: 'original_url' },
  rights_holder: { tab: 'assets', field: 'rights_holder' },
  source_page_url: { tab: 'assets', field: 'source_page_url' },
  attribution: { tab: 'assets', field: 'attribution' },
  allowed_use: { tab: 'assets', field: 'allowed_use' },
  // 조사자가 적은 권리 상태는 참고값일 뿐이다. 변환 결과는 항상 not_verified로 강제한다(아래 convert 참고).
  permission_status: { tab: 'assets', field: 'permission_status_claimed' },

  // enum·숫자·timestamp 칸에 원문을 넣으면 뜻이 바뀐다. 조건 행으로 옮기고 원문을 그대로 남긴다.
  reservation_status: { condition: 'reservation_status',
    why: 'events.reservation_status는 required/optional/not_required/unknown 이넘이다. 조사 값은 입장 방식 설명 문장이라 이넘으로 압축하면 조건이 사라진다.' },
  booking_start: { condition: 'booking_start_raw',
    why: '조사 값에 시간대 없는 시각·날짜만·PDT 문자열이 섞여 있다. ISO timestamp 칸에 넣거나 임의로 KST 자정을 채우지 않는다.' },
  booking_end: { condition: 'booking_end_raw',
    why: 'booking_start와 같은 이유. 시간대 표기를 확인하기 전까지 원문 문자열로 둔다.' },
  lucky_draw: { condition: 'lucky_draw',
    why: '응모 방식 설명 문자열이다. boolean true로 바꾸면 방식과 조건을 잃는다.' },
  price: { condition: 'price_raw',
    why: '입장료·구매 조건이 문장으로 오거나 미확인이다. price_amount 숫자 칸에 임의로 넣지 않는다.' },
  admission_condition: { condition: 'admission_condition' },

  // 탭에 칸이 아예 없다. 모델 확장 전까지 사이드카로 보존한다.
  station_ko: { sidecar: 'transit' }, station_en: { sidecar: 'transit' },
  line_ko: { sidecar: 'transit' }, line_en: { sidecar: 'transit' },
  exit: { sidecar: 'transit' }, walk_minutes: { sidecar: 'transit' },
  public_access: { sidecar: 'access' },
  photo_policy: { sidecar: 'access' },
  conflicts: { sidecar: 'conflicts' },
  // 방문자용 한국어/영어 안내 문구는 수집 13탭에 칸이 없다. 런타임 FanEvent의 do/get에 해당한다.
  // 검수 전에 화면 문구로 쓰지 않기 위해 사이드카에만 둔다.
  do_ko: { sidecar: 'visitorCopy' }, do_en: { sidecar: 'visitorCopy' },
  get_ko: { sidecar: 'visitorCopy' }, get_en: { sidecar: 'visitorCopy' },
};

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * 구조 검증. 내용의 진실성은 판정하지 않는다.
 * 접수 기록(receipt.json)을 신뢰하지 않고 여기서 다시 센다.
 */
export function validateResearch(batch) {
  const errors = [];
  const warnings = [];
  if (!isObject(batch)) return { errors: ['batch is not an object'], warnings, counts: {} };
  if (batch.schema_version !== RESEARCH_SCHEMA) errors.push(`schema_version must be ${RESEARCH_SCHEMA}`);
  const records = Array.isArray(batch.records) ? batch.records : [];
  const sources = Array.isArray(batch.sources) ? batch.sources : [];
  if (!records.length) errors.push('records is empty');
  if (!sources.length) errors.push('sources is empty');

  const keys = new Set();
  const sourceIds = new Set();
  for (const source of sources) {
    if (!isObject(source) || typeof source.source_id !== 'string') { errors.push('source without source_id'); continue; }
    if (sourceIds.has(source.source_id)) errors.push(`duplicate source_id ${source.source_id}`);
    sourceIds.add(source.source_id);
    // https 아닌 출처는 근거로 쓰지 않는다.
    if (typeof source.url !== 'string' || !source.url.startsWith('https://')) warnings.push(`${source.source_id}: url is not https`);
    if (!['read', 'snippet_only', 'unread'].includes(source.access)) warnings.push(`${source.source_id}: unknown access ${source.access}`);
  }

  const factIndex = new Set();
  for (const record of records) {
    if (!isObject(record) || typeof record.reference_key !== 'string') { errors.push('record without reference_key'); continue; }
    if (keys.has(record.reference_key)) errors.push(`duplicate reference_key ${record.reference_key}`);
    keys.add(record.reference_key);
    if (!['event', 'place', 'artist', 'image'].includes(record.record_type)) errors.push(`${record.reference_key}: unknown record_type`);
    if (!referenceMap[record.reference_key]) errors.push(`${record.reference_key}: no explicit ID mapping. 사람이 referenceMap에 추가해야 한다`);
    for (const fact of Array.isArray(record.facts) ? record.facts : []) {
      if (!isObject(fact) || typeof fact.field !== 'string') { errors.push(`${record.reference_key}: fact without field`); continue; }
      factIndex.add(`${record.reference_key}|${fact.field}|${fact.applies_to ?? ''}`);
      if (!['confirmed', 'unknown', 'conflicting'].includes(fact.status)) warnings.push(`${record.reference_key}.${fact.field}: unknown status ${fact.status}`);
      for (const id of Array.isArray(fact.source_ids) ? fact.source_ids : []) {
        if (!sourceIds.has(id)) errors.push(`${record.reference_key}.${fact.field}: missing source ${id}`);
      }
      // confirmed인데 원문 열람 출처가 없으면 "원문에 그렇게 적혀 있었다"는 주장을 뒷받침하지 못한다.
      if (fact.status === 'confirmed') {
        const reads = (fact.source_ids ?? []).filter(id => sources.find(s => s.source_id === id)?.access === 'read');
        if (!reads.length) warnings.push(`${record.reference_key}.${fact.field}: confirmed without a read source`);
      }
      if (!fieldMap[fact.field]) warnings.push(`${record.reference_key}: field ${fact.field} has no mapping. 사이드카로만 보존된다`);
    }
  }

  for (const source of sources) {
    for (const supported of Array.isArray(source.supported_facts) ? source.supported_facts : []) {
      if (!keys.has(supported.reference_key)) errors.push(`${source.source_id}: supports unknown record ${supported.reference_key}`);
    }
  }

  const counts = { records: records.length, sources: sources.length, facts: factIndex.size,
    byType: Object.fromEntries(['event', 'place', 'artist', 'image'].map(type => [type, records.filter(r => r.record_type === type).length])),
    byAccess: Object.fromEntries(['read', 'snippet_only', 'unread'].map(access => [access, sources.filter(s => s.access === access).length])) };
  return { errors, warnings, counts };
}

const facts = (record, field) => (record.facts ?? []).filter(f => f.field === field);
const confirmed = (record, field, appliesTo = null) =>
  facts(record, field).find(f => f.status === 'confirmed' && (appliesTo === null || f.applies_to === appliesTo || f.applies_to === null));

/** 이 행사·장소에 붙은 지점/날짜 구분값. 하나로 합치지 않기 위해 먼저 뽑는다. */
export const branches = record => {
  const values = new Set();
  for (const fact of record.facts ?? []) if (fact.applies_to) values.add(fact.applies_to);
  return [...values];
};

/**
 * 공개 자격과 자동 편성 자격을 따로 판정한다.
 *
 * `discoverable`: 발견 카드로 보여줘도 되는가 (날짜·장소가 확인됐고 원문 열람 근거가 있고 종료·충돌이 아님)
 * `autoSchedulable`: 하루 일정에 자동으로 넣어도 되는가 (위 조건 + 운영 시작·종료 시각 + 주소 + 예약 조건 해소)
 *
 * 둘은 독립이다. 날짜·장소가 확인된 행사라도 종료 시각이 없거나 확정 예약이 필요하면 자동 편성하지 않는다.
 */
export function eligibility(record, sources, today) {
  const reasons = [];
  const sourceOf = id => sources.find(s => s.source_id === id);
  const hasRead = (record.facts ?? []).some(f =>
    f.status === 'confirmed' && (f.source_ids ?? []).some(id => sourceOf(id)?.access === 'read'));
  const mapped = referenceMap[record.reference_key];

  if (mapped?.decision === 'hold') reasons.push('매핑 판단이 보류(hold)다');
  if ((record.conflicts ?? []).length) reasons.push(`출처 간 충돌 ${record.conflicts.length}건이 해소되지 않았다`);
  if (!hasRead) reasons.push('원문 열람(read) 출처로 뒷받침되는 확인 사실이 없다');

  const start = confirmed(record, 'start_date')?.value;
  const end = confirmed(record, 'end_date')?.value;
  if (record.record_type === 'event') {
    if (!isDate(start)) reasons.push('시작일이 확인되지 않았다');
    if (!isDate(end)) reasons.push('종료일이 확인되지 않았다');
    if (isDate(end) && today && end < today) reasons.push(`이미 종료됐다(${end}) — 추천 대상이 아니라 역사 정보로 보존한다`);
    if (!confirmed(record, 'venue_name')) reasons.push('장소명이 확인되지 않았다');
  }
  const discoverable = reasons.length === 0;

  // 자동 편성은 지점별로 본다. 한 지점의 운영시간으로 다른 지점을 편성하면 안 된다.
  const scheduleBlockers = [...reasons];
  const list = branches(record).length ? branches(record) : [null];
  const perBranch = list.map(branch => {
    const blockers = [];
    if (!confirmed(record, 'opens', branch)) blockers.push('여는 시각 미확인');
    if (!confirmed(record, 'closes', branch)) blockers.push('닫는 시각 미확인');
    if (!confirmed(record, 'address_ko', branch) && !confirmed(record, 'address_en', branch)) blockers.push('주소 미확인');
    // 예약 설명이 있으면 그 자체로 확정 예약이 필요한 상태로 본다. 서비스는 예약을 대신하지 않는다.
    if (facts(record, 'reservation_status').some(f => f.status === 'confirmed')) blockers.push('확정 예약·현장 등록 조건이 있어 시각을 보장할 수 없다');
    return { branch, autoSchedulable: blockers.length === 0, blockers };
  });
  if (perBranch.every(b => !b.autoSchedulable)) scheduleBlockers.push('모든 지점에서 자동 편성 조건을 채우지 못했다');

  return {
    referenceKey: record.reference_key,
    recordType: record.record_type,
    decision: mapped?.decision ?? 'unmapped',
    existingId: mapped?.collectionId ?? null,
    runtimeId: mapped?.runtimeId ?? null,
    /** 조사 창 안(current_window)인지 밖(upcoming_long_range)인지. 창 밖은 지금 추천 대상이 아니다. */
    scope: record.scope ?? null,
    region: mapped?.region ?? null,
    /** 이미 런타임 카탈로그에 공개된 대상. discoverable=false가 "공개를 내려라"가 아니라 "이번 배치로 갱신하지 말라"는 뜻이 된다. */
    alreadyInRuntime: Boolean(mapped?.runtimeId),
    conflictCount: (record.conflicts ?? []).length,
    discoverable,
    autoSchedulable: discoverable && perBranch.some(b => b.autoSchedulable),
    reasons,
    perBranch,
  };
}

/**
 * 변환. CSV 문자열을 만들지 않고 행 객체와 사이드카를 돌려준다(테스트·검수용).
 * 어떤 사실도 버리지 않는다: 매핑이 없으면 sidecar.unmapped에 남는다.
 */
export function convert(batch, { today = null } = {}) {
  const sources = batch.sources ?? [];
  const intake = { events: [], places: [], hours: [], benefits: [], artists: [], assets: [], event_conditions: [], sources: [] };
  const sidecar = { batchId: batch.batch_id, schema: batch.schema_version, researchedAt: batch.researched_at,
    window: batch.window, records: [], unmapped: [], unresolved: batch.unresolved ?? [] };
  const eligibilities = [];
  let conditionSeq = 0;

  for (const record of batch.records ?? []) {
    const mapped = referenceMap[record.reference_key] ?? null;
    const verdict = eligibility(record, sources, today);
    eligibilities.push(verdict);

    const preserved = { referenceKey: record.reference_key, recordType: record.record_type, label: record.label,
      scope: record.scope, mapping: mapped, eligibility: verdict, transit: [], access: [], visitorCopy: [],
      conflicts: record.conflicts ?? [], missingFields: record.missing_fields ?? [], facts: record.facts ?? [] };

    for (const fact of record.facts ?? []) {
      const target = fieldMap[fact.field];
      if (!target) { sidecar.unmapped.push({ referenceKey: record.reference_key, field: fact.field, appliesTo: fact.applies_to ?? null, status: fact.status }); continue; }
      if (target.sidecar) { preserved[target.sidecar === 'conflicts' ? 'conflicts' : target.sidecar].push(fact); continue; }
      if (target.condition) {
        // 값이 미확인이어도 조건 행을 남긴다. "확인하지 못했다"도 기록이다.
        intake.event_conditions.push({
          condition_id: `RC-${String(++conditionSeq).padStart(3, '0')}`,
          event_id: mapped?.collectionId ?? UNKNOWN,
          condition_type: target.condition,
          applies_to: fact.applies_to ?? UNKNOWN,
          value: fact.value === null || fact.value === undefined ? UNKNOWN : String(fact.value),
          source_ids: (fact.source_ids ?? []).join('|') || UNKNOWN,
          row_note: [fact.note, target.why].filter(Boolean).join(' / ') || '',
        });
        continue;
      }
      // 기존 탭에 칸이 있는 사실은 행 후보로만 표시한다. 실제 행 합치기는 지점 확정 후 사람이 한다.
      intake[target.tab] ??= [];
      intake[target.tab].push({
        __referenceKey: record.reference_key,
        __appliesTo: fact.applies_to ?? null,
        __status: fact.status,
        __existingId: mapped?.collectionId ?? null,
        [target.field]: fact.value === null || fact.value === undefined ? UNKNOWN : fact.value,
        source_ids: (fact.source_ids ?? []).join('|') || UNKNOWN,
      });
    }
    sidecar.records.push(preserved);
  }

  for (const source of sources) {
    intake.sources.push({
      source_id: source.source_id, url: source.url ?? UNKNOWN, publisher: source.publisher ?? UNKNOWN,
      checked_at: source.checked_at ?? UNKNOWN, published_at: source.published_at ?? UNKNOWN,
      // 제출자가 기록한 열람 상태를 그대로 옮긴다. 소급해서 read로 올리지 않는다.
      collection_method: source.access ?? UNKNOWN,
      review_status: 'pending',
      // 권리는 별도 검수 항목이다. 열람했다는 사실이 재사용 허락이 아니다.
      reuse_status: 'not_verified',
      target_type: UNKNOWN, target_id: UNKNOWN,
      supported_fields: (source.supported_facts ?? []).map(f => `${f.reference_key}.${f.field}${f.applies_to ? `@${f.applies_to}` : ''}`).join('|') || UNKNOWN,
      conflict_note: source.access_note ?? '',
    });
  }

  // 이미지는 어떤 경우에도 승인 자산이 되지 않는다.
  // 조사자가 permission_status에 무엇을 적었든 결과는 not_verified다. 그 주장은 별도 칸으로만 남긴다.
  intake.assets = intake.assets.map(row => ({ ...row, permission_status: 'not_verified', evidence_reference: UNKNOWN }));

  return { intake, sidecar, eligibilities };
}

/** 요약. 숫자를 눈으로 확인하고 공개 판단을 사람이 내리기 위한 것이다. */
export function summarise(result) {
  const list = result.eligibilities;
  const events = list.filter(e => e.recordType === 'event');
  return {
    records: list.length,
    discoverable: list.filter(e => e.discoverable).length,
    autoSchedulable: list.filter(e => e.autoSchedulable).length,
    /** 지금 발견 카드에 올릴 수 있는 것: 공개 자격 + 조사 창 안 + 서울. 셋을 따로 센다. */
    discoverableSeoulEventsInWindow: events.filter(e => e.discoverable && e.scope === 'current_window' && e.region !== 'outside_seoul').length,
    eventsOutsideWindow: events.filter(e => e.scope !== 'current_window').length,
    eventsOutsideSeoul: events.filter(e => e.region === 'outside_seoul').length,
    alreadyInRuntime: list.filter(e => e.alreadyInRuntime).length,
    withConflicts: list.filter(e => e.conflictCount > 0).length,
    reuseExisting: list.filter(e => e.decision === 'reuse').length,
    newCandidates: list.filter(e => e.decision === 'new').length,
    hold: list.filter(e => e.decision === 'hold').length,
    conditionRows: result.intake.event_conditions.length,
    sidecarRecords: result.sidecar.records.length,
    unmappedFacts: result.sidecar.unmapped.length,
    approvedImages: 0,
  };
}

const csvCell = value => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** 검수용 CSV. 내부 표시 칸(__로 시작)은 그대로 남겨 어떤 조사 행에서 왔는지 추적한다. */
export function toCsv(rows) {
  if (!rows.length) return '';
  const columns = [...new Set(rows.flatMap(Object.keys))];
  return [columns.join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\r\n');
}
