# Claude · Impeccable UI 분담

Codex는 T-013 수집·검증 코드를 담당한다. Claude는 별도 worktree에서 `/plan`의 기존 온보딩 UI를 개선한다. Claude 실행이나 작업 전달은 아직 하지 않았다.

## 별도 작업 폴더 준비

T-013 커밋 이후 아래 명령을 원래 저장소 터미널에서 실행한다. T-014가 이미 사용 중이면 작업 목록 마지막 번호 + 1로 바꾼다. 기존 폴더가 있으면 덮어쓰지 않는다.

```powershell
git worktree add ..\ULTSPOT-claude -b design/T-014-planner-polish feat/T-013-intake-conditions
```

Claude에서 `C:\Users\tlstk\Desktop\ULTSPOT-claude`를 연다. 그 폴더에서 `pnpm install`한다. 원본 폴더의 `.github/skills/impeccable`은 현재 미추적 파일이라 worktree에 자동 포함되지 않는다. 같은 스킬을 새 폴더에 설치하거나 해당 폴더를 복사한다. `.env.local`은 복사 없이 시작할 수 있다. 클라우드 검증이 필요할 때만 별도로 로컬 설정하며 키를 프롬프트에 넣지 않는다. 개발 서버는 `pnpm dev --port 3200`을 사용한다.

## Claude에 전달할 프롬프트

```text
ULTSPOT의 /plan 온보딩 UI를 Impeccable로 개선해 줘.
현재 폴더는 Codex와 분리된 worktree여야 한다. 원본 ULTSPOT 폴더나 그 브랜치를 변경하지 마.
먼저 AGENTS.md, CONTRIBUTING.md, docs/design-system.md,
docs/specs/public-planner.md, docs/specs/user-flow.md, docs/specs/submission-requirements.md를 읽어.
설치된 .github/skills/impeccable/SKILL.md를 읽고 해당 지침대로 context를 로드해.
기존 /plan을 critique하고, 중요한 문제를 좁혀 polish/onboard 지침으로 개선해.
브랜드를 전면 교체하는 작업이 아니라 K팝 팬의 실제 여행 준비 경험을 개선하는 작업이다.
팬들이 서류를 작성하는 느낌보다 여행을 기대하며 선택하는 느낌이 들게 하되,
모바일 가독성, 키보드 접근, 진행 단계, 빈 상태, 오류 안내를 우선해.

수정 범위: src/components/trip-planner.tsx, artist-picker.tsx,
필요한 UI 컴포넌트, src/styles/theme.css, UI 검증용 e2e와 T-014 작업 기록.
색/크기는 theme.css 토큰으로 관리하고 제품 UI는 영어를 유지해.
변경 금지: scripts/catalog/**, supabase/**, src/lib/trip/**, .env*, 수집 원본.
아티스트 ID, 데이터 계약, 자동 일정 계산, 저장/복원/삭제 동작을 유지해.
가짜 행사, 미확인 운영시간, 무단 아티스트 이미지, 허위 후기·수치로 화면을 채우지 마.
데이터가 없으면 솔직한 빈 상태와 다음 행동을 제공해.

작업 전후 모바일390/태블릿768/데스크톱1440 캡처를 직접 확인해.
Next.js 관련 코드 변경 전 설치된 next/dist/docs의 관련 문서를 읽어.
lint/typecheck 및 관련 E2E를 실행하고, 작업 기록·커밋·즉시 push·PR·셀프 리뷰까지 수행해.
Codex 담당 파일 변경이 필요하면 직접 수정하지 말고 요청 사항을 남겨.
main 머지와 배포는 통합 검증 단계에서 진행한다.
```

Claude PR이 준비되면 Codex에게 URL을 전달한다. 통합 시 데이터 변경과 UI 변경을 함께 검증하고 작업 브랜치의 전체 의존 PR을 확인한다. 이 분담은 Claude 모델을 Codex의 내부 하위 에이전트로 실행하는 방식이 아니라 별도의 Claude 세션을 사용하는 방식이다.
