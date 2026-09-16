/**
 * CSS 토큰(src/styles/theme.css)의 JS 사본.
 * canvas 드로잉, OG 이미지, <meta name="theme-color">처럼 클래스로 색을 줄 수 없는 곳에서만 쓴다.
 * 값을 바꾸면 theme.css도 같이 바꿔야 하며, e2e/tokens.spec.ts가 둘의 일치를 검사한다.
 */
export const color = {
  lime: "#d6ff3f",
  limeDim: "#9fcc1e",
  limeInk: "#1d2400",
  orange: "#ff7a33",
  orangeDim: "#cc5a1e",
  orangeInk: "#2b1200",
  ink900: "#100e0c",
  ink800: "#17130f",
  ink700: "#1e1913",
  ink600: "#282119",
  ink500: "#4a4034",
  ink400: "#7c7266",
  ink300: "#b9afa0",
  ink100: "#fbf4e7",
  success: "#39d98a",
  warning: "#ffc53d",
  danger: "#ff5d6c",
} as const;

export type ColorToken = keyof typeof color;

/** theme.css 변수명 ↔ tokens.ts 키 매핑. 토큰 일치 테스트가 이 표를 순회한다. */
export const cssVarOf: Record<ColorToken, `--color-${string}`> = {
  lime: "--color-lime",
  limeDim: "--color-lime-dim",
  limeInk: "--color-lime-ink",
  orange: "--color-orange",
  orangeDim: "--color-orange-dim",
  orangeInk: "--color-orange-ink",
  ink900: "--color-ink-900",
  ink800: "--color-ink-800",
  ink700: "--color-ink-700",
  ink600: "--color-ink-600",
  ink500: "--color-ink-500",
  ink400: "--color-ink-400",
  ink300: "--color-ink-300",
  ink100: "--color-ink-100",
  success: "--color-success",
  warning: "--color-warning",
  danger: "--color-danger",
};

/** 도트 모티프 팔레트 — 가이드의 hero / motif 캔버스 설정 그대로 */
export const dotPalette = {
  hero: [color.lime, color.orange, color.ink100],
  motif: [color.lime, color.orange, color.ink100, color.ink500],
} as const;
