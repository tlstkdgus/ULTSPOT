import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * 글자 토큰 × 배경 토큰 대비 (T-060). 작은 글씨도 WCAG AA 4.5:1을 넘어야 한다.
 * text-faint가 3.7~3.9:1로 25곳에서 미달이었다(impeccable 감사 T-055). 토큰 값을 바꾸면 여기서 막힌다.
 */
const css = readFileSync("src/styles/theme.css", "utf8");
const raw = (name: string): string => {
  const value = css.match(new RegExp(`--color-${name}:\s*([^;]+);`))?.[1].trim();
  if (!value) throw new Error(`token ${name} not found`);
  const ref = value.match(/^var\(--color-([\w-]+)\)$/);
  return ref ? raw(ref[1]) : value;
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const fg of ["text", "text-muted", "text-faint"])
  for (const bg of ["bg", "bg-soft", "surface", "surface-2"])
    test(`${fg} on ${bg} is at least 4.5:1`, () => {
      expect(ratio(raw(fg), raw(bg))).toBeGreaterThanOrEqual(4.5);
    });
