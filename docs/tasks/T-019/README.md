# T-019 · 필수 행사·구간 이동시간 경로 검증

- 목표: 꼭 가고 싶은 행사를 방문 개수 최적화가 제거하지 않도록 별도 계산 모듈 구축.
- 범위: 새 routing/feasibility.ts와 순수 단위 테스트, [통합 계약](../../specs/route-feasibility.md).
- 동시 작업 보호: T-018 Kiro 데이터 파일, Claude UI, 원래 폴더 미커밋 UI를 수정하지 않음. 별도 worktree.
- 하지 않은 것: 지도/대중교통 API 실연동, OpenAI, 예산 최적화, UI 교체·캡처, 배포. 외부 자료 검증과 어댑터 연결은 후속.
- 검증: 순수 단위 테스트 4건 통과. 최초 typecheck는 새 worktree의 LayoutProps 생성 타입 미존재로 실패, next typegen 후 오류 0. 브라우저/E2E와 실제 API 검증은 실행하지 않음.
- lint 전체 검사 오류 0. 이후 상태 재확인: Kiro 2a86c5e에서 데이터 통합·PR #22 기록, Claude a7230d5에서 main 병합 확인. UI 연결은 별도 진행 상태다.
