# 비회원 클라우드 저장 연결

키 값은 채팅·커밋·PR에 넣지 않는다. 로컬 `.env.local`은 빈 설정 템플릿으로 준비했으며 gitignore 대상임을 확인했다. 아직 키·원격 계정 접근 정보가 없어 migration을 실행하지 않았다.

1. Supabase 프로젝트의 URL과 publishable key를 `.env.local` 및 Vercel 환경 변수에 등록한다. 변수명은 `.env.example` 참조. `service_role`/secret key는 이 기능에 사용하지 않는다.
2. SQL Editor에서 `supabase/migrations/202609190001_guest_trips.sql`을 1회 적용하거나 팀 migration 경로로 실행한다.
3. Auth 설정에서 Anonymous Sign-Ins를 활성화한다. 기존 프로젝트의 다른 `authenticated` 정책도 익명 사용자에게 노출되지 않는지 점검한다. [Supabase 공식 안내](https://supabase.com/docs/guides/auth/auth-anonymous).
4. 프리뷰에서 `NEXT_PUBLIC_ENABLE_CLOUD_TRIPS=true`로 빌드한다. 사용량 제한·봇 방어와 보존/삭제 정책·운영 고지를 먼저 준비한다. 플래그 false 상태에서는 익명 계정을 자동 생성하지 않는다.
5. 별도 브라우저 A/B로 각각 저장한다. A가 B의 `owner_id`로 select/update/delete/insert를 시도해 차단되는지 확인한다. 미인증 요청도 차단돼야 한다. 자기 저장/복원/갱신/삭제, 세션 만료/네트워크 실패를 검증한다.
6. 검증 후에만 프로덕션 플래그를 활성화하고 다시 빌드한다. 클라우드 검증 전에도 실제 장소 탐색·일정 계산·기기 저장·다운로드는 동작한다.

이 설정은 팬 이벤트 API나 AI를 연결하지 않는다. X·TourAPI·AI 계정 준비 여부는 별도로 확인해야 한다.
