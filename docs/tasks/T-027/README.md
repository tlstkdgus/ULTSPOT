# T-027 일본어·중국어 장소 데이터 계약

- 브랜치: feat/T-027-localized-place-data (T-026은 Claude 사용 중)
- 근거: PR #33. UI는 Claude, 데이터 계약은 Codex.
- 산출물: docs/specs/localized-place-data.md, 선택 번역 필드, 출처/검수상태, 개인 초안 차단, 분리된 AI 번역 초안.
- 검증: test:data 18/18, 새 회귀 테스트 5개. 린트·타입 검사 결과는 PR에 기록.
- 미완료: 원어민 번역 검수·화면 연결·배포. 여러 날 일정은 별도 구현 대상이며 계약 문서를 함께 기록한다.
- PR: [#34](https://github.com/tlstkdgus/ULTSPOT/pull/34). ESLint 0 오류, Next typegen/tsc 성공, 전체 diff 검토 완료.
