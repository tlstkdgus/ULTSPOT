# T-009 수집 파일 검증과 비공개 DB 적재

| 항목 | 내용 |
|---|---|
| 상태 | 로컬 구현·검증, 원격 migration 적용 대기 |
| 브랜치 | `feat/T-009-catalog-intake` |
| PR | [#10](https://github.com/tlstkdgus/ULTSPOT/pull/10) |
| 기간 | 2026-09-19 |
| 근거 | T-006 다중 아티스트 계약·수집 요청서 |

## 목표·결정

수집팀 CSV·JSON을 검증하고 원본 필드를 유지한 채 비공개 DB 적재 SQL을 생성한다. `.local-data/incoming/`을 전달 위치로 정하고 Git에서 제외했다. 형식 검증을 사실·권리 승인으로 취급하지 않는다.

10개 탭·참조·날짜·시간·일부 enum·관계 순환을 검사한다. batch+SHA256 키로 같은 내용의 중복 적재를 막고 수정 자료는 새 버전으로 보관한다. 사람 검수는 정확한 버전에 연결되며 공개 상태를 만들지 않는다. SQL 페이로드는 base64로 인코딩하고 DB에서도 SHA256을 대조한다.

PGlite를 개발 의존성으로 추가해 실제 PostgreSQL에서 DDL·권한·SQL 문자열 처리를 검증했다. csv-parse로 인용부호·줄바꿈·BOM CSV를 처리한다. 앱 런타임에 두 의존성을 사용하지 않는다.

## 검증

- `pnpm test:data`: 8건 통과. DB 테스트 내 anon/authenticated/service_role 각 2개 테이블 접근 거부, 중복 저장·변경 버전·잘못된 digest·없는 버전 검수 거부 확인.
- `pnpm lint`, `pnpm typecheck`: 각각 종료 코드 0.
- `git check-ignore`: 수집 폴더 파일 제외 확인.
- UI 변경 없음: 캡처·E2E 재실행 없음. 원격 DB 적용·프로덕션 배포 없음.

## 하지 않은 것·다음 작업

실제 수집 파일은 아직 읽지 않았다. 엑셀·문서 자동 변환, 의미·권리 자동 승인, 공개 정규화 테이블, 아티스트 검색·플래너 연결은 포함하지 않는다. 실제 자료를 받은 뒤 변환·오류 정정·출처 검수를 거쳐 진행한다.

관리자는 migration 202609190002를 SQL Editor에 적용해야 한다. [적재 안내](../../data/intake.md)를 따른다. PR은 T-008 위에 쌓으며 main에는 직접 push하지 않는다.
