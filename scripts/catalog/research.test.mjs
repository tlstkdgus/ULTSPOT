import { test } from 'node:test';
import assert from 'node:assert/strict';
import { branches, convert, eligibility, fieldMap, referenceMap, summarise, toCsv, validateResearch, UNKNOWN } from './research.mjs';

const source = (id, access, facts = []) => ({
  source_id: id, url: `https://example.com/${id}`, publisher: 'p', source_type: 'primary',
  access, checked_at: '2026-09-20T14:37:33+09:00', published_at: null, supported_facts: facts, summary: '', access_note: '',
});
const fact = (field, value, status = 'confirmed', appliesTo = null, sourceIds = ['S1']) =>
  ({ field, value, status, applies_to: appliesTo, source_ids: sourceIds, note: null });

const batch = (records, sources = [source('S1', 'read')]) => ({
  schema_version: 'ultspot-research-v1', batch_id: 'b1', researched_at: '2026-09-20T14:37:33+09:00',
  window: { from: '2026-09-20', to: '2026-10-20', timezone: 'Asia/Seoul' }, records, sources, unresolved: [],
});

const mightyEvent = (overrides = {}) => ({
  reference_key: 'evt-mighteez-rock-the-stage', existing_id: null, record_type: 'event',
  label: 'MIGHTEEZ', scope: 'current_window', conflicts: [], missing_fields: [],
  facts: [
    fact('title_en', 'Rock The Stage'),
    fact('start_date', '2026-09-18'),
    fact('end_date', '2026-09-27'),
    fact('venue_name', 'K-POP SQUARE HONGDAE', 'confirmed', '서울 홍대 지점'),
    fact('venue_name', 'K-POP SQUARE LOTTE WORLD MALL', 'confirmed', '서울 롯데월드몰 지점'),
    fact('opens', '11:00', 'confirmed', '서울 홍대 지점'),
    fact('closes', '22:00', 'confirmed', '서울 홍대 지점'),
    fact('opens', null, 'unknown', '서울 롯데월드몰 지점', []),
    fact('closes', null, 'unknown', '서울 롯데월드몰 지점', []),
  ],
  ...overrides,
});

test('구조 검증은 접수 기록을 믿지 않고 다시 센다', () => {
  const result = validateResearch(batch([mightyEvent()]));
  assert.equal(result.errors.length, 0);
  assert.equal(result.counts.records, 1);
  assert.equal(result.counts.byType.event, 1);
  assert.equal(result.counts.byAccess.read, 1);
});

test('존재하지 않는 출처·중복 키·매핑 없는 레코드는 오류다', () => {
  const missingSource = validateResearch(batch([mightyEvent({ facts: [fact('title_en', 'x', 'confirmed', null, ['S9'])] })]));
  assert.ok(missingSource.errors.some(e => e.includes('missing source S9')));

  const duplicate = validateResearch(batch([mightyEvent(), mightyEvent()]));
  assert.ok(duplicate.errors.some(e => e.includes('duplicate reference_key')));

  const unknownKey = validateResearch(batch([mightyEvent({ reference_key: 'evt-not-in-map' })]));
  assert.ok(unknownKey.errors.some(e => e.includes('no explicit ID mapping')));
});

test('confirmed인데 원문 열람 출처가 없으면 경고로 남는다', () => {
  const result = validateResearch(batch([mightyEvent()], [source('S1', 'snippet_only')]));
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some(w => w.includes('confirmed without a read source')));
});

test('기존 ID는 이름 유사도가 아니라 명시적 매핑으로만 붙는다', () => {
  assert.equal(referenceMap['evt-lsf-2026fw-popup'].collectionId, 'EV-006');
  assert.equal(referenceMap['evt-exo-planet6-encore'].collectionId, 'EV-007');
  assert.equal(referenceMap['evt-day6-5th-fanmeeting'].collectionId, 'EV-008');
  assert.equal(referenceMap['evt-day6-5th-fanmeeting'].region, 'outside_seoul');
  // 런타임 카탈로그와 수집 CSV는 다른 네임스페이스다.
  assert.equal(referenceMap['place-hikr-ground'].runtimeId, 'hikr-ground');
  assert.equal(referenceMap['place-hikr-ground'].collectionId, null);
  assert.equal(referenceMap['art-le-sserafim'].collectionId, 'A-HY-LSF');
  // 기존에 없으면 신규 후보로 남기고, 비슷한 기존 ID에 억지로 붙이지 않는다.
  assert.equal(referenceMap['art-ateez'].decision, 'new');
  assert.equal(referenceMap['art-ateez'].collectionId, null);
  // 아티스트 식별이 충돌하는 행사는 보류다.
  assert.equal(referenceMap['evt-jeon-soyeon-popup-times-square'].decision, 'hold');
});

