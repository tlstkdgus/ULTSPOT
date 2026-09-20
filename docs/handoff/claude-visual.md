# Claude 비주얼 인계 — 기준 목업에 맞추기 (T-029 병행)

사용자 결정: **기능 통합은 Kiro, 비주얼은 Claude.** 같은 파일을 동시에 고치지 않도록 아래 담당을 지킨다.

기준 브랜치는 `feat/T-029-full-ux`다. 여기에 T-027(다국어 장소 데이터)·T-028(다일 일정 모델)·T-025(카카오 경로·Jev 추천)이 이미 합쳐져 있다. `main`에는 T-028이 없으므로 main에서 새로 파지 않는다.

## 작업 폴더

```powershell
git fetch origin
git worktree add ..\ULTSPOT-claude-visual -b design/T-030-visual-alignment origin/feat/T-029-full-ux
```

`C:\Users\tlstk\Desktop\ULTSPOT-claude-visual`에서 `pnpm install`. 기존 `ULTSPOT-claude` 폴더는 `resolve/t024` 브랜치가 미푸시 커밋을 들고 있으니 **덮어쓰지 않는다.** `.env.local`은 없어도 화면 작업이 되고, 키가 없으면 이동시간이 전부 "미확인"으로 나오는 게 정상 동작이다. 태스크 번호는 `docs/tasks/README.md` 마지막 번호 + 1로 다시 확인한다(현재 T-029까지 사용).

## 기준 자료

- `C:\Users\tlstk\Desktop\ULTSPOT UX Flow.html` — 뷰어 껍데기. 실제 목업은 iframe으로 불러오는 아래 파일이다.
- `C:\Users\tlstk\Desktop\ULTSPOT UX Flow_files\saved_resource.html` — **실제 목업 전문.**
- `ULTSPOT UX Flow_files\download.png` — 홈 지도 배너, `download(1).png` — 발자취 공유 카드.
- 브랜드: 네온 라임 × 선셋 오렌지. 현재 토큰은 `src/styles/theme.css`에 있고 `docs/design-system.md`가 규칙이다.

## 담당 파일

