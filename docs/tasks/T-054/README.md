# T-054 · check:prod가 Google 사진 예산을 태우고 깨지던 문제

| | |
|---|---|
| 상태 | 완료 |
| 브랜치 | `fix/T-054-prod-check-photo-stub` (기준: `main` 5b93e16) |
| 기간 | 2026-09-25 |
| 근거 | #65~#67 머지 뒤 `pnpm check:prod https://ultspot.vercel.app` 4건 실패 |

## 무엇이 깨졌나

| 실패 | 원인 |
|---|---|
| gap-fill "카카오 지도면 Google 사진 요청 0건" × 3 | 테스트 전제가 틀렸다. 프로덕션에는 Google 키가 있어 지도가 Google이다 |
| google.spec 라우트 검사 (tablet) | 429. 추천 카드가 있는 UI 테스트마다 **실제** `/api/place-photo`를 불러 IP당 분당 20회를 넘겼다 |

두 번째가 더 큰 문제였다. check:prod 한 번이 **하루 30장의 Google 사진 예산**을 테스트 트래픽으로 쓸 수 있었다.
그러면 그날 실제 사용자는 Google 사진을 못 받는다.

## 고친 것

- `fixSuggestions()`가 `/api/place-photo`도 고정한다. 라우트 자체는 `google.spec`이 직접 검사한다.
  가로챈 요청도 `page.on("request")`에는 잡히므로 "언제 요청하는가"는 계속 검사할 수 있다.
- 약관 검사를 키 유무와 무관하게 성립하는 규칙으로 바꿨다: **Google 사진 요청이 있으면 Google 지도가 떠 있어야 한다.**
  Google 지도가 없으면 요청 0건, 있으면 요청이 나간다.

## 하지 않은 것

- 제품 코드는 바꾸지 않았다. 프로덕션 동작은 맞았다(실제 브라우저로 확인: Google 지도·타일, 관광공사 사진 3장, 콘솔 오류 0).
- check:prod 실행이 GA에 방문으로 잡히는 것. GA의 내부 트래픽 필터로 거르는 편이 맞다.

## 검증

- 프로덕션 대상 gap-fill·google 스펙 42건 통과 후, `check:prod` 전체 **396건 통과 · 3 skip · 0 실패**
- 로컬 E2E 전체 **396건 통과 · 3 skip · 0 실패** (로컬에도 Google 키가 있어 Google 지도 쪽 분기를 탄다)
