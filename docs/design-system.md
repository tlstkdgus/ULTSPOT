# 디자인 시스템

원천: **ULTSPOT Brand & Design Guide v1.0** (2026.09, Candidate 4: Neon Lime × Sunset Orange).
화면으로 확인: `pnpm dev` → [`/design-system`](http://localhost:3000/design-system)

---

## 토큰은 어디에 있나

| 파일 | 역할 |
|------|------|
| `src/styles/theme.css` | **단일 원천.** Tailwind 4 `@theme` — 여기 적은 변수가 클래스가 된다 |
| `src/design-system/tokens.ts` | JS 사본. canvas, `<meta name="theme-color">`, OG 이미지처럼 클래스를 못 쓰는 곳만 |
| `e2e/tokens.spec.ts` | 두 파일의 색 값이 같은지 검사. 한쪽만 바꾸면 `pnpm test:e2e`가 실패한다 |

토큰을 추가하면 `theme.css` → (JS에서 필요하면) `tokens.ts` + `cssVarOf` → 커스텀 text/radius 스케일이면 `src/lib/cn.ts`의 tailwind-merge 설정까지 같이 고친다.

## 색

| 역할 | 클래스 | 값 | 규칙 |
|------|--------|-----|------|
| Primary | `bg-lime` `text-lime` | `#D6FF3F` | **화면당 핵심 액션 1곳** — CTA, 활성 탭, 매칭 결과 숫자 |
| Primary 위 글자 | `text-lime-ink` | `#1D2400` | 라임 면 위 텍스트는 항상 이것 |
| Accent | `bg-orange` | `#FF7A33` | 뱃지·태그 같은 **작은 면적**만 |
| 배경 | `bg-bg` (= ink-900) | `#100E0C` | 항상 다크. 라이트 모드 없음 |
| 표면 | `bg-surface` `bg-surface-2` | `#1E1913` `#282119` | 카드·시트 |
| 선 | `border-line` `border-line-strong` | `#38302640` `#4A4034` | 카드 구분은 그림자 대신 1px 선 |
| 글자 | `text-text` `text-text-muted` `text-text-faint` | `#FBF4E7` `#B9AFA0` `#7C7266` | 순백 대신 크림 |
| 상태 | `bg-success` `bg-warning` `bg-danger` | `#39D98A` `#FFC53D` `#FF5D6C` | 진행중 / 마감임박 / 마감. **상태에 브랜드 색 금지** |

**Tailwind 기본 팔레트는 꺼져 있다** (`--color-*: initial`). `bg-pink-500`, `text-blue-600` 같은 클래스는 아무 스타일도 만들지 않는다.
경쟁 서비스(덕플레이스·Trazy·K-POP Radar는 핑크·레드, Visit Seoul·NOL World는 블루)와 겹치는 색을 강조색으로 끌어오지 않는다는 가이드 규칙을 코드 단계에서 막기 위해서다.

## 타이포

| 클래스 | 서체 | 크기 | 용도 |
|--------|------|------|------|
| `text-hero` | Unbounded 900 | clamp 52→132px | 랜딩 헤드라인 |
| `text-display` | Unbounded 900 | clamp 40→56px | 큰 숫자(D-DAY, 매칭 개수) |
| `text-title` | Unbounded 800 | clamp 26→36px | 섹션 제목 |
| `text-heading` | Unbounded 800 | clamp 22→34px | 화면 제목 |
| `text-subhead` | Pretendard 700 | 20px | 소제목 |
| `text-body` / `text-body-sm` | Pretendard 400 | 16 / 14px | 본문 |
| `text-label` | Pretendard 700 | 13.5px | 버튼·칩 |
| `text-caption` | Pretendard 500 | 12.5px, 자간 .04em | 메타 정보 |
| `text-eyebrow` | Pretendard 700 | 12.5px, 자간 .14em, 대문자 | 섹션 라벨 |

- `h1`~`h3`는 기본으로 `font-display`(Unbounded). Unbounded에는 한글이 없어 한글은 Pretendard로 폴백된다.
- 제목 스케일에 굵기가 들어 있어 `font-*`를 따로 붙이지 않아도 된다.
- 본문은 `word-break: keep-all` — 한글이 어절 단위로 줄바꿈된다.

## 라운드

`rounded-xs` 7 · `rounded-sm` 12 · `rounded-md` 14(버튼) · `rounded-lg` 18 · `rounded-xl` 20(카드) · `rounded-full`(칩·뱃지) · `rounded-device` 36

## 컴포넌트

```tsx
import { Button, buttonStyles, Badge, Chip, DateChip, Card, AvatarStack, Eyebrow } from "@/components/ui";
import { Wordmark, SpotPin, DotField, DotLoader } from "@/components/brand";
```

| 컴포넌트 | 메모 |
|----------|------|
| `Button` | `variant: primary | ghost`, `size: sm | md | lg`, `block`. 링크에는 `buttonStyles()`를 `className`으로 |
| `Badge` | `tone: ongoing | closing | closed`는 **이벤트 상태 전용**, `accent`(오렌지)는 상태가 아닌 태그용 |
| `Chip` / `DateChip` | 선택 상태는 `aria-pressed`로 노출된다 |
| `Card` | Surface + 1px 선. 그림자 없음 |
| `AvatarStack` | 라임→오렌지 그라디언트는 **"관심 있는 팬" 표시 전용**. 다른 곳에 재사용하지 않는다 |
| `DotField` | seed 고정 도트 캔버스. `colors`에는 `dotPalette.*` 같은 **모듈 상수**를 넘긴다 (인라인 배열이면 렌더마다 다시 그림) |
| `DotLoader` | 도트 로딩 인디케이터. `prefers-reduced-motion`이면 멈춘다 |

클래스를 합칠 때는 `cn()`(`@/lib/cn`)을 쓴다. 뒤에 온 클래스가 이긴다.

## Do & Don't

| Do | Don't |
|----|-------|
| 라임은 화면당 핵심 액션 1곳 | 라임과 오렌지를 한 요소에 동시에 칠하기 |
| 오렌지는 뱃지·태그 등 작은 면적 | 밝은 배경 위에 라임 그대로 쓰기 |
| 배경은 항상 Ink 계열 | 상태 뱃지에 브랜드 색 쓰기 |
| 도트 모티프는 지도·로딩·빈 상태에 | 핫핑크·레드·블루를 강조색으로 쓰기 |

## 브랜드 가이드와 다르게 구현한 곳

| 항목 | 가이드 | 구현 | 이유 |
|------|--------|------|------|
| 목업의 "Ongoing" 뱃지 | 오렌지 | 초록(`tone="ongoing"`) | 같은 가이드 Status Badge 설명·Don't 규칙과 충돌해 규칙을 따름 |
| Pretendard 로딩 | 단일 woff2 | dynamic subset CSS | 단일 파일 2MB — 모바일 첫 로드 비용 |
