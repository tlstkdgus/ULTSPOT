# 여러 날 일정·저장 구현 (T-028)

상태: 라이브러리·클라우드 어댑터·SQL 마이그레이션 구현. 화면 연결과 실제 DB 적용은 미실행. PR #34 위에 쌓은 작업이므로 먼저 #34를 병합한다.

## UI/Kiro 연결 계약

src/lib/trip/journey.ts:
- createJourney(startDate,endDate): 서울 날짜 기준 1~31일. 동일 날짜는 당일 여행. days.length-1은 표시용 숙박 수이며 숙박 예약 정보가 아니다.
- addCustomPlace: 식당/카페/관광 등 개인 장소(title,address,kind,note). custom- ID, 검수 메타데이터는 허용하지 않는다. 원문 보존. 공급자 검색 결과 승격용 API가 아니다.
- addVisit: placeId와 별도 visitId, 날짜 또는 null(미배정). 같은 장소의 여러 날 방문 허용. 여행 전체 방문 최대 100개.
- moveVisit/updateVisit/removeVisit: 날짜·순서·체류시간(5~720분)·고정시각 변경과 삭제. 원 객체를 변경하지 않는다.
- resizeJourney: 줄어든 날짜의 방문을 삭제하지 않고 미배정 목록으로 이동.
- scheduleJourneyDay: 사용자 순서를 보존하는 시간 검증. 날짜별 휴무·행사기간·예약·입장 마감·체류시간·고정시간 충돌을 반환. 미확인 이동은 null, 충돌 다음 방문으로 확정 시각을 전파하지 않는다. 이 함수는 최적화나 자동 날짜 배정이 아니다.
- travel(fromPlaceId,toPlaceId,date) 콜백에 Kiro의 known.minutes만 연결. unconfirmed.bufferMinutes를 실제 이동시간으로 전달하지 않는다. 날짜별 첫 방문은 현지 출발 기준이며 숙소→첫 장소, 마지막→숙소 계산은 추가 연결 대상이다.

각 방문은 arrival/departure와 issues를 함께 표시한다. 고정시각은 사용자 입력을 보존한 값이므로 issues가 있으면 실현 가능한 일정으로 표현하지 않는다. 개인 장소는 운영정보가 미확인이므로 시간 확정 없이 추가·저장할 수 있다.

## 저장과 구버전 보호

- local key: ultspot.journey.v2. guest_journeys는 guest_trips와 별개다. 구버전 화면의 저장/삭제가 새 여행에 영향을 주지 않는다.
- parseJourney(v1)는 검증된 하루 초안을 days[0]으로 변환하고 개인 행사·아티스트·방문시간·이동 여유시간을 보존한다. 새 입력의 출처/검수 필드 주입도 거부한다.
- loadJourneyLocally는 v2가 없을 때만 v1을 읽는다. v2가 손상됐으면 오류를 반환하고 예전 데이터로 조용히 대체하지 않는다. 기존 v1 키를 자동 삭제하지 않는다.
- 클라우드 구버전 가져오기는 기존 cloudTrip('load') 결과를 parseJourney에 넘기고 사용자가 새 여행을 저장하도록 연결한다. cloudJourney는 자동으로 기존 초안을 가져오거나 지우지 않는다.
- cloudJourney(save/load/delete)는 guest_journeys만 사용. save는 검증 후에만 익명 세션을 만들며 load/delete는 세션이 없으면 생성하지 않는다. 실패는 오류이며 성공으로 표시하지 않는다.
- 저장 전 JSON UTF-8 60,000바이트 제한. DB는 기존 원칙대로 jsonb 텍스트 65,536바이트 상한과 사용자별 RLS. JSONB 직렬화 차이로 DB가 추가 거부할 수 있으므로 저장 오류를 처리한다.
- 개인정보 삭제 UI는 구버전 데이터까지 지우려는 요청이라면 로컬 키 2개와 cloudTrip/delete, cloudJourney/delete를 모두 처리해야 한다. 새 여행 삭제만으로 구버전 데이터가 삭제된다고 표시하지 않는다.

## 배포 순서

1. 기존 guest_trips migration 뒤 202609200001_guest_journeys.sql 적용. 기존 테이블/정책 변경 없음. 새 테이블도 사용자당 1개 초안.
2. UI의 여행 기간/Day 탭/장소 추가를 이 계약에 연결. day.start/end/bufferMinutes를 날짜별 유지한다.
3. 실제 익명 계정으로 저장·복원·삭제, 날짜 변경 중 조회 취소, 3개 뷰포트 검증 후 배포.

아직 없는 것: 장소 검색 UI, 자동 날짜별 배정, 지도를 포함한 실제 브라우저 통합, 원격 DB 마이그레이션 실행. 현재 화면은 기존 하루 플래너를 유지한다.
