# T-070 · 생일 광고·서포트 분류

| | |
|---|---|
| 상태 | 완료 |
| 브랜치 | `feat/T-070-support-category` |
| 기간 | 2026-09-25 |
| 근거 | 사용자 결정(2026-09-25) "광고 서포트 넣어줘" — [x-collection-plan §1](../../data/x-collection-plan.md) |

## 동작

| 입력 / 상황 | 결과 |
|---|---|
| 장소 필터 "생일 광고" | 생일 광고 1건(필릭스 · 합정역, 09-15~09-30) |
| 필릭스(또는 스트레이 키즈)를 고른 팬 | 광고가 보인다 |
| 다른 아티스트만 고른 팬 | 광고가 안 보인다 (생일카페와 같은 규칙) |
| 일정 만들기 | 송출 시간 미확인이라 자동 편성하지 않는다. 목록에는 담을 수 있다 |
| 10월 1일 | "이 날짜에는 운영하지 않음" |

## 데이터 출처

- [스타데일리뉴스 2026-09-21](https://www.stardailynews.co.kr/news/articleView.html?idxno=550422), [톱스타뉴스 2026-09-21](https://www.topstarnews.net/news/articleView.html?idxno=16203385): "합정역 CM보드 … 9월 15일부터 30일까지"
- 호선·출구 미기재 → 좌표는 역(카카오 장소 21160542). 역 안 위치는 미확인이라고 문구에 적었다.

## 하지 않은 것

- 플레이브 예준의 합정역 광고는 싣지 않았다. 아티스트 목록에 플레이브가 없기 때문이다.
- 10월 광고는 검색으로 확인되는 게 없어서 넣지 않았다.

## 검증

전체 E2E 516건 통과. fan-supports 2건 × 3뷰포트를 새로 넣었다. 캡처는 39장이고 필터 화면이 3장 더 있다.

| 화면 | mobile | tablet | desktop |
|---|---|---|---|
| 생일 광고 필터 | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/d4e7e7a217c8bb2b51d863467872e10b7fe26950/docs/tasks/T-070/screenshots/support-filter-mobile.png) | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/d4e7e7a217c8bb2b51d863467872e10b7fe26950/docs/tasks/T-070/screenshots/support-filter-tablet.png) | [보기](https://github.com/tlstkdgus/ULTSPOT/blob/d4e7e7a217c8bb2b51d863467872e10b7fe26950/docs/tasks/T-070/screenshots/support-filter-desktop.png) |
