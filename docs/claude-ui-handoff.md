# Claude · Impeccable UI 분담

Codex는 수집·검증·이미지 데이터 계약을 담당한다. Claude는 첫 화면과 `/plan`의 유저 플로우·언어·UI를 담당한다. 이 문서는 전달용이며 Codex가 Claude 세션에 직접 전송한 상태는 아니다.

## 최신 사용자 요구사항 · 기존 영어 유지 지침을 대체

- 첫 화면에서 'K팝 팬이 방문할 장소와 행사를 고르고 하루 일정을 만드는 서비스'임을 설명한다. 현재 없는 행사 추천·AI 기능이 이미 동작한다고 표현하지 않는다.
- 한국어를 기본으로 하고 한국어/English 선택을 첫 화면과 플래너에서 제공한다. 페이지 이동·새로고침에도 선택을 유지한다. 언어 변경으로 입력한 일정이 사라지면 안 된다.
- 제목뿐 아니라 버튼, 입력 라벨, 검증 오류, 빈 상태, 저장/복원 안내, 접근성 이름도 번역한다. 아티스트·행사 이름과 사용자 입력은 임의 기계 번역하지 않는다.
- 문서 작성처럼 보이는 흐름을 점검한다. 서비스 소개 → 날짜/시간 → 아티스트·장소 선택 → 일정 확인·저장 순서에서 각 단계의 목적과 다음 행동을 명확히 한다.
- 행사/장소 카드에서 이미지, 이름, 날짜·운영시간, 지역, 예약 필요 여부, 다음 행동을 빠르게 읽을 수 있게 한다. 출처·상세 조건은 펼쳐보기로 분리한다.
- 승인된 이미지가 없으면 '사진 준비 중' 상태를 명확히 표시한다. 포스터처럼 꾸민 임의 이미지나 장식 기호를 실제 행사 사진처럼 사용하지 않는다. 공식 원문 보기 경로를 제공한다.
- 이미지 수집 필드와 역할 분리는 [이미지 데이터 계약](data/image-data-contract.md)을 따른다. 실제 수집 assets는 아직 0건이다.

## 별도 작업 폴더 준비

새 Claude 작업을 시작할 때만 아래 명령을 사용한다. T-014는 Codex 데이터 작업이다. T-015가 사용 중이면 번호를 조정한다. 이미 Claude worktree/브랜치가 있다면 그대로 유지하고 최신 요구사항만 전달한다.

```powershell
git worktree add ..\ULTSPOT-claude -b design/T-015-planner-polish feat/T-014-image-data-contract
```

Claude에서 `C:\Users\tlstk\Desktop\ULTSPOT-claude`를 연다. 그 폴더에서 `pnpm install`한다. 원본 폴더의 `.github/skills/impeccable`은 현재 미추적 파일이라 worktree에 자동 포함되지 않는다. 같은 스킬을 새 폴더에 설치하거나 해당 폴더를 복사한다. `.env.local`은 복사 없이 시작할 수 있다. 클라우드 검증이 필요할 때만 별도로 로컬 설정하며 키를 프롬프트에 넣지 않는다. 개발 서버는 `pnpm dev --port 3200`을 사용한다.

## Claude에 전달할 프롬프트

```text
이 문서의 '최신 사용자 요구사항'을 모두 반영해 ULTSPOT 첫 화면과 /plan을 Impeccable로 개선해 줘.
현재 폴더는 Codex와 분리된 worktree여야 한다. 원본 ULTSPOT 폴더나 그 브랜치를 변경하지 마.
먼저 AGENTS.md, CONTRIBUTING.md, docs/design-system.md,
docs/specs/public-planner.md, docs/specs/user-flow.md, docs/specs/submission-requirements.md를 읽어.
설치된 .github/skills/impeccable/SKILL.md를 읽고 해당 지침대로 context를 로드해.
기존 /plan을 critique하고, 중요한 문제를 좁혀 polish/onboard 지침으로 개선해.
브랜드를 전면 교체하는 작업이 아니라 K팝 팬의 실제 여행 준비 경험을 개선하는 작업이다.
팬들이 서류를 작성하는 느낌보다 여행을 기대하며 선택하는 느낌이 들게 하되,
모바일 가독성, 키보드 접근, 진행 단계, 빈 상태, 오류 안내를 우선해.

수정 범위: src/app/page.tsx, layout.tsx, src/components/trip-planner.tsx, artist-picker.tsx,
필요한 UI 컴포넌트, src/styles/theme.css, 별도 번역 모듈, UI 검증용 e2e와 해당 태스크 기록.
색/크기는 theme.css 토큰으로 관리하고 한국어 기본과 한국어/English 선택을 구현해.
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
