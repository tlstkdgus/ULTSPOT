# T-002 Vercel 배포와 제출 링크 공개 접근 검사

| | |
|---|---|
| 상태 | 리뷰 중 |
| 브랜치 | `chore/T-002-vercel-deploy` |
| PR | #3 |
| 기간 | 2026-09-16 ~ 2026-09-17 |
| 근거 | 원티드 AI 챔피언십 운영진 공지 (2026-09-16) → [docs/specs/submission-requirements.md](../../specs/submission-requirements.md) |
| 제출 주소 | **https://ultspot.vercel.app** |

## 목표

마감(9/20 23:59:59) 전에 **심사자가 설치·API 키 발급·Vercel 로그인 없이 접속할 수 있는 프로덕션 주소**를 먼저 확보한다.
그리고 그 상태가 배포 때마다 유지되는지를 명령 하나(`pnpm check:prod`)로 확인할 수 있게 한다.

## 진행 내역

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `3b3268b` | `pnpm check:prod <URL>` — 배포 주소를 빈 브라우저 컨텍스트(시크릿 창 조건)로 3뷰포트 검사. 공개 접근 검사 추가 |
| 2 | `46b308c` | 제출 요건 문서화, CONTRIBUTING·README·PR 템플릿·AGENTS.md 반영, 병합 규칙을 Merge commit으로 정정 |
| 3 | `9fa35c8` | T-002 중간 기록 (프로젝트 생성 대기), T-001 완료 처리 |
| — | (사용자) | Vercel 대시보드에서 `tlstkdgus/ULTSPOT` Import → 프로젝트 `ultspot`, main `b4812f8` 첫 프로덕션 배포 (2026-09-16 21:11 KST) |
| 4 | `1e79398` | "로그인 없이 핵심 기능"을 공지 요건에서 팀 판단으로 정정 |
| 5 | (이 문서가 들어간 커밋) | 프로덕션 검증 결과·배포본 캡처 기록 |

## 결정

- **제출 주소 = `https://ultspot.vercel.app`.** 기본 보호 설정에서 프로덕션 도메인은 열리고, 배포별·브랜치별 주소는 `vercel.com/sso-api` 로그인으로 302. 보호 설정은 끄지 않는다.
- **공지 요건과 팀 판단을 구분한다.** 공지는 앱 회원가입을 금지하지 않는다. "가입 없이 핵심 흐름을 볼 수 있게"는 가입 이탈 리스크에 따른 팀 판단이다.
- **API 키는 서버 전용, AI 실패 시 대체 결과** — 기능 설계의 전제로 유지.
- **병합은 Merge commit (squash 금지).**

## 하지 않은 것

- Vercel 프로젝트 생성을 코드로 하지 못했다: 커넥터 create 403(권한 없음), 로컬 Vercel CLI 토큰 만료. 사용자가 대시보드에서 생성.
- 보호 설정 변경, 커스텀 도메인.
- Supabase·OpenAI 프로덕션 환경 변수: 프로젝트·키가 아직 없다.
- CI에서 check:prod 자동 실행.

## 검증

- **프로덕션 `https://ultspot.vercel.app` — `pnpm check:prod` 15건 통과** (smoke 2 + 공개 접근 2 + 토큰 1 × 3뷰포트, 2026-09-17)
- `curl`: `/` 200, `/design-system` 200, `<title>ULTSPOT — Find your spot</title>` 확인
- 배포별 주소 `ultspot-7nxf846un-tlstkdgus.vercel.app` — `curl` 302 → `vercel.com/sso-api`, `pnpm check:prod` 경고 출력 후 9건 실패·6건 통과 (보호가 걸린 주소를 잡아내는지 확인한 의도된 실패)
- animal-league로 사전 확인: 보호된 주소 실패 1건, 프로덕션 도메인 통과 1건
- 주소 판별 정규식 5케이스, 잘못된 인자 2케이스 거부 확인
- 로컬 `pnpm test:e2e` 15건 통과, `pnpm lint` 0건, `pnpm typecheck` 통과
- 배포본 캡처 6장 — 직접 열어 웹폰트(Unbounded·Pretendard) 적용 확인
- 확인 못 함: 현재 브랜치(T-002)의 미리보기 배포 — 프로젝트 생성 전에 push 해서 배포가 생기지 않았다. 머지 후 프로덕션 재배포는 머지 뒤 확인한다.

## 스크린샷

`E2E_BASE_URL=https://ultspot.vercel.app pnpm capture T-002` — 프로덕션 배포본 기준.

| 화면 | mobile (390) | tablet (768) | desktop (1440) |
|------|--------------|--------------|----------------|
| `/` | <img src="screenshots/home-mobile.png" width="160"> | <img src="screenshots/home-tablet.png" width="200"> | <img src="screenshots/home-desktop.png" width="280"> |
| `/design-system` | <img src="screenshots/design-system-mobile.png" width="160"> | <img src="screenshots/design-system-tablet.png" width="200"> | <img src="screenshots/design-system-desktop.png" width="280"> |

## 후속 작업

- [ ] PR #3 머지 후 프로덕션 재배포 → `pnpm check:prod https://ultspot.vercel.app`
- [ ] Supabase 프로젝트 생성, Vercel 프로덕션 환경 변수 입력
- [ ] Supabase 무료 플랜 일시 중지 조건 확인
