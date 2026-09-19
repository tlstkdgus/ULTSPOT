# ULTSPOT 데이터 수집 요청서

2026-09-19 · T-006 · 수집 담당자용. [복사해서 전달할 프롬프트](collection-prompt.md) · [제품 반영 계획](../specs/multi-artist-data.md)

## 목적과 범위

여러 K팝 아티스트를 좋아하는 여행자가 자신의 여행 날짜에 실제 방문 가능한 행사·장소를 찾도록 데이터를 모은다. 스트레이 키즈는 초기 사례이며 서비스 전체 범위가 아니다. 그룹·멤버·유닛·솔로를 지원한다. 배우·다른 장르 확장은 후순위다.

기본 아티스트 목록은 넓게, 행사·장소는 원출처를 검증할 수 있는 서울의 현재·예정 정보부터 수집한다. 인기 순위나 확보량을 추정하지 않는다. 9월 21일 이후 방문 가능한 행사도 포함하고 종료 행사는 별도 상태로 보존한다. 검색 결과가 없으면 `검색 범위 내 미발견`이며 실제 행사 부재를 뜻하지 않는다.

시작 후보(인기 순위·행사 존재를 검증한 목록 아님): BTS, SEVENTEEN, Stray Kids, TXT, ENHYPEN, NCT 및 유닛, ATEEZ, RIIZE, ZEROBASEONE, BOYNEXTDOOR, TWS, BLACKPINK, TWICE, aespa, IVE, LE SSERAFIM, ITZY, NMIXX, ILLIT, BABYMONSTER, IU, 태연, 지드래곤. 최신 공식 명칭·소속 관계는 수집 시 확인한다. 후보에 없는 아티스트도 같은 형식으로 추가한다.

## 작업 분담과 납품

전달 폴더는 `.local-data/incoming/`. 원본 전달·CSV·JSON 검증은 [적재 안내](intake.md)를 따른다. 수집 파일은 자동으로 공개되지 않는다.

- 담당자는 그룹 단위로 배정하고 해당 멤버와 솔로 활동을 함께 조사한다. 장소 중복은 공통 담당자가 정리한다.
- 우선순위: 아티스트 기본 정보 → 현재·예정 행사 → 관련 상설 장소 → 공통 K팝 장소 → 주변 식당·카페·관광지.
- 첫 묶음의 제안 목표는 행사 10~20건, 상설 장소 15~20곳이다. 전체 팀 기준이며 할당량이나 실제 확보 보장이 아니다. 숫자보다 검증을 우선한다.
- 공유 시트 또는 UTF-8 CSV를 아래 탭별로 전달한다. 한글로 작성 가능하며 번역은 후속 검수한다. API 키·계정 비밀번호는 포함하지 않는다.
- ID는 문자열 고유값을 부여하고 변경하지 않는다. 다른 담당자와 겹치면 통합 담당자가 병합하고 참조 ID도 함께 고친다.

## 공통 표기

날짜 `YYYY-MM-DD`, 시각 `HH:mm`(24시간제), 시간대 `Asia/Seoul`, 통화 `KRW`. 확인 일시는 시간대가 있는 ISO 8601을 쓴다. 불명확한 연도를 올해로 바꾸지 않는다.

모르는 값은 `미확인`, 적용되지 않는 값은 `해당 없음`. `무료`, `휴무 없음`, `예약 불필요`, 숫자 0은 출처에서 확인한 경우에만 쓴다. 저장 단계에서는 타입에 맞게 변환하되 미확인과 해당 없음의 상태를 보존한다. 사실·팀 추정·AI 초안은 구분한다. 아래 필수는 반드시 조사·기록할 항목이며 미확인 값을 임의로 채우라는 뜻이 아니다.

## 탭과 필드

