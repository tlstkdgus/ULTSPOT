# T-002 Vercel 배포와 제출 링크 공개 접근 검사

| | |
|---|---|
| 상태 | 진행 중 — Vercel 프로젝트 생성 대기 |
| 브랜치 | `chore/T-002-vercel-deploy` |
| PR | #3 (Draft) |
| 기간 | 2026-09-16 ~ |
| 근거 | 원티드 AI 챔피언십 운영진 공지 (2026-09-16) → [docs/specs/submission-requirements.md](../../specs/submission-requirements.md) |

## 목표

마감(9/20 23:59:59) 전에 **심사자가 로그인·설치·API 키 없이 접속할 수 있는 프로덕션 주소**를 먼저 확보한다.
그리고 그 상태가 배포 때마다 유지되는지를 명령 하나(`pnpm check:prod`)로 확인할 수 있게 한다.

## 진행 내역

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `3b3268b` | `pnpm check:prod <URL>` — 배포 주소를 빈 브라우저 컨텍스트(시크릿 창 조건)로 3뷰포트 검사. 공개 접근 검사 추가 |
| 2 | `46b308c` | 제출 요건 문서화, CONTRIBUTING·README·PR 템플릿·AGENTS.md 반영, 병합 규칙을 Merge commit으로 정정 |
| 3 | (대기) | Vercel 프로젝트 생성 → 프로덕션 배포 → `check:prod` 결과·프로덕션 캡처 기록 |

## 결정

- **제출 주소 = Vercel 프로덕션 도메인.** 같은 계정 animal-league로 실측했다. 기본 보호 설정(`all_except_custom_domains`)에서 프로덕션 도메인은 200, 배포별·브랜치별 주소는 `vercel.com/sso-api` 로그인으로 302. 보호 설정은 끄지 않는다.
- **핵심 기능은 비로그인 체험, API 키는 서버 전용, AI 실패 시 대체 결과** — 기획서 기반 기능 설계의 전제 조건으로 고정했다.
- **병합은 Merge commit (squash 금지).** #1·#2의 실제 머지 방식에 규칙을 맞췄다.

## 하지 않은 것

- Vercel 프로젝트 생성: Vercel 커넥터가 403(프로젝트 생성 권한 없음)을 반환했고, 로컬 CLI 토큰도 만료돼 사용자가 대시보드에서 직접 생성하기로 했다.
- 보호 설정 변경, 커스텀 도메인.
- Supabase·OpenAI 프로덕션 환경 변수: 프로젝트·키가 아직 없다.
- CI에서 check:prod 자동 실행: 배포가 먼저 안정돼야 한다.

## 검증

- 보호된 주소(`animal-league-8599pbasr-tlstkdgus.vercel.app`)에 공개 접근 검사 → **실패 1건** (vercel.com/login 이동을 잡아냄) — 의도한 결과
- 프로덕션 도메인(`animal-league.vercel.app`)에 공개 접근 검사 → 통과 1건
- 주소 판별 정규식 5개 케이스, 잘못된 인자 2케이스 거부 확인
- 로컬 `pnpm test:e2e` 15건 통과, `pnpm lint` 0건, `pnpm typecheck` 통과
- **ULTSPOT 프로덕션 주소 검사: 아직 안 함** (프로젝트 생성 대기)

## 스크린샷

화면 변경 없음. 프로덕션 배포 후 `pnpm capture` 대신 배포본 기준 캡처를 추가한다.

## 후속 작업

- [ ] 사용자: vercel.com/new 에서 `tlstkdgus/ULTSPOT` Import → 프로젝트 이름 `ultspot`
- [ ] 보호 설정이 animal-league와 같은지 확인
- [ ] `pnpm check:prod <프로덕션 URL>` 실행, 결과 기록, 배포본 캡처
- [ ] 제출 칸에 넣을 프로덕션 URL을 `submission-requirements.md`에 기록
- [ ] Supabase 무료 플랜 일시 중지 조건 확인
