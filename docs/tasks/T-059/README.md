# T-059 · 일일 상한과 확인 날짜를 한국 시간으로

| | |
|---|---|
| 상태 | 완료 |
| 브랜치 | `fix/T-059-seoul-day` (기준: `main` 8970a2d) |
| 기간 | 2026-09-25 |
| 근거 | 심사 기간이라 미뤄 둔 버그(세션 기록). 사용자 "너가 할 수 있는 거 수정해"(2026-09-25) |

## 문제

`new Date().toISOString().slice(0, 10)`은 UTC 날짜다. 한국 시간 오전 9시 전에는 어제 날짜가 된다.

| 위치 | 영향 |
|---|---|
| `/api/travel` 일일 상한(경로 800) | 한국 시간 자정이 아니라 오전 9시에 초기화 |
| `/api/recommend` 일일 상한(주변 검색·Jev·TourAPI) | 같음 |
| `/api/place-photo` 일일 상한(Google 사진 30) | 같음 |
| 직접 추가한 행사의 확인 날짜 | 한국 시간 0~9시에 추가하면 하루 전으로 찍힘 |
| `research-cli` 배치 ID·날짜 | 같음 |

## 고친 것

- `src/lib/seoul-date.ts`의 `seoulDate()` 하나로 모았다(`Intl` + `Asia/Seoul`). `/plan`의 오늘 날짜도 같은 함수를 쓴다.
- 스크립트(`research-cli.mjs`)는 같은 폴더의 `geocode.mjs`처럼 +9시간으로 계산한다.

## 하지 않은 것

- `journey.ts`·`planner.ts`·`intake.mjs`의 `toISOString().slice(0,10)`은 날짜 문자열이 올바른지 검사하는 용도라 시간대와 무관하다. 그대로 두었다.

## 검증

- 신규 `e2e/seoul-date.spec.ts`: 23:59 KST → 그날, 00:00 KST → 다음 날, 08:30 KST(UTC로는 전날) → 한국 날짜, 연말 경계
- E2E 전체 **417건 통과 · 3 skip · 0 실패**, test:data 64건 통과
