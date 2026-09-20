# T-015 UI 후속 데이터 · 2026-09-20

Claude worktree의 T-015 기록과 실제 코드를 확인했다. UI는 아직 event.title/do/get/area를 직접 표시한다. 아래 데이터만 추가해도 자동 번역되는 구조는 아니다. UI 소유권을 유지하기 위해 표시 연결을 이 문서로 전달한다.

| 요청 | 현재 반영 | 미완료 |
|---|---|---|
| 한국어 | 기존 장소 3건 title_ko/do_ko/get_ko/area_ko | 추가 수집 행사 검수, UI 연결 |
| 교통 | HiKR 종각역 1호선 5번 출구, 도보 2분 | 다른 장소 원문 확인 |
| 참여 조건 | HiKR 일반 입장 무료·유료 프로그램 별도 | 현금·선착순 수량·럭키드로우는 null(미확인) |
| 생일 | SKZ 멤버 8명 birthday_mm_dd | 다른 아티스트·생일 탐색 UI |
| 이미지 | FanEvent.image_asset_id 선택 필드 | 승인 assets 0건, 실제 이미지 게시 없음 |

## Claude 연결 계약

`eventCopy(event, locale)`를 `src/lib/trip/event-copy.ts`에서 가져와 카드·일정·검색·내보내기의 title/area/do/get 표시용으로 사용한다. 원본 객체와 일정 계산은 변경하지 않는다. 번역이 없으면 원문을 반환한다. 개인 입력은 번역하지 않는다. 언어 속성도 실제 선택된 필드에 맞춘다.

`transit`는 역명 한/영, 노선 한/영, exit 문자열, walk_minutes, source, checked_on을 가진다. 이는 출처의 참고 도보 시간이며 실시간 길찾기/일정 이동시간 계산값이 아니다.

`participation`의 cash_required/lucky_draw는 boolean 또는 null, first_come_quantity는 number 또는 null이다. null은 '없음'이 아니라 '미확인'이다. price_ko/price_en은 적용 범위를 담은 문장이다. 단일 숫자로 축약하지 않는다.

`birthday_mm_dd`는 개인 생일 월일만 나타낸다. 그룹 데뷔일로 대체하거나 생일카페 개최로 간주하지 않는다. checked_on과 source를 함께 보존한다.

image_asset_id는 기존 비공개 assets 연결을 위한 식별자이며 URL이 아니다. 별도 승인 자산 어댑터가 생기기 전에는 사진 준비 중 상태를 유지한다. 개인 저장본에서 이 검수 메타데이터를 주입하면 거부한다.

## 근거와 한계

- [HiKR 공식 안내](https://english.visitkorea.or.kr/svc/sp/hikr): 종각역 5번 출구 도보 2분, 일반 입장 무료·유료 프로그램 별도 안내를 2026-09-20 원문 확인.
- [JYP 공식 프로필](https://straykids.jype.com/profile): 8명 생일 원문 확인. 연도와 사진은 수집하지 않음.
- 기존 장소 3건 한국어는 기존 검수 설명의 의미를 보존한 번역이다. 새 영업 사실을 추가하지 않는다. Music Korea 공식 페이지는 이번 접근에서 차단되어 기존 확인일을 갱신하지 않았다.
- 실제 UI 연결·DB 업로드·프로덕션 배포는 이 데이터 작업에서 수행하지 않았다.