| 탭 / 한 행 | 필수 조사·기록 | 선택·해당 시 기록 |
|---|---|---|
| `artists` / 그룹·개인·유닛 하나 | artist_id, entity_type(group/person/unit), name_ko, name_en, official_url, source_ids | aliases, birthday_mm_dd(개인), debut_date, anniversary_date, fandom_name, image_asset_id |
| `artist_relations` / 소속 관계 하나 | relation_id, parent_artist_id, child_artist_id, relation_type(member_of/unit_of), source_ids | valid_from, valid_to, 현재·과거·미확인 상태 |
| `places` / 실제 지점 하나 | place_id, name_ko, name_en, category, city, district, address_ko, floor, operating_status, source_ids | address_en, neighborhood, map_url, latitude, longitude, coordinate_source_id, price_amount, currency, accessibility, language_support, payment_support, visit_minutes_estimate |
| `events` / 특정 장소의 행사 하나 | event_id, title_ko, title_en, event_type, place_id, organizer_name(공개 명칭), organizer_type(공식/팬/매장/미확인), start_date, end_date, timezone, status, reservation_status, admission_condition, source_ids | reservation_url, booking_start, booking_end, overseas_booking_conditions, price_amount, currency, age_condition, series_id |
| `event_artists` / 행사와 아티스트 연결 하나 | event_id, artist_id, relevance_type, source_ids | 설명 |
| `place_artists` / 장소와 아티스트 연결 하나 | place_id, artist_id, relevance_type(촬영/공식 콘텐츠 방문/공식 매장 등), source_ids | content_date, video_timestamp, 사실 요약 |
| `hours` / 운영 구간 하나 | hours_id, target_type(event/place), target_id, schedule_type(date/weekday), date 또는 weekday, state(open/closed/unknown), opens, closes, timezone, source_ids | last_entry, last_order, close_day_offset(0/1) |
| `benefits` / 특전 조건 하나 | benefit_id, event_id, required_action, benefit, availability_status, source_ids | price_amount, currency, applicable_date, quantity, per_person_limit, first_come, sold_out_at |
| `sources` / 특정 항목의 근거 하나 | source_id, target_type, target_id, supported_fields, url, publisher, checked_at, review_status, collection_method, reuse_status | published_at, collector_alias, reviewer_alias, conflict_note, terms_url, permission_reference, change_note |
| `assets` / 사용 후보 이미지 하나 | asset_id, original_url, rights_holder, permission_status, evidence_reference | allowed_use, attribution, expires_at, file_reference |

`source_ids`와 `aliases`는 시트에서 `|`로 구분한다. 연결 자체가 복수인 경우 관계 탭에 여러 행으로 작성한다. 번역을 모르면 name_en/title_en은 미확인으로 두고 원문을 보존한다. 이미지 탭은 이미지가 없으면 비워도 된다.

### 시간·조건을 분리하는 이유

- 행사 시간은 매장 평소 영업시간과 별개다. 행사별 `hours`를 우선하며 확인되지 않은 행사 시간을 매장 시간으로 대신 확정하지 않는다.
- 첫날·마지막 날 운영시간, 특정일 휴무는 날짜 행으로 기록한다. 날짜 예외는 요일 규칙보다 우선한다.
- 12~15시, 17~20시처럼 휴식시간이 있으면 운영 구간을 두 행으로 나눈다. 자정 이후 종료는 close_day_offset=1로 명시한다. 현재 플래너는 이 확장 형식을 아직 지원하지 않는다.
- 예약은 required/optional/not_required/unknown, 행사 상태는 scheduled/ongoing/ended/cancelled/postponed/unknown으로 구분한다. 현재 코드의 예약 boolean으로 미확인을 false 처리하지 않는다.
- 특전의 구매 조건·수량·선착순·소진 여부를 분리한다. 방문하면 무조건 받는 것으로 요약하지 않는다.
- 예상 체류시간은 팀 추정임을 표시한다. 실제 교통시간·대기시간·재고는 임의로 만들어 넣지 않는다.

## 중복과 관련성

동일 인물의 그룹·유닛·솔로 활동은 같은 person ID를 참조한다. 그룹 또는 유닛에는 별도 ID를 부여한다. 같은 이름의 다른 인물은 분리한다. 이름 일치만으로 자동 병합하지 않는다.

