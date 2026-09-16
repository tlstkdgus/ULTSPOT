#!/usr/bin/env node
// 사용법: pnpm check:prod <배포 URL>
//   pnpm check:prod https://ultspot.vercel.app
// 배포된 주소를 시크릿 창과 같은 조건(빈 브라우저 컨텍스트)으로 3개 뷰포트에서 검사한다.
//   - 로그인·비밀번호 화면 없이 200으로 열리는지 (e2e/public-access.spec.ts)
//   - 가로 스크롤·런타임 에러 없는지 (e2e/smoke.spec.ts)
//   - 색 토큰이 배포본에도 그대로 나가는지 (e2e/tokens.spec.ts)
// 근거: docs/specs/submission-requirements.md
import { spawnSync } from "node:child_process";

const [raw] = process.argv.slice(2);

let url;
try {
  url = new URL(raw);
} catch {
  console.error("배포 URL이 필요합니다. 예: pnpm check:prod https://ultspot.vercel.app");
  process.exit(1);
}

if (url.protocol !== "https:") {
  console.error(`https 주소만 검사합니다: ${url.href}`);
  process.exit(1);
}

// <project>-<hash>-<scope>.vercel.app (배포별) / <project>-git-<branch>-<scope>.vercel.app (브랜치별)
// 이 두 형태는 계정 기본 보호 설정에서 vercel.com 로그인으로 리다이렉트된다.
// 2026-09-16 animal-league로 실측: 프로덕션 도메인 200, 배포별·브랜치별 주소 302 → vercel.com/sso-api
if (/^[a-z0-9-]+-([a-z0-9]{9}|git-[a-z0-9-]+)-[a-z0-9-]+\.vercel\.app$/.test(url.hostname)) {
  console.warn(
    `\n⚠ ${url.hostname} 은 배포별·브랜치별 주소로 보입니다. 심사자에게 로그인 화면이 뜰 수 있어 제출에는 프로덕션 도메인(예: ultspot.vercel.app)을 쓰세요.\n`,
  );
}

const result = spawnSync("pnpm", ["exec", "playwright", "test", "--grep-invert", "@capture"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, E2E_BASE_URL: url.origin },
});

process.exit(result.status ?? 1);
