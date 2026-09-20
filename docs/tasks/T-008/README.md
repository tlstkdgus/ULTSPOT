# T-008 K팝 여행 온보딩 UI

| | |
|---|---|
| 상태 | 구현·검증, 리뷰 준비 |
| 브랜치 | `design/T-008-planner-onboarding` |
| PR | [#9](https://github.com/tlstkdgus/ULTSPOT/pull/9), T-007 기반 |
| 근거 | 사용자 요청: 서류 입력 같은 설정 화면을 K팝 팬 대상 온보딩으로 개선 |

## 목표와 변경

한 페이지에 나열되던 설정·목록·결과를 Your day → Your spots → Your setlist의 세 단계로 바꿨다. 날짜와 여행 페이스를 고르고 장소 카드를 모아 세트리스트 형태의 일정을 받는다. 레코드 그래픽·여행 패스·트랙 번호는 코드로 표현한 장식이며 아티스트 사진이나 실제 입장권이 아니다.

세부 시간 설정과 저장 관리를 접어두고 주요 행동을 단계마다 하나로 정리했다. 이전 단계 이동, 저장본 복원 시 결과 이동, 단계 제목 포커스, 선택 유지와 입력 변경 시 결과 무효화를 지원한다. 장소 출처·운영 조건·이동시간 한계 안내는 유지했다.

## 검증

- 프로덕션 build 성공. lint/typecheck 오류 0건.
- 첫 전체 E2E: 30 통과·3 실패·3 skip. 기존 수정 테스트가 첫 단계에서 두 번째 단계 이동 없이 생성 버튼을 찾던 문제. 테스트 흐름 수정 후 플래너 12개 통과. 미변경 나머지 21개는 첫 실행에서 통과했다.
- 단계별 캡처: 변경 전 6장, 변경 후 9장. `pnpm capture T-008 plan`으로 생성하고 15장 모두 직접 열어 확인했다.
- 실제 클라우드: 세 뷰포트 통과(태블릿·데스크톱 2개 + 모바일 재실행 1개). 최초 문구 수정 과정의 인코딩 문제로 3개 실패 후 수정. 이어 모바일 최초 저장 응답이 5초를 넘겨 1개 실패했고 저장 대기를 15초로 조정한 모바일 재검증이 통과했다. 일정은 finally에서 삭제·부재 확인했으며 익명 Auth 계정은 관리자 권한 없이 삭제하지 않았다.

## 결정과 하지 않은 것

브랜드 다크·크림·라임 토큰 유지. 권리가 없는 연예인 이미지나 연동되지 않은 최애 선택을 장식용으로 넣지 않았다. 아티스트 데이터·검색, 일정 엔진·DB 스키마 변경, 프로덕션 배포는 범위 밖이다. 새 브라우저 뒤로가기 히스토리 단계는 추가하지 않았으며 화면 내 Back/Edit와 단계 버튼으로 이동한다.

## 스크린샷

| 단계 | mobile | tablet | desktop |
|---|---|---|---|
| 날짜·페이스 | [보기](screenshots/plan-mobile.png) | [보기](screenshots/plan-tablet.png) | [보기](screenshots/plan-desktop.png) |
| 장소 선택 | [보기](screenshots/plan-spots-mobile.png) | [보기](screenshots/plan-spots-tablet.png) | [보기](screenshots/plan-spots-desktop.png) |
| 일정 | [보기](screenshots/plan-itinerary-mobile.png) | [보기](screenshots/plan-itinerary-tablet.png) | [보기](screenshots/plan-itinerary-desktop.png) |

변경 전은 screenshots/before/에 보존. 로컬 확인 주소: http://127.0.0.1:3108/plan.
