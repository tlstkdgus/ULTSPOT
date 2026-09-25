# T-068 · 여정에도 "일정에 넣기", 관광공사 후보 좌표 유지, 저장본 거부 수정

| | |
|---|---|
| 상태 | 완료 |
| 브랜치 | `feat/T-068-keep-everywhere` |
| 기간 | 2026-09-25 |
| 근거 | 사용자 요청(2026-09-25) "최대한 완벽한 방법으로 수정해" — T-066에서 남긴 두 한계. T-062 기록의 "관광공사 후보 좌표 유지" |

## 동작

| 입력 / 상황 | 결과 |
|---|---|
| 여러 날 여정의 추천 카드 "일정에 넣기" | 카드가 있던 자리에 방문으로 들어가고 카드의 시각대로 계산된다. 여정 저장·복원에 포함 |
| 관광공사 후보(`tour-*`)를 넣거나 담기 | 좌표 유지(출처: TourAPI 공통정보 contentId) → 이동시간 조회, 이어지는 빈 시간 추천 |
| 휴무 요일이 있는 곳을 담고 기기 저장 → 새로고침 → 복원 | 복원된다 (T-066까지는 저장본 전체가 "읽을 수 없음") |
| 24시간 영업(closes 1440) | 23:59로 잘라 저장본 규칙 통과 |
| 당일 일정에서 영업시간을 아는 곳을 넣기 | 영업시간 안에서 카드의 시각으로 고정. "영업 11:00–21:00 — 내가 정한 방문 시간에 넣음" |
| 여정에서 영업시간을 아는 곳을 넣기 | 고정하지 않고 실제 영업시간을 쓴다(순서는 사용자가 정함) |
| 개인 장소 12곳이 찬 여정 | 넣지 않고 안내. 원본 그대로 |
| 출처를 댈 수 없는 좌표(예: example.com) | 저장본에서 거부(그대로) |

## 판단

- 관광공사 웹 상세 페이지는 contentId와 다른 번호(cotid)를 써서 만들 수 없다. 그래서 좌표 출처로 TourAPI 공통정보 주소를 쓴다. 키가 없으면 열리지 않지만 어느 데이터에서 온 좌표인지는 이 주소로 가리킬 수 있다.
- 여정에서 넣은 곳의 ID는 `personal-<후보>@<날짜>`다. 개인 장소는 하루짜리(from = to)라서 같은 곳을 다른 날에도 넣으려면 날짜를 붙여야 한다.
- 여정에는 고정 시각(lockedAt)을 걸지 않는다. 앞 일정이 바뀌면 뒤 방문이 같이 밀리는 게 여정의 기본 동작이다.

## 하지 않은 것

- 여정에서 넣은 개인 장소를 1단계 장소 목록에 되돌려 보여 주지 않는다. 날짜가 여행 첫날과 다를 수 있어서 목록 규칙이 흔들리기 때문이다. 원본은 여정이다.

## 검증

전체 E2E 507건 통과, 3건 건너뜀, 0건 실패. lint는 오류 0건, tsc는 통과했다.
새로 넣은 테스트는 `e2e/suggestion-event.spec.ts` 단위 5건과 화면 2건이다(gap-fill, journey-gaps, 각각 3뷰포트). 캡처는 39장이고 넣기 화면이 9장 더 있다.

| 화면 | mobile | tablet | desktop |
|---|---|---|---|
| 여정 넣기 전 | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/journey-before-mobile.png) | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/journey-before-tablet.png) | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/journey-before-desktop.png) |
| 여정 넣은 뒤 | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/journey-after-mobile.png) | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/journey-after-tablet.png) | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/journey-after-desktop.png) |
| 관광공사 곳을 당일에 넣은 뒤 | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/tour-kept-mobile.png) | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/tour-kept-tablet.png) | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/5b04edaf2d07b6aab08d3b100be410c219cc33d4/docs/tasks/T-068/screenshots/tour-kept-desktop.png) |
