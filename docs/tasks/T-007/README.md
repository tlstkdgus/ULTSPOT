# T-007 실제 클라우드 저장 화면 검증

| | |
|---|---|
| 상태 | 로컬 실연동 검증 완료, 프로덕션 활성화 대기 |
| 브랜치 | `test/T-007-cloud-storage-validation` |
| PR | 생성 예정, T-006 기반 |
| 근거 | 사용자가 Supabase 설정 후 앱 화면 검증 진행을 요청 |

## 변경과 결정

로컬 환경의 클라우드 플래그를 켜고 프로덕션 빌드로 검증했다. 실제 Supabase를 사용하는 E2E는 명시적 E2E_LIVE_CLOUD=true일 때만 실행한다. 비밀 토큰이 포함될 수 있는 네트워크 trace는 남기지 않는다. 앱 코드·UI 자체의 변경은 없고 기존 조건부 저장 UI를 활성화했다.

## 검증

- 앞선 API 검증 12개 통과: 익명 인증, 저장·조회·수정, 다른 사용자의 조회·수정·삭제·upsert 차단, 미인증 조회 차단. 일정 2개 삭제 후 부재 확인.
- 화면 E2E 3개 통과: mobile/tablet/desktop 각각 저장 → 새로고침 → 복원 → 수정 저장 → 복원 → 네트워크 실패 시 입력 유지 → 삭제 → 빈 저장 확인.
- 첫 화면 실행은 네트워크 실패 안내 대기 5초가 SDK 재시도보다 짧아 3개 실패. 25초로 조정한 뒤 3개 통과. 첫 실행과 재실행 모두 finally 삭제·부재 확인은 성공했다.
- 새 프로덕션 build 성공, lint/typecheck 오류 0건. 회귀 E2E 30개 통과·라이브 opt-in 3개 건너뜀. .env.local gitignore 확인.
- 복원 완료 화면 3장 직접 열어 확인. UI 소스 변경은 없어 before 캡처는 추가하지 않았다. 캡처는 테스트의 CAPTURE_TASK=T-007 옵션으로 생성했다.
- 이번 화면 검증의 익명 Auth 계정 6개는 남아 있다. 일정 데이터는 삭제됐다. service_role 키는 사용하지 않았다.

## 스크린샷

| 상태 | mobile | tablet | desktop |
|---|---|---|---|
| 클라우드 복원 완료 | [보기](screenshots/cloud-restored-mobile.png) | [보기](screenshots/cloud-restored-tablet.png) | [보기](screenshots/cloud-restored-desktop.png) |

## 하지 않은 것과 후속 작업

main 병합·Vercel 설정·배포·프로덕션 활성화, 관리자 Auth 계정 삭제, 다른 테이블 RLS 감사는 수행하지 않았다. 보존/삭제 운영·고지·봇 방어와 사용량 제한을 갖춘 뒤 배포 환경을 별도로 검증한다. 아티스트·행사 DB 반입은 T-006의 후속 범위다.
