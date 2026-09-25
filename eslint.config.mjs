import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    // 외부 스킬(impeccable)이 번들로 가져온 브라우저 스크립트. 우리 코드가 아니라 고치지 않는다 —
    // 경고 94건 전부가 여기서 나왔다(T-072, 2026-09-25). 스킬을 갱신하면 다시 덮어쓴다.
    ".github/skills/**",
  ]),
]);

export default eslintConfig;
