import { expect, test } from "@playwright/test";
import { color, cssVarOf, type ColorToken } from "../src/design-system/tokens";

// theme.css 와 tokens.ts 는 같은 값을 두 번 적는다. 한쪽만 바꾸는 실수를 여기서 잡는다.
test("CSS 색 토큰과 tokens.ts 값이 일치한다", async ({ page }) => {
  await page.goto("/");

  const entries = Object.entries(cssVarOf) as [ColorToken, string][];
  const actual = await page.evaluate(
    (vars) => vars.map((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim().toLowerCase()),
    entries.map(([, cssVar]) => cssVar),
  );

  const mismatches = entries
    .map(([key, cssVar], i) => ({ key, cssVar, css: actual[i], ts: color[key] }))
    .filter((row) => row.css !== row.ts);

  expect(mismatches).toEqual([]);
});
