## 태스크

T-NNN · [기록](docs/tasks/T-NNN/README.md)

## 배경 — 왜 지금

<!-- 이 작업이 필요한 이유. 기획서·가이드 근거가 있으면 조항까지 -->

## 변경 내용

<!-- diff 요약이 아니라 "무엇이 가능해졌나"와 판단 근거. 하지 않은 것도 -->

## 동작 고정 표

<!-- 라우팅·분기·권한처럼 경계가 있는 변경이면 필수. UI만 바뀌었으면 아래 스크린샷 표로 대신한다 -->

| 입력 / 상황 | 기대 결과 |
|-------------|-----------|
| | |

## 스크린샷

<!-- UI 변경 시 필수. pnpm capture T-NNN. 링크는 커밋 SHA로 고정한 blob URL (private 레포라 raw 임베드는 깨짐) -->

| 화면 | mobile | tablet | desktop |
|------|--------|--------|---------|
| | | | |

## 검증

<!-- 실제로 돌린 것만 체크하고 숫자를 적는다. 안 한 건 비워둔다 -->

- [ ] `pnpm lint` — 
- [ ] `pnpm typecheck` — 
- [ ] `pnpm test:e2e` — N건 통과
- [ ] `pnpm capture T-NNN` — N장
- [ ] API 키가 브라우저로 나가지 않는다 / 가입 없이(또는 데모 경로로) 핵심 흐름을 볼 수 있다 ([제출 요건](docs/specs/submission-requirements.md))

## 체크리스트

- [ ] 브랜치 이름에 태스크 번호가 있다
- [ ] 커밋마다 본문에 "왜 / 하지 않은 것 / 검증"이 있다
- [ ] `docs/tasks/T-NNN/README.md` 작성, `docs/tasks/README.md` 목록 갱신
- [ ] 스크립트·환경 변수·폴더 구조가 바뀌었다면 README 갱신
- [ ] `gh pr diff` 셀프 리뷰 완료

## 머지 후 일어나는 일

<!-- main 머지 = Vercel 프로덕션(제출 링크) 자동 배포. 배포 후 pnpm check:prod <프로덕션 URL> 결과를 적는다.
     DB 마이그레이션, Vercel에 추가해야 할 환경 변수, 수동 조치도 여기에 -->

- Vercel 프로덕션 자동 배포 → `pnpm check:prod` 결과: 
