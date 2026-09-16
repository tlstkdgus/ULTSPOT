#!/usr/bin/env node
// 사용법: pnpm capture <TASK-ID> [route,route]
//   pnpm capture T-002                  → e2e/routes.ts 의 모든 화면을 3개 뷰포트로 캡처
//   pnpm capture T-002 home             → home 화면만
// 결과는 docs/tasks/<TASK-ID>/screenshots/ 에 쌓이고, 커밋·PR 본문에서 이 경로를 참조한다.
import { spawnSync } from "node:child_process";

const [taskId, routes] = process.argv.slice(2);

if (!taskId || !/^T-\d{3,}$/.test(taskId)) {
  console.error("TASK-ID가 필요합니다. 예: pnpm capture T-002");
  process.exit(1);
}

const result = spawnSync("pnpm", ["exec", "playwright", "test", "--grep", "@capture"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, CAPTURE_TASK: taskId, CAPTURE_ROUTES: routes ?? "" },
});

process.exit(result.status ?? 1);
