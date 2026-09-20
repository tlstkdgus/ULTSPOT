# T-018 · T-016 방문 데이터를 최신 main에 통합

| | |
|---|---|
| 상태 | 구현·검증 (UI 연결 대기) |
| 브랜치 | `feat/T-018-visitor-data-integration` |
| PR | #22 |
| 기간 | 2026-09-20 |
| 근거 | [Kiro 개발 인계](../../handoff/kiro-development.md) "조사와 병렬로 할 작업" 1·2 · 사용자 요청(PR #19와 최신 UI 통합) |

## 목표

T-016(PR #19)의 한국어 방문 안내·교통·참여 조건·생일 데이터를 최신 `main`(T-015 UI 포함) 위에서 쓸 수 있게 만든다.

## 문제

PR #19의 기본 대상은 `feat/T-014-image-data-contract`이고, 그 브랜치는 T-015 UI 개편(#16)이 합쳐지기 **전** 상태에서 갈라졌다. PR #19을 그대로 머지하면 `git diff origin/main..origin/feat/T-016-visitor-data` 기준으로 `src/i18n/messages.ts` 455줄, `src/components/trip-planner.tsx` 347줄 등 T-015 UI 작업이 되돌아간다.

그래서 브랜치를 머지하지 않고, 데이터 커밋 `6ce22a0`만 `origin/main` 위로 cherry-pick했다.

## 진행 내역

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `2a86c5e` | `6ce22a0` cherry-pick. 충돌은 `docs/tasks/README.md` 한 곳(T-015/T-016/T-017 행)뿐이고 `src/**`는 그대로 적용됐다. |

적용된 변경: `FanEvent`의 선택 필드(`title_ko`·`do_ko`·`get_ko`·`area_ko`·`image_asset_id`·`transit`·`participation`), 부작용 없는 `eventCopy(event, locale)`, 장소 3건 한국어 문구, HiKR 교통·참여 조건 1건, JYP 원문 확인 생일 8건, 개인 저장본에서 검수 메타데이터 거부.

## 결정

- **PR #19는 머지하지 않고 닫는다(또는 내용 반영 표시).** 같은 내용이 이 브랜치로 `main` 기반에 들어왔으므로 중복 적용하면 안 된다.
- **파일 담당 범위를 고정한다.** `C:\Users\tlstk\Desktop\ULTSPOT-claude`(`design/T-016-critique-fixes`)가 2026-09-20 14:05에도 `src/components/**`, `src/i18n/messages.ts`, `src/styles/theme.css`, `src/lib/cn.ts`, `e2e/artists|capture|locale.spec.ts`를 수정 중이다. Kiro는 이 파일들을 건드리지 않는다. 담당 경계는 [claude-ui-handoff.md](../../claude-ui-handoff.md)의 "변경 금지" 항목과 같다.
- 따라서 **`eventCopy`를 카드·일정·내보내기에 연결하는 작업은 Claude 요청으로 넘긴다.** 요청 내용은 claude-ui-handoff.md "Kiro → Claude 연결 요청 (T-018)"에 적었다.

## 하지 않은 것

- **화면의 한국어 표시 연결.** `eventCopy`는 아직 어느 컴포넌트에서도 호출되지 않는다. 즉 지금 `/plan`의 장소 이름·Do/Get은 한국어를 골라도 영어 원문이다. 라이브러리 계약만 준비된 상태다.
- 이미지 게시. 승인 자산 0건이며 `image_asset_id`는 타입만 있다.
- 미확인 값 추정. `transit`이 없는 장소 2건은 없음이 아니라 미확인이고, `cash_required`/`first_come_quantity`/`lucky_draw`의 `null`도 무료·없음이 아니라 미확인이다.
- 캡처. UI 변경이 없어 `pnpm capture`를 돌리지 않았다.

## 검증

- `pnpm build` 성공 (Turbopack, 24.9s). `pnpm typecheck` 오류 0. `pnpm lint` 경고 0.
  - 참고: `typecheck`는 `.next/types`가 필요해 새 worktree에서는 `pnpm build`를 한 번 먼저 돌려야 `layout.tsx`의 `LayoutProps` 오류가 사라진다.
- `pnpm test:e2e e2e/planner.spec.ts e2e/visitor-data.spec.ts --project=desktop` → 6 passed.
  - 저장/복원/삭제: `localStorage` 저장 → reload → 복원 → `2 visits` 재계산 → 기기 저장본 삭제 후 `localStorage` null 확인.
  - 내보내기: `.txt` 다운로드 파일명 `ultspot-2026-09-22.txt` 확인.
  - 데이터 계약: `eventCopy(event,'ko').area === '중구'`, 원본 객체 불변, 개인 행사에는 한국어 검수 문구를 쓰지 않음, 생일 8건·그룹 0건.
- `pnpm test:e2e e2e/cloud-storage.spec.ts e2e/public-access.spec.ts --project=desktop` → 3 passed, **1 skipped**. 클라우드 저장 테스트는 Supabase 키가 없어 건너뛰었다. 클라우드 저장·복원·삭제는 이번에 검증하지 않았다.
- `.ics` 내보내기는 코드 경로만 그대로이고 이번에 직접 실행하지 않았다.

## 후속 작업

- Claude: `eventCopy` 연결과 `transit`/`participation` 표시, 해당 `t.lib`·`t.spots` 문구 추가.
- T-019: 지도·대중교통/도보 경로 API 조사와 좌표·이동수단 데이터 모델.
- 키가 준비되면 클라우드 저장 검증과 `pnpm check:prod https://ultspot.vercel.app` 재실행.
