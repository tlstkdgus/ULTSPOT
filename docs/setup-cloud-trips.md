# 비회원 클라우드 저장 연결

키 값은 채팅·커밋·PR에 넣지 않는다. 사용자 설정 후 T-007에서 실제 API 인증·저장·사용자 격리와 로컬 앱 화면 저장을 검증했다. 로컬 `.env.local`의 클라우드 플래그는 true이며 gitignore 대상이다. Vercel 환경 변수·프로덕션 활성화는 별개이고 아직 수행하지 않았다.

1. Supabase 프로젝트의 URL과 publishable key를 `.env.local` 및 Vercel 환경 변수에 등록한다. 변수명은 `.env.example` 참조. `service_role`/secret key는 이 기능에 사용하지 않는다.
2. SQL Editor에서 `supabase/migrations/202609190001_guest_trips.sql`을 1회 적용하거나 팀 migration 경로로 실행한다.
3. Auth 설정에서 Anonymous Sign-Ins를 활성화한다. 기존 프로젝트의 다른 `authenticated` 정책도 익명 사용자에게 노출되지 않는지 점검한다. [Supabase 공식 안내](https://supabase.com/docs/guides/auth/auth-anonymous).
4. 프리뷰에서 `NEXT_PUBLIC_ENABLE_CLOUD_TRIPS=true`로 빌드한다. 사용량 제한·봇 방어와 보존/삭제 정책·운영 고지를 먼저 준비한다. 플래그 false 상태에서는 익명 계정을 자동 생성하지 않는다.
5. 별도 브라우저 A/B로 각각 저장한다. A가 B의 `owner_id`로 select/update/delete/insert를 시도해 차단되는지 확인한다. 미인증 요청도 차단돼야 한다. 자기 저장/복원/갱신/삭제, 세션 만료/네트워크 실패를 검증한다.
6. 검증 후에만 프로덕션 플래그를 활성화하고 다시 빌드한다. 클라우드 검증 전에도 실제 장소 탐색·일정 계산·기기 저장·다운로드는 동작한다.

이 설정은 팬 이벤트 API나 AI를 연결하지 않는다. X·TourAPI·AI 계정 준비 여부는 별도로 확인해야 한다.

## 실제 화면 검증 재실행

클라우드 플래그를 켜고 프로덕션 빌드를 새로 만든 뒤 실행한다. `NEXT_PUBLIC_` 값은 빌드 시 반영되므로 기존 서버 재사용에 주의한다. T-007 로컬 서버는 `http://127.0.0.1:3107/plan`이다.

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:3107'
$env:E2E_LIVE_CLOUD='true'
pnpm exec playwright test e2e/cloud-storage.spec.ts --workers=1
```

이 테스트는 실제 익명 Auth 사용자를 화면 크기당 1개 생성하므로 명시적 opt-in이다. 일반 E2E에서는 건너뛴다. 토큰이 담길 수 있는 trace/video/자동 실패 스크린샷은 끈다. 성공·실패 모두 finally에서 일정 삭제 후 재조회하며 Auth 계정 삭제는 관리자 권한이 없어 수행하지 않는다. 테스트 실패 시 정리 결과도 확인한다. T-007 화면 테스트 두 번으로 익명 계정 6개가 생성됐고 일정은 모두 삭제 확인했다. 앞선 API 검증의 계정 2개도 별도로 남아 있다. 계정 정리는 관리자 화면에서 테스트 계정임을 확인한 후 수행한다.

프로덕션 전 남은 작업: Vercel 설정·재빌드, 보존/삭제 운영과 개인정보 고지, 봇 방어·사용량 제한, 기존 프로젝트의 다른 RLS 정책 확인. 이번 검증 범위는 guest_trips이며 다른 테이블 권한이나 운영 준비 전체를 보증하지 않는다.