test('지점 구분을 합치지 않는다', () => {
  assert.deepEqual(branches(mightyEvent()), ['서울 홍대 지점', '서울 롯데월드몰 지점']);
  const verdict = eligibility(mightyEvent(), [source('S1', 'read')], '2026-09-20');
  assert.equal(verdict.perBranch.length, 2);
  const lotte = verdict.perBranch.find(b => b.branch === '서울 롯데월드몰 지점');
  assert.ok(lotte.blockers.includes('여는 시각 миconfirmed'.replace('миconfirmed', '미확인')));
  assert.equal(lotte.autoSchedulable, false);
});

test('공개 자격과 자동 편성 자격은 독립이다', () => {
  // 날짜·장소가 확인됐지만 주소가 없고 예약 조건이 있으면 발견 카드는 가능하고 자동 편성은 안 된다.
  const verdict = eligibility(mightyEvent({ facts: [...mightyEvent().facts, fact('reservation_status', '현장 대기 등록 후 입장')] }),
    [source('S1', 'read')], '2026-09-20');
  assert.equal(verdict.discoverable, true);
  assert.equal(verdict.autoSchedulable, false);
  assert.ok(verdict.perBranch[0].blockers.some(b => b.includes('확정 예약')));
});

test('종료된 행사는 추천이 아니라 역사 정보다', () => {
  const ended = mightyEvent({ facts: [fact('title_en', 'x'), fact('start_date', '2026-09-14'), fact('end_date', '2026-09-20'), fact('venue_name', 'v')] });
  const verdict = eligibility(ended, [source('S1', 'read')], '2026-09-21');
  assert.equal(verdict.discoverable, false);
  assert.ok(verdict.reasons.some(r => r.includes('이미 종료됐다')));
  // 조사일과 같은 날이면 아직 종료로 보지 않는다.
  assert.equal(eligibility(ended, [source('S1', 'read')], '2026-09-20').discoverable, true);
});

test('출처 간 충돌이 남아 있으면 공개 자격을 주지 않는다', () => {
  const conflicted = mightyEvent({ conflicts: [{ description: '운영시간 상충', source_ids: ['S1'] }] });
  const verdict = eligibility(conflicted, [source('S1', 'read')], '2026-09-20');
  assert.equal(verdict.discoverable, false);
  assert.equal(verdict.conflictCount, 1);
});

test('enum·timestamp·boolean으로 손실되는 원문은 조건 행으로 보존한다', () => {
  const record = mightyEvent({ facts: [
    ...mightyEvent().facts,
    fact('reservation_status', '9/19~9/27 현장 대기 시스템에 휴대폰 번호 등록 후 입장', 'confirmed', '2026-09-19~2026-09-27'),
    fact('booking_start', '2026-09-13 19:00 PDT', 'confirmed', '사전 예약'),
    fact('lucky_draw', '사인 CD 응모 이벤트'),
    fact('price', null, 'unknown', null, []),
  ] });
  const { intake } = convert(batch([record]), { today: '2026-09-20' });

  const reservation = intake.event_conditions.find(r => r.condition_type === 'reservation_status');
  assert.ok(reservation.value.includes('휴대폰 번호 등록'));
  assert.equal(reservation.applies_to, '2026-09-19~2026-09-27');
  // 긴 설명이 events.reservation_status 이넘 칸으로 새지 않는다.
  assert.equal(intake.events.some(r => 'reservation_status' in r), false);

  // 시간대 없는 값·PDT 문자열을 ISO timestamp로 바꾸지 않는다.
  const booking = intake.event_conditions.find(r => r.condition_type === 'booking_start_raw');
  assert.equal(booking.value, '2026-09-13 19:00 PDT');
  assert.equal(intake.events.some(r => 'booking_start' in r), false);

  // 응모 설명이 boolean true가 되지 않는다.
  const lucky = intake.event_conditions.find(r => r.condition_type === 'lucky_draw');
  assert.equal(lucky.value, '사인 CD 응모 이벤트');
  assert.notEqual(lucky.value, 'true');

  // 미확인도 기록이다. 빈칸으로 사라지지 않는다.
  const price = intake.event_conditions.find(r => r.condition_type === 'price_raw');
  assert.equal(price.value, UNKNOWN);
});

