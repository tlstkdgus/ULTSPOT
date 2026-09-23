# T-046 · 공식 K팝 매장 3곳을 검증해 카탈로그에 넣는다

| | |
|---|---|
| 상태 | 리뷰 중 |
| 브랜치 | `feat/T-046-kpop-stores` (기준: `main` 3ec6ff2) |
| PR | 아래 참고 |
| 기간 | 2026-09-22 |
| 근거 | [수집 요청서](../../data/collection-brief.md) · [장소 데이터 확보 방안](../../data/place-data-sourcing.md) §1 "상설 장소: 수작업 큐레이션 + 출처 2개 이상 교차 확인" |

## 배경

사용자 요청(2026-09-22): "데이터가 많이 부족해. 수집해서 검증해서 넣어." 검수된 상설 장소가
3곳(하이커 그라운드·뮤직코리아·K-Star Road)뿐이었다.

생일카페는 [확보 방안](../../data/place-data-sourcing.md)대로 X API 경로인데 토큰이 없고, 덕플레이스·
팝가는 약관상 자동·수동 수집 모두 금지다. 지금 할 수 있는 것은 **공식 출처가 공개된 상설 장소**를
출처 2개 이상으로 교차 확인해 넣는 일이다. 기존 3곳이 정확히 이 방식으로 들어왔다.

## 넣은 것

| id | 장소 | 출처 1 | 출처 2 | 시간 | 좌표 |
|---|---|---|---|---|---|
| `ktown4u-coex` | 케이타운포유 코엑스 | [관광공사](https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=197348) — 주소, 층별 시간, "Open all year round", 무료 | [공식 매장 안내](https://www.ktown4u.com/stores) — 같은 주소·층별 시간, 삼성역 5·6번 출구 | **2F 11:00–20:00 확정**, 연중무휴 | 카카오 주소검색 → 역지오코딩 일치 |
| `kpop-square-hongdae` | 케이팝 스퀘어 홍대 | [관광공사](https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=199935) — 주소, 11:00~22:00, 전화 | [서울관광재단](https://english.visitseoul.net/shopping/K-popSQUARE/ENPet9p1i) — 11:00~22:00, 휴무 "Every day", 홍대입구 1번 출구 145m, **2026-09-03 수정** | **11:00–22:00 확정**, 연중무휴 | 일치 |
| `kwangya-seoul` | 광야@서울 | [관광공사(TourAPI)](https://place.tripmate.co.kr/ko/detail.php?contentId=2988778&contentTypeId=38) — 주소, 소개, 인스타그램 | [SM 뉴스룸](https://www.smentertainment.com/en/newsroom/sm-%ED%94%8C%EB%9E%98%EA%B7%B8%EC%8B%AD-%EC%8A%A4%ED%86%A0%EC%96%B4-%EA%B4%91%EC%95%BC%EC%84%9C%EC%9A%B8-11%EC%9B%94-17%EC%9D%BC-%EA%B0%9C%EA%B4%80/) — 2022-11-17 개관, 위치 | **미확인** | 일치 |

## 결정

- **광야@서울의 운영시간은 확정하지 않았다.** 10:30–20:00은 2022-11 개관 공지(SMTOWN &STORE X)와
  비공식 집계(heypop)에만 있고, 관광공사·SM 뉴스룸·SM 공식 스토어 사이트 어디에도 현행 시간이 없다.
  4년 전 공지를 오늘 시간으로 적으면 심사자가 닫힌 문 앞에 설 수 있다. K-Star Road와 같이
  `opens: null`로 두어 자동 편성에서 빠지고, 화면이 "운영시간 미확인"과 확인 방법을 말한다.
- **K-POP Square의 21:30 폐점 표기는 채택하지 않았다.** 검색 요약 한 곳에만 나왔고 출처 페이지를
  특정할 수 없었다. 관광공사와 서울관광재단이 22:00으로 일치한다.
- **transit 블록은 넣지 않았다.** 출처가 "145m", "5·6번 출구"까지만 말한다. `walk_minutes`는
  숫자가 필수인데 도보 분을 지어내면 안 된다. 출구 안내는 본문 문구로만 옮겼다.
- **kind는 기존 값만 썼다.** `Album shop`·`K-pop experience`는 [categories.ts](../../../src/lib/trip/categories.ts)가
  landmark로 매핑하는 값이다. 새 kind를 만들면 필터에서 other로 빠진다.
- **좌표 출처는 카카오다.** 주소를 카카오 주소검색으로 변환하고 역지오코딩해 세 건 모두 같은
  도로명이 돌아오는 것을 확인했다(T-041과 같은 절차). 사이드카는 `.local-data/geocode/t046-kpop-stores/`.

## 뺀 것과 이유

| 후보 | 이유 |
|---|---|
| HYBE INSIGHT | 관광공사 페이지엔 시간·요금이 있지만 [공식 사이트](https://hybeinsight.com)가 **2023-01-15 운영 종료**를 고지. 관광공사 정보가 낡았다 |
| 위드뮤 홍대 (WITHMUU) | 관광공사 개별 페이지를 찾지 못했다. 출처 1개로는 넣지 않는다 |
| 라인프렌즈 강남점 | 관광공사 페이지가 400으로 열리지 않았다 |
| JYP·SM·HYBE 사옥 | 관광공사 기사에 주소만 있고 운영시간·입장 정보가 없는 외관 촬영지. 방문 조건을 말할 수 없다 |
| 생일카페 신규 | X 토큰 없음. 덕플레이스·팝가 수집 금지 |

## 하지 않은 것

- **ja/zh 번역 초안** — 검수 없는 기계 번역을 넣지 않는다. 영어 fallback이 걸린다.
- **이미지** — 권리 확인된 사진이 없다. 카드는 "사진 준비 중" 자리표시자를 쓴다.
- **광야@서울 시간 확정** — 위 참조. 현행 공식 안내가 확인되면 한 줄로 채운다.

## 검증

- 데이터 테스트 **64건 통과 · 0 실패**
- typecheck 0, lint 오류 0
- E2E 전체 **335건 통과 · 3 skip · 1 실패** (390/768/1440). 실패 1건은 `fan-cafes` mobile의 포스터
  이미지 대기(원본 1.4~2.5MB PNG의 첫 최적화)로, 단독·5회 반복 전부 통과. 대기를 45초로 늘렸다.
- 스펙 3곳이 카탈로그 수에 묶여 있어 고쳤다: `planTrip`은 6곳을 넘으면 오류를 돌려주는데
  `planner.spec`·`preference.spec`이 카탈로그 전체를 넣고 있었다(9곳이 되자 stops 0). 검수 장소
  3곳으로 고정했다. `preference.spec`은 before/after가 둘 다 빈 결과여도 "같다"로 통과하던 것을
  stops > 0 조건으로 막았다.
- 캡처 `plan-spots` 3뷰포트를 직접 열어 확인: 새 카드 3장이 기존 카드와 같은 형식으로 나오고,
  광야@서울은 "운영시간 미확인 · 자동 일정에는 들어가지 않아요"가 붙는다. 이미지는 자리표시자.

| | mobile | tablet | desktop |
|---|---|---|---|
| SPOT 고르기 (9곳) | `plan-spots-mobile.png` | `plan-spots-tablet.png` | `plan-spots-desktop.png` |
