<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ULTSPOT 작업 규칙 (에이전트 포함 모든 작업자)

전체 규칙은 `CONTRIBUTING.md`. 매 작업에서 빠뜨리지 말 것:

1. 태스크 번호(`docs/tasks/README.md` 마지막 번호 + 1)를 정하고 `<type>/T-NNN-slug` 브랜치에서 작업한다. `main` 직접 push 금지.
2. 작업 단위마다 커밋하고 **바로 push**한다. 커밋 본문에는 왜 / 하지 않은 것 / 검증(숫자)을 쓴다.
3. UI를 바꿨으면 `pnpm capture T-NNN`으로 3개 뷰포트를 캡처해 커밋하고, 캡처를 직접 열어 확인한다.
4. 작업이 끝나면 `docs/tasks/T-NNN/README.md`를 쓰고 목록을 갱신한 뒤, `.github/pull_request_template.md` 양식으로 PR을 연다. 스크린샷은 커밋 SHA 고정 blob 링크로 건다.
5. 색·크기는 `src/styles/theme.css` 토큰만 쓴다 (기본 팔레트는 꺼져 있음). 규칙은 `docs/design-system.md`.
6. 대회 제출 요건(`docs/specs/submission-requirements.md`)을 어기는 설계를 하지 않는다: API 키는 서버에만, 설치·키 발급 없이 체험 가능, 제출 주소는 Vercel 프로덕션 도메인 `ultspot.vercel.app`. `main` 머지 후 `pnpm check:prod https://ultspot.vercel.app`. (앱 로그인 금지는 공지 요건이 아니라 팀 판단 — 문서의 구분을 지킨다)