test('탭에 칸이 없는 사실은 버리지 않고 사이드카로 보존한다', () => {
  const record = { reference_key: 'place-hikr-ground', record_type: 'place', label: 'HiKR', scope: 'current_window',
    conflicts: [], missing_fields: [], facts: [
      fact('station_ko', '종각역'), fact('line_ko', '1호선'), fact('exit', '5'), fact('walk_minutes', 2),
      fact('public_access', '층별 공개 범위'), fact('do_ko', '전시 공간을 둘러보세요'),
      fact('brand_new_field', '값'),
    ] };
  const { intake, sidecar } = convert(batch([record]), { today: '2026-09-20' });
  const preserved = sidecar.records[0];
  assert.equal(preserved.transit.length, 4);
  assert.equal(preserved.access.length, 1);
  assert.equal(preserved.visitorCopy.length, 1);
  // 매핑이 없는 새 필드도 조용히 사라지지 않는다.
  assert.deepEqual(sidecar.unmapped, [{ referenceKey: 'place-hikr-ground', field: 'brand_new_field', appliesTo: null, status: 'confirmed' }]);
  // 교통·안내 문구가 places 탭 행으로 잘못 나가지 않는다.
  assert.equal(intake.places.length, 0);
  // 조사 원문 전체는 사이드카에 그대로 남는다.
  assert.equal(preserved.facts.length, 7);
});

test('이미지는 조사자가 무엇을 적었든 승인 자산이 되지 않는다', () => {
  const record = { reference_key: 'img-lsf-press-photo', record_type: 'image', label: 'photo', scope: 'current_window',
    conflicts: [], missing_fields: [], facts: [
      fact('original_url', 'https://example.com/a.jpg'),
      fact('permission_status', 'granted'),
      fact('rights_holder', '쏘스뮤직'),
    ] };
  const { intake, eligibilities } = convert(batch([record]), { today: '2026-09-20' });
  for (const row of intake.assets) {
    assert.equal(row.permission_status, 'not_verified');
    assert.equal(row.evidence_reference, UNKNOWN);
  }
  // 조사자의 주장은 별도 칸에만 남는다.
  assert.ok(intake.assets.some(r => r.permission_status_claimed === 'granted'));
  assert.equal(eligibilities[0].discoverable, false);
  assert.equal(summarise({ intake, sidecar: { records: [], unmapped: [] }, eligibilities }).approvedImages, 0);
});

test('출처의 열람 상태를 소급해 올리지 않고 재사용 허락과 분리한다', () => {
  const { intake } = convert(batch([mightyEvent()], [source('S1', 'snippet_only')]), { today: '2026-09-20' });
  const row = intake.sources[0];
  assert.equal(row.collection_method, 'snippet_only');
  assert.equal(row.review_status, 'pending');
  // 열람했다는 사실이 재사용 허락이 아니다.
  assert.equal(row.reuse_status, 'not_verified');
});

test('confirmed를 공개로 바꾸지 않는다', () => {
  const { intake } = convert(batch([mightyEvent()]), { today: '2026-09-20' });
  const serialised = JSON.stringify(intake);
  assert.equal(serialised.includes('"public":true'), false);
  assert.equal(serialised.includes('"published"'), false);
});

test('CSV는 쉼표·줄바꿈·따옴표를 깨뜨리지 않는다', () => {
  const csv = toCsv([{ a: '값, 포함', b: '줄\n바꿈', c: '따"옴표' }]);
  assert.equal(csv, 'a,b,c\r\n"값, 포함","줄\n바꿈","따""옴표"');
  assert.equal(toCsv([]), '');
});

test('필드 매핑은 세 갈래 중 하나로만 분류된다', () => {
  for (const [field, target] of Object.entries(fieldMap)) {
    const kinds = ['tab', 'condition', 'sidecar'].filter(kind => target[kind]);
    assert.equal(kinds.length, 1, `${field}: 분류가 ${kinds.length}개`);
    if (target.tab) assert.ok(target.field, `${field}: tab만 있고 field가 없다`);
  }
});
