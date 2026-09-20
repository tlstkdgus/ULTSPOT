# Claude 단독 진행 인수인계 · 2026-09-21

사용자 요청: Kiro 크레딧 소진으로 Codex가 T-029 충돌을 해결하고 이후 작업을 Claude에게 넘긴다. 이 문서는 코드에서 확인한 상태와 아직 검증하지 않은 상태를 구분한다.

## 현재 브랜치와 작업 소유권
- Kiro: C:/Users/tlstk/Desktop/ULTSPOT-kiro, feat/T-029-full-ux. 3f6a338에 체크인·가계부·발자취 기능이 커밋되어 있다. 원격 변경 63f798e와 병합 중 e2e/journey-ui.spec.ts에서 멈췄다.
- Codex: 충돌에서 회귀 테스트는 보존하고 중복 fixTravelLookups 구현은 제거해 e2e/flow.ts 공통 fixture를 사용한다. journey-planner의 요청 취소/빈 구간 초기화 변경도 보존한다.
- Claude: C:/Users/tlstk/Desktop/ULTSPOT-claude-visual. 제출 캡처와 e2e/cover.spec.ts 미커밋 변경이 있으므로 덮어쓰지 말 것.
- main 확인 시점: 15ab7c9. PR #48 이미지와 PR #49 카카오 지도 UI가 이미 머지됐다. 새로 같은 기능을 만들지 않는다.

## 가장 먼저 할 일
1. T-029 PR의 체크인/가계부/발자취 변경을 최신 main과 통합한다. main 파일 전체를 Kiro 버전으로 덮지 않는다. 특히 journey-planner/trip-planner/messages/flow.ts의 새 UI와 새 기능을 모두 보존한다.
2. 통합 후 pnpm lint, pnpm typecheck, pnpm test:data, records.spec.ts, records-ui.spec.ts, journey-ui.spec.ts를 실행한다. 언어별 문구와 캘린더 내보내기도 확인한다.
3. 390/768/1440에서 저장→새로고침→복원→삭제, 날짜 이동/기간 단축, 체크인 취소, 지출 추가·삭제, 발자취 이미지 내보내기를 확인한다. UI 변경 시 pnpm capture와 직접 이미지 검토.
4. main 머지 후 Vercel 배포 상태 확인 및 pnpm check:prod https://ultspot.vercel.app. 로컬 통과를 배포 통과로 보고하지 않는다.

## 기능 현황과 남은 검증
- N박 N일: 기간, Day 탭, 방문 배치·이동·순서 변경·미배정 목록이 있다. 기간 단축 시 방문을 잃지 않는지 확인.
- 체크인: 사용자가 방문 표시하는 기능이다. GPS/현장 인증이나 포인트 지급으로 표현하지 않는다.
- 가계부: 원화 지출 및 일별/장소별 집계. 합계와 저장 복원 검증. 실제 결제·환율 서비스가 아니다.
- 발자취: 표시한 방문과 지출에서 카드 생성. 계획만 한 장소를 방문으로 세지 않고 이동거리도 추정하지 않는다.
- Supabase: guest_trips/guest_journeys 및 onsite migration 파일 존재와 운영 DB 적용은 별개다. 운영 DB 적용 상태, anonymous auth, 서로 다른 사용자 RLS, 실제 클라우드 저장/복원을 검증. 초기화/테이블 삭제 금지.
- 카카오 지도: main에 423c1fc로 JS 지도 추가. NEXT_PUBLIC_KAKAO_JS_KEY는 Claude .env.local에 존재 확인. Vercel 등록·허용 도메인·실제 지도 로드 여부는 미검증. KAKAO_REST_API_KEY는 서버 전용 별도 키. 공개 JS 키를 제외한 키를 브라우저로 보내지 않는다.
- 주변 추천: 서버의 실제 제공자와 실패 fallback을 확인. 카카오 장소 검색과 이동시간은 별개 호출이다. 경로 결과 없는 경우 실제 도보/대중교통 시간처럼 홍보하지 않는다.
- Jev: TYPESAFE_API_KEY 서버 설정과 실제 호출/fallback을 확인. 합성 평가 점수를 실제 여행 최적성이나 전체 정확도로 표현하지 않는다. OpenAI는 연동 코드와 운영 호출이 확인된 경우에만 구현됐다고 설명.
- 다국어: 영어 기본/fallback과 사용자 선택 유지, 한국어·일본어·중국어 흐름을 확인. 없는 데이터 번역을 검수 완료로 표시하지 않는다.

## 데이터와 이미지
- PR #48 main 반영: 팬 생일카페 3개, 수집본 상태 표시, 주최 X 링크, 한국어 설명, 사용자 제공 이미지 6개. 원본 파일은 public/images, 키 없음.
- 포스터 3개 및 HiKR 로고는 contain, 장소 사진 2개는 cover, 클릭 시 원본. 최애 미연결 경민 행사는 전체 탐색에서만 표시.
- 행사 운영시간 미확인으로 자동 편성 불가. 핵심 미완료는 행사별 실제 시간/예약/좌표 확보다. 방문 날짜를 미래로 바꾸거나 미확인 값을 채우지 않는다.
- .local-data/incoming/perplexity-20260920-01~04에 원본/검토/매핑 자료. 원본은 보존하고 날짜·지점·ID 대조. 팬 주최 자체는 배제 사유가 아니다.
- 현재 서비스 카탈로그/이미지 매핑과 intake DB는 별개다. 원본 조사 JSON을 그대로 public DB에 업로드하지 않는다.
- 장소별 커뮤니티, 리워드, 예약·결제, 운영자 게시 도구는 구현 확인 없이 완료로 쓰지 않는다. 제출 직전에는 핵심 플로우 안정화보다 우선하지 않는다.

## 전달 기준
완료/로컬 검증/배포 검증/미확인을 구분해 보고한다. 코드·환경 변수·DB·스크린샷 변경을 각각 적고, 커밋 즉시 push와 PR을 유지한다. 기존 main 및 다른 작업자의 미커밋 변경을 보존한다.

## 저장 계약 보완
현장 기록도 기존 기기 저장/복원 버튼을 사용한다. 자동 저장·자동 복원은 현재 미구현이다. Codex가 records-ui 테스트를 이 계약에 맞췄으며 원본 Kiro 테스트의 가짜 다운로드 검사를 파일 크기 검사로 변경했다. 자동 저장이 필요하면 별도 동작 변경 및 오류 안내를 구현해야 한다.

## Codex 최종 검증
기록 데이터 24건, 여정 UI 24건, 현장 기록 UI 30건 통과. typecheck 및 변경 테스트 파일 ESLint 통과. 처음 실행에서 저장 계약/선택자 오류가 있었고 수정 후 재검증했다. 최신 main 통합과 프로덕션 검증은 아직 남았다.

## 이어받을 PR
PR #50: https://github.com/tlstkdgus/ULTSPOT/pull/50 (40de799). Kiro 폴더의 진행 중 병합은 해결했다. GitHub에서 최신 main과는 CONFLICTING 상태를 확인했다. Claude가 현재 UI 변경을 보존하면서 #50을 통합하는 것이 다음 최우선 작업이다.