| 담당 | 파일 |
|---|---|
| **Claude (비주얼)** | `src/styles/theme.css`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/home-intro.tsx`, `src/components/brand/**`, `src/components/ui/**`, `src/components/icons.tsx`, `src/app/design-system/page.tsx`, `docs/design-system.md` |
| **Kiro (기능)** | `src/components/trip-planner.tsx`, `favorite-step.tsx`, `spot-card.tsx`, `suggestion-panel.tsx`, `travel-leg.tsx`, `src/lib/**`, `src/app/api/**`, `src/i18n/**`, `e2e/**`, `scripts/**`, `supabase/**` |

Kiro 담당 파일의 **클래스 문자열만** 바꿔야 하는 변경이 있으면 직접 고치지 말고 이 문서 맨 아래 "Claude → Kiro 요청"에 적는다. 새 UI 프리미티브가 필요하면 `src/components/ui/`에 만들고 이름을 알려준다. Kiro가 호출부를 바꾼다.

## 지금 화면 구조 (T-029에서 바뀜)

`/plan`이 3단계에서 **4단계**로 바뀌었다. 기준 목업의 "날짜 우선이 아니라 최애 우선" 원칙을 따랐다.

| 단계 | 이름 | 내용 |
|---|---|---|
| 0 | 최애 고르기 | `favorite-step.tsx`. 그룹·멤버 검색, 이니셜 아바타, 고르지 않고 전체 둘러보기 가능 |
| 1 | 갈 곳 고르기 | 카테고리 필터(전체·생일카페·팝업·촬영지·명소·매장·맛집) + 검색 + 스팟 카드. 날짜 없이 탐색 |
| 2 | 기간 정하기 | 날짜, 시작·종료 시각, 속도, **관심사 칩 5종**, 이동수단 |
| 3 | 일정 받기 | 구간별 이동시간, 넣지 못한 곳, 주변 추천 패널 |

목업의 3단계 테마 테스트는 **사용자 요청으로 범위에서 빠졌다.** 그 자리에 관심사 칩이 들어갔다. 테마 테스트 화면을 만들지 않는다.

## 목업에서 그대로 따를 것

- **최애 우선 순서** — 이미 구현됨.
- **이니셜 아바타** — 목업의 "사진 대신 이니셜". 승인된 아티스트 사진이 0건이라 데이터 상황과도 맞다.
- 홈 지도 배너, 스팟 카드 레이아웃(이미지 자리 → 카테고리 → 이름 → 지역·기간·도보), Day 탭, 일정/가계부 탭, 충돌 감지 블록, 커뮤니티 피드 카드, 발자취 카드의 지표 3칸 구조.
- `SEOUL` 헤더, `FAN TRAVEL FOOTPRINT` 같은 브랜드 라벨.

## 목업에서 **쓰면 안 되는 것**

목업 문서가 스스로 "예시 숫자", "placeholder", "(예시)"라고 적은 값들이다. 화면에 넣으면 거짓 정보가 된다.

- 가짜 장소: `현진 아이스케이브 카페`, `SKZ 팝업스토어 · 성수`, `화보 촬영 카페거리`, `현진 픽 파스타`
- 가짜 수치: `32곳`, `홍대 12 / 성수 7 / 강남 9 / 건대 4`, `+80P`, `8.4km`, `480P`, `₩186,000`, `예산 62% 사용`, `친구 2명과 공유 중`
- 가짜 리뷰: `재이 / 3시간 전 / ❤ 24`, `민아 / 어제 / ❤ 11`
- `Best 3` 상한 강제 — 사용자 요청으로 "꼭 가고 싶은 곳"이며 3곳 제한을 걸지 않는다
- 발자취 `"[최애] 따라 N km"` — 검증된 거리 데이터가 없다. `최애 따라 N곳`처럼 확인 가능한 값만 쓴다

비주얼 톤을 보여주려면 목업 이미지를 **참고만** 하고, 화면에는 실제 상태(빈 상태·미확인)를 그린다.

## 반드시 유지할 정직한 상태 표현

지금 화면이 이 상태들을 구분해 보여주고 있다. 스타일을 바꾸되 **구분 자체를 없애면 안 된다.**

| 상태 | 현재 표현 | 지켜야 할 것 |
|---|---|---|
| 승인 이미지 0건 | 카드 썸네일 자리에 "사진 준비 중" | 장식 그래픽을 실제 사진처럼 보이게 하지 않는다. AI 생성 이미지를 행사·매장 사진으로 쓰지 않는다 |
| 이동시간 조회됨 | `대중교통 18분 · 환승 없음 · 오후 05:56 조회` | 조회 시각과 수단을 지운 채 분만 남기지 않는다 |
| 이동시간 미확인 | `이동시간 미확인 · 계획용 여유 45분` + 사유 + 직접 확인 링크 | **조회된 값과 같은 모양으로 만들지 않는다.** 색·아이콘으로 구분을 유지한다 |
| 조회 중 | "이동시간을 확인하는 중이에요…" | 진행 중을 확정 사유처럼 보이게 하지 않는다 |
| 운영시간 미확인 | 뱃지 + "자동 일정에는 들어가지 않아요" | |
| 주변 추천 | "영업시간 미확인 — 가기 전에 확인하세요", `일반 주변 장소 · 아이돌 관련 근거는 확인하지 않았어요` | 아이돌 근거 있는 장소와 일반 주변 추천의 구분을 유지한다 |
| 카테고리 0건 | 필터에 개수 `0`을 함께 표시 | 0인 분류를 숨기지 않는다. 검증된 3곳은 모두 `명소·매장`이고 생일카페·팝업·촬영지는 0건이다 |
| 취향 평가 미적용 | `거리순으로 정렬했어요 · <사유>` | 적용되지 않았는데 적용된 것처럼 쓰지 않는다 |

## 문구는 i18n에만

하드코딩한 한국어·영어를 JSX에 넣지 않는다. 4개 언어 사전이 같은 타입을 공유하므로 한쪽에 키가 빠지면 `pnpm typecheck`가 실패한다.

- `src/i18n/messages.ts` (en이 구조의 원천 + ko), `messages.ja.ts`, `messages.zh.ts`
- T-029에서 추가된 키 그룹: `favorite`, `categories`, `interests`, `travel`, `musts`, `suggest`, `notices.dateRechecked`
- 장소 이름·설명·주소·출처명·사용자 입력은 **번역하지 않는다.** `eventCopy(event, locale)`가 검수된 번역만 골라 주고 초안 번역은 영어로 떨어뜨린다.

문구를 새로 추가해야 하면 4개 locale 모두 채운다. 번역이 확실하지 않으면 Kiro에게 요청한다.

## 검증 (머지 조건)

```powershell
pnpm lint          # 0
pnpm typecheck     # 0
pnpm build
pnpm test:e2e      # 현재 desktop 55 통과 / 1 skip(클라우드 키 없음)
pnpm capture T-0NN # 3개 뷰포트, 직접 열어 확인
```

- `e2e/tokens.spec.ts`가 `theme.css` 토큰과 `src/design-system/tokens.ts` 값이 일치하는지 본다. 토큰을 바꾸면 양쪽을 같이 바꾼다.
- `e2e/smoke.spec.ts`가 가로 스크롤 없음을 본다. mobile 390에서 넘치지 않게 한다.
- `e2e/locale.spec.ts`·`planner.spec.ts`·`artists.spec.ts`는 **접근성 이름으로** 요소를 찾는다. 버튼 문구나 `aria-label`을 바꾸면 이 테스트들이 깨진다. 문구를 바꿔야 하면 `e2e/flow.ts`의 `stepLabels`도 같이 고친다.
- 기존 화면을 바꿨으면 `screenshots/before/`에 작업 전 캡처를 남긴다(CONTRIBUTING.md §4).

## 하지 않을 것

- 기능 동작 변경. 단계 순서, 저장 형식, 일정 계산, API 호출을 바꾸지 않는다.
- `src/lib/**`, `src/app/api/**`, `supabase/**` 수정.
- 목업의 예시 숫자·가짜 장소·가짜 리뷰를 화면에 넣기.
- 미구현 기능을 홍보 문구로 쓰기. 커뮤니티·체크인·포인트·가계부·공유·발자취는 아직 구현 전이다.

## Claude → Kiro 요청

Kiro 담당 파일에 필요한 변경을 여기 적는다.

### 새 UI 프리미티브 두 개 — 호출부 교체 요청 (T-032)

기준 목업의 조각이 Kiro 담당 파일에 인라인으로 들어가 있다. `src/components/ui/`에 만들어 뒀으니 호출부만 바꿔 달라. **동작은 바뀌지 않는다.**

| 새 컴포넌트 | 지금 인라인으로 있는 곳 | 목업 근거 |
|---|---|---|
| `PhotoPlaceholder` | `spot-card.tsx`의 `h-24 … bg-surface-2` 블록 | `.spot-photo` — 96px, 135° 그라디언트 |
| `Avatar` | `favorite-step.tsx:49`의 `size-12 rounded-full …` | `.bias-avatar` — 원, 2px 라인, 디스플레이 글꼴 |

```tsx
// spot-card.tsx — 사진 자리
<PhotoPlaceholder label={t.spots.photoPending} />

// favorite-step.tsx — 이니셜 아바타
<Avatar initials={initials(artist.id)} label={artist.korean ?? artist.name} />
```

`Badge`에 `tone="category"`(라임 알약)를 더했다. 목업의 `.spot-tag`에 해당하며, 카드 위 분류 라벨(생일카페·팝업)에 쓴다. 운영 상태 배지와 섞지 않는다.

`Card`의 반경·여백을 목업에 맞춰 바꿨다(20px→18px, 16px→20px). 호출부 변경은 필요 없다.

### 반영 완료 — `trip-planner.tsx` 단계 레일 격자 (T-032)

마감 당일 제출 이미지를 찍다가 발견해 클래스 문자열만 직접 고쳤다. 문서의 "직접 고치지 말 것" 규칙을 어긴 것이라 여기 남긴다.

- **무엇이 문제였나:** 단계가 3개에서 4개로 늘었는데 `<nav>`가 `grid-cols-3` 그대로였다. "일정 받기"만 아랫줄로 떨어지고 밑줄이 끊겨 보였다. 1280px·390px 양쪽에서 재현된다.
- **어떻게 바꿨나:** `grid-cols-3 gap-2 sm:gap-6` → `grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-6`. 390px에서 4칸은 한 칸이 90px도 안 돼 라벨이 접히므로 모바일은 2×2다.
- **동작 변경 없음.** 클래스 문자열만이다. E2E 213건 통과.

---

## Claude에 붙여넣을 프롬프트

```text
ULTSPOT의 비주얼을 기준 목업에 맞춰 개선해 줘. 기능은 Kiro가 담당하니 동작을 바꾸지 마.

먼저 읽어:
- docs/handoff/claude-visual.md  ← 담당 파일과 금지 사항이 여기 있다
- AGENTS.md, CONTRIBUTING.md, docs/design-system.md
- C:\Users\tlstk\Desktop\ULTSPOT UX Flow_files\saved_resource.html  ← 실제 목업 전문
- ULTSPOT UX Flow_files\download.png (홈 배너), download(1).png (발자취 카드)

작업 폴더:
git worktree add ..\ULTSPOT-claude-visual -b design/T-0NN-visual-alignment origin/feat/T-029-full-ux
그 폴더에서 pnpm install. 기존 ULTSPOT-claude 폴더는 건드리지 마.
T-0NN은 docs/tasks/README.md 마지막 번호 + 1로 정해.

범위: theme.css 토큰, 홈 화면, 브랜드/UI 컴포넌트, 아이콘, design-system 페이지.
네온 라임 × 선셋 오렌지 브랜드와 목업의 정보 위계를 따라.

절대 하지 말 것:
- 목업의 예시 숫자·가짜 장소·가짜 리뷰를 화면에 넣기
  (32곳, +80P, 8.4km, ₩186,000, 62% 사용, 재이/민아 후기 등 — 목업이 스스로 예시라고 적었다)
- "사진 준비 중", "이동시간 미확인", "영업시간 미확인", "거리순으로 정렬했어요",
  카테고리 0건 표시를 없애거나 조회된 값과 같은 모양으로 만들기
- 장식 그래픽이나 AI 생성 이미지를 실제 행사·매장 사진처럼 보이게 하기
- 단계 순서·저장 형식·일정 계산·API 호출 변경
- src/lib/**, src/app/api/**, supabase/** 수정
- JSX에 문구 하드코딩 (4개 언어 사전 messages.ts/ja/zh를 쓴다)

Next.js 코드를 고치기 전에 node_modules/next/dist/docs의 관련 문서를 읽어.
pnpm lint / typecheck / build / test:e2e를 돌리고, pnpm capture로 390·768·1440을
직접 열어 확인해. 기존 화면을 바꿨으면 before 캡처도 남겨.
작업 단위로 커밋·즉시 push하고 docs/tasks/T-0NN/README.md와 PR을 써.
Kiro 담당 파일 변경이 필요하면 직접 고치지 말고 claude-visual.md의
"Claude → Kiro 요청"에 적어.
```
