# T-053 · Google Analytics 4를 붙인다

| | |
|---|---|
| 상태 | 리뷰 중 (T-052 위에 쌓음) |
| 브랜치 | `feat/T-053-google-analytics` (기준: `feat/T-052-google-maps` b6bd659) |
| PR | 아래 참고 |
| 기간 | 2026-09-24 |
| 근거 | 사용자 요청(2026-09-24) "이 사이트에 Google Analytics도 붙여줬으면" |

## 결정

- **`@next/third-parties/google`의 `GoogleAnalytics`** 를 루트 레이아웃에 둔다. 이 버전 Next.js 문서
  (`node_modules/next/dist/docs/01-app/02-guides/third-party-libraries.md`)의 권장 방식이다. 스크립트는 하이드레이션
  뒤에 받는다. 패키지는 Next.js와 같은 16.3.5로 고정했다(문서의 `next@latest` 동시 업그레이드는 하지 않았다).
- **측정 ID가 있을 때만 싣는다** (`NEXT_PUBLIC_GA_MEASUREMENT_ID`). 로컬·테스트·ID 없는 배포는 그대로다.
- `G-` 형식이 아니면 싣지 않는다. 오타로 엉뚱한 스크립트 주소가 만들어지지 않게.
- 측정 ID는 페이지 소스에 보이는 공개 값이다. 비밀 키가 아니라 `NEXT_PUBLIC_`이고 Vercel에서 Sensitive로 두지 않는다.
- 기존 Vercel Analytics는 그대로 둔다.

## 바뀐 검사

- `records-ui.spec` "공유 카드는 서버 없이": 우리 서버로 나가는 요청만 센다. GA4 향상된 측정이 다운로드 클릭을
  google-analytics.com으로 POST할 수 있는데, 카드 내용이 아니라 "다운로드가 있었다"는 이벤트라 검사의 뜻(카드가
  서버로 가지 않는다)과 다르다. 프로덕션에 ID를 넣은 뒤 check:prod가 이 이유로 깨지지 않게 미리 고쳤다.

## 하지 않은 것

- **맞춤 이벤트**(일정 만들기·추천 교체 등). 기본 페이지뷰만. `/plan`의 단계 이동은 같은 주소 안의 상태 변화라
  페이지뷰로 잡히지 않는다. 단계별 이탈을 보려면 이벤트가 필요하다 — 별도 작업.
- **개인정보 안내·쿠키 동의 UI.** GA는 쿠키로 방문자를 식별한다. 사이트에 개인정보 처리방침 페이지가 아직 없다.
  공개 운영 전에 수집 항목(GA·Vercel Analytics)을 적은 안내가 필요하다.
- 테스트·check:prod 트래픽 제외. ID를 넣으면 check:prod 실행도 GA에 잡힌다. GA의 내부 트래픽 필터로 거를 수 있다.

## 검증

- typecheck 0, lint 오류 0
- 임시 측정 ID(`G-TEST12345`)로 따로 빌드해 실제 브라우저로 확인: `gtag/js?id=G-TEST12345` 로드, `g/collect` 페이지뷰
  POST 1건, `dataLayer` 4건. 확인 뒤 그 빌드는 지웠다.
- ID 없는 빌드로 E2E 전체 **396건 통과 · 3 skip · 0 실패** (390/768/1440)
- 캡처 없음 — 화면 변화가 없다.
