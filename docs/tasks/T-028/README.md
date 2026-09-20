# T-028 여러 날 일정·저장

- 브랜치: feat/T-028-multi-day-storage, 기준 PR #34
- 완료: 다일 모델·날짜/방문 편집·시간 검증·v1 변환·로컬 저장·클라우드 어댑터·전용 테이블 마이그레이션.
- 계약: [journey-storage](../../specs/journey-storage.md)
- 하지 않은 것: Claude UI, Kiro 지도 코드 수정, 실제 DB 적용, 배포.
- 검증: 데이터 테스트와 PGlite RLS/버전/크기 검사, 클라우드 mock 저장·복원·삭제. 최종 숫자는 PR에 기록.
- 최종 검증: test:data 30/30(신규 12), ESLint 0 오류, Next typegen 및 tsc --noEmit 성공. UI 미변경으로 캡처 해당 없음.
