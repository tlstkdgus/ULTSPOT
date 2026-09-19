# T-011 날짜 정밀도·회차 조건과 아티스트 선택

## 부분 날짜

`artist_relations.valid_from/valid_to`는 `YYYY`, `YYYY-MM`, `YYYY-MM-DD`를 허용한다. 원본 문자열 길이가 정밀도이며 임의의 월·일을 채우지 않는다. 가능한 날짜 범위가 완전히 역전될 때만 순서 오류로 처리한다. 행사 방문일·운영일은 계속 정확한 날짜가 필요하다.

부분 날짜는 관계의 정확한 시작·종료 시점을 보장하지 않는다. 이번 공개 아티스트 관계는 별도로 확인한 공식 프로필에 기반하며, 수집 파일의 관계를 자동 게시하지 않는다.

## 선택 확장 탭

기존 10개 탭 CSV/JSON은 그대로 받는다. 아래 두 탭은 있을 때만 검사하며, 미제공 탭을 추가해 기존 payload 해시를 변경하지 않는다. JSON 스냅샷 저장 구조여서 새 SQL migration이 필요하지 않다.

| 탭 | 필수 열 | 선택 열 |
|---|---|---|
| event_conditions | condition_id, event_id, condition_type, applies_to, value, source_ids | row_note |
| event_sessions | session_id, event_id, date, starts_at, ends_at, source_ids | row_note |
| booking_windows | booking_id, event_id, session_id, booking_type, opens_at, closes_at, reservation_status, source_ids | reservation_url, price_amount, currency, per_person_limit, eligibility, row_note |

시각은 시간대가 있는 ISO 8601. 모르면 `미확인`을 보존한다. session date는 한국 날짜이며, 알려진 starts_at과 일치해야 한다. booking_type은 presale/general/accessible/other/unknown. 각 예매 구간은 반드시 한 회차에 연결한다. 공통 조건도 회차별로 분리해 기록한다. 행사 ID가 다른 회차를 참조하면 거부한다.

source target_type에 event_session/booking_window를 추가했다. target_id는 해당 session_id/booking_id다. supported_fields는 해당 탭의 열 이름이어야 한다. 출처 근거를 임의 매핑하거나 권한 승인하지 않는다.

단일 booking_start/end에 혼합된 예매 문장을 자동 분해하지 않는다. 선예매·일반 예매·회차별 마감은 원문 대조 후 위 행으로 작성한다. 새 탭은 비공개 적재용이며 **기존 일정 엔진이 복수 회차를 자동 편성하는 구현은 아니다.** 종료 시각 미확인도 편성 가능으로 간주하지 않는다.

## 공개 아티스트 범위

공식 이름·유형·프로필 링크와 Stray Kids 멤버 관계만 별도 확인해 런타임 목록으로 작성했다. 기존 수집 ID를 유지한다. 원본 사진·소개글·생일·소속사 계약 정보는 가져오지 않는다. 이름 확인은 행사 참여·상품 보유·이미지 이용 권한 확인과 다르다.

| 범위 | 원출처 | 확인일 |
|---|---|---|
| Stray Kids·현재 프로필에 표시된 멤버 8명 | [JYP 프로필](https://straykids.jype.com/profile) | 2026-09-19 |
| BLACKPINK 이름·그룹 | [YG 프로필](https://ygfamily.com/en/artists/blackpink/profile) | 2026-09-19 |
| BABYMONSTER 이름·그룹 | [YG 프로필](https://ygfamily.com/en/artists/babymonster/profile) | 2026-09-19 |

현재 11개 엔티티를 선택할 수 있다. 수집된 전체 208개에 대한 승인으로 확대하지 않는다. 한글/영문/등록 별칭 검색, 최대 5개 선택, 전체 탐색, 기기 저장·복원을 제공한다. 기존 version 1 저장본에 artistIds가 없으면 전체 탐색으로 복원한다. 새 선택은 같은 cloud snapshot에도 포함된다. 이번 작업의 실제 원격 클라우드 왕복 테스트는 별도로 실행하지 않았다.

그룹 선택은 등록된 멤버를 포함하고, 개인 선택은 해당 그룹을 포함하지만 다른 멤버 단독 행사로 확장하지 않는다. 공통 K팝 장소는 최애 장소로 표시하지 않는다. 현재 아티스트 전용 검수 장소는 없으므로 선택 시 부족 안내와 공통 장소를 표시한다. 공개 DB 게시 UI·전체 관계 그래프·복수 운영 구간 일정 엔진은 후속 구현이다.

T-013: event_conditions의 applies_to/value는 미해석 원문 조건이다. 수용은 검수 승인이 아니며 자동 편성이나 단일 가격으로 변환하지 않는다. artists.agency_label은 출처의 표기이며 계약 관계의 확정을 뜻하지 않는다.
