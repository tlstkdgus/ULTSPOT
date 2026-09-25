# T-066 · 빈 시간 추천을 "일정에 넣기"로 확정

| | |
|---|---|
| 상태 | 완료 |
| 브랜치 | `feat/T-066-keep-suggestion` |
| 기간 | 2026-09-25 |
| 근거 | 사용자 요청(2026-09-25) "추천해주는 걸 플랜에 추가하는 것도 필요한 거 아냐?" |

## 동작

| 입력 | 결과 |
|---|---|
| 영업시간 미확인 추천 카드에서 "일정에 넣기" | 카드의 방문 시간(13:40–14:40)대로 확정 일정에 들어가고, 문구 "영업시간 미확인 — 내가 정한 방문 시간" |
| 영업시간을 아는 추천(TourAPI, 브레이크 없음) | 그 영업시간·휴무로 편성 |
| 넣은 뒤 | 다시 편성, 남은 빈 시간을 다시 채움. 넣은 곳은 다시 권하지 않음. txt·캘린더에 포함 |
| 선택 6곳 또는 개인 장소 12곳이 찼을 때 | 넣지 않고 "일정이 가득 찼어요" 안내 |

## 하지 않은 것

- 여러 날 여정 카드에는 버튼이 없다. 날짜·순서를 정하는 journey.ts 경로라 따로 설계가 필요하다.
- 카카오가 아닌 후보는 저장본 규칙(T-062)상 좌표를 가져가지 못한다 — 넣은 뒤 이어지는 이동시간은 미확인이다.

## 검증

gap-fill·journey-ui·suggest E2E 3뷰포트 63건 통과. tsc·eslint 통과.

| 넣기 전 | 넣은 뒤 |
|---|---|
| ![before](https://github.com/tlstkdgus/ULTSPOT/blob/3e52c04f8d0895f1174dcb6012a8bbad60319ada/docs/tasks/T-066/screenshots/keep-before-mobile.png) | ![after](https://github.com/tlstkdgus/ULTSPOT/blob/3e52c04f8d0895f1174dcb6012a8bbad60319ada/docs/tasks/T-066/screenshots/keep-after-desktop.png) |