같은 카페의 다른 행사는 별도 event ID, 같은 행사의 여러 장소는 장소별 event ID와 공통 series_id를 사용한다. 행사명·주최자·장소·기간을 대조해 중복을 검토한다. 날짜별 시간 변경은 새 행사를 생성하지 않는다.

그룹 행사라고 모든 멤버가 참석한다는 뜻은 아니다. 관련 아티스트와 실제 출연은 구분한다. 과거 공식 콘텐츠 방문지는 현재 목격 장소가 아니다. 일반 K팝 공간·주변 식당은 아티스트 연결이 없어도 된다.

## 출처·권리·개인정보 운영 기준

공개되어 있다는 이유만으로 복제·AI 처리·재배포 가능하다고 판단하지 않는다. 이 문서는 수집 운영 기준이며 개별 이용에 대한 법률 보증이 아니다.

1. 주최자·매장의 직접 제공, 공식 원문, 이용 조건을 확인한 공공데이터를 우선한다. 수집 방법과 원출처를 기록한다.
2. 경쟁 서비스 목록을 복제하거나 접근 제한·약관을 수작업으로 우회하지 않는다. SNS/API·지도 데이터의 저장·표시·갱신 조건은 경로별 검토 후 적용한다. API 키 보유는 모든 이용 권한을 뜻하지 않는다.
3. 사실을 자기 문장으로 요약하고 사진·포스터·긴 소개글은 별도 권리 확인 전 재게시하지 않는다. 주최자 제공 포스터도 사진 등 제3자 권리의 확인 범위를 기록한다. 허락 없는 이미지를 AI 서비스에 업로드해도 된다고 가정하지 않는다.
4. 사택·숙소·비공개 연습실·실시간 목격 위치, 팬·주최자의 사적 연락처·계좌는 제외한다. 공개 행사 주최자의 표시는 필요한 공개 명칭·공지 링크 수준으로 제한한다.
5. 이미지 권한이 없으면 텍스트와 출처 링크로 진행한다. 좌표·지도 검색 결과도 제공처 이용 조건을 확인한다.

참고: [한국저작권위원회 FAQ](https://www.copyright.or.kr/customer-center/faq/list.do?categorycode1=&pageIndex=1&portalcode=04&searchkeyword=). 개별 플랫폼의 최신 약관 검토를 대체하지 않는다.

## 공개 전 검수와 반려

수집 → 형식·ID 중복 검사 → 출처·권리 확인 → 날짜·시간·조건 검수 → 승인 → 공개. 수집 완료와 공개 승인은 다르다. 가능하면 다른 담당자가 교차 검수한다.

- 출처 누락, 개최 연도 불명, 주소 충돌, 취소 여부 충돌은 검수 대기로 둔다.
- 날짜·장소·관련 아티스트·출처를 확인한 행사만 공개 후보로 삼는다. 시간 미확인은 명시적으로 표시하고 자동 일정에서 제외한다.
- 예약 필수·미확인, 운영 구간 미지원 데이터는 현재 자동 일정에 억지로 넣지 않는다.
- 권리 상태가 미확인이면 해당 이미지·콘텐츠 게시를 보류한다. 사실 데이터의 사용 가능 여부도 수집 경로별로 별도 판단한다.
- 기간 한정 행사는 공개 전과 운영 중 매일 재확인을 기본 목표로 하고 변경·취소 제보는 우선 검수한다. 확인일을 노출하고 실시간 보장을 하지 않는다. 삭제·수정 의무는 적용 약관을 따른다.
- 반려·보류 사유와 재확인 담당자를 남긴다. 종료 행사를 미래 행사로 바꾸지 않는다.

## 팀별 책임

수집팀: 사실·출처·이용 조건·미확인 항목 납품. 검수팀: 중복 병합, 충돌 해결, 번역 승인, 공개 판단. 개발팀: 스키마·임포트·권한·검색·일정 연결·갱신 도구. 교통 API 연동, 사용자 취향·일정·이용 로그는 개발 영역이며 수집팀에 개인 데이터를 요청하지 않는다.
