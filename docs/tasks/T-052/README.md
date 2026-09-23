# T-052 · Google 지도와 Google 장소 사진

| | |
|---|---|
| 상태 | 리뷰 중 (T-051 위에 쌓음). **키를 넣은 실동작 검증 전** |
| 브랜치 | `feat/T-052-google-maps` (기준: `feat/T-051-place-photos` d26b32d) |
| PR | 아래 참고 |
| 기간 | 2026-09-24 |
| 근거 | 사용자 요청(2026-09-24) "구글 지도 api도 붙이자" |

## 배경

관광공사 사진(T-051)은 관광공사에 등록된 곳에만 있다. 카카오에서만 나온 후보는 사진이 없다. Google Places는 장소
사진과 촬영자를 준다.

## 약관에서 설계로 옮긴 것

출처: [Places API 정책](https://developers.google.com/maps/documentation/places/web-service/policies),
[서비스별 약관](https://cloud.google.com/maps-platform/terms/maps-service-terms), [요금](https://developers.google.com/maps/billing-and-pricing/pricing) (2026-09-24 확인).

- **Places 콘텐츠를 비구글 지도와 함께 쓰지 않는다.** 그래서 Google 브라우저 키가 있으면 일정 화면의 지도를 Google로
  바꾸고, **Google 지도가 떠 있을 때만** Google 사진을 요청한다. 키가 없으면 지금처럼 카카오 지도이고 Google 사진을
  쓰지 않는다. 이 경계는 E2E로 고정했다(카카오 지도 화면에서 `/api/place-photo` 요청 0건).
- **저장·캐시하지 않는다.** 사진·사진 이름은 요청마다 받고 버린다. 라우트 응답은 `Cache-Control: no-store`.
- **촬영자 표기 필수.** 촬영자가 없는 사진은 싣지 않는다. 표기는 "사진: 촬영자 · Google Maps"(문구 변경 금지 규정대로
  모든 언어에서 "Google Maps" 그대로).
- **키를 브라우저로 보내지 않는다.** 사진 주소는 `skipHttpRedirect`로 받은 `photoUri`(키 없는 googleusercontent 주소).

## 결정

- 키를 **둘**로 나눈다. 서버 `GOOGLE_MAPS_API_KEY`(Places API (New)만), 브라우저 `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY`
  (Maps JavaScript API만, HTTP 리퍼러 제한). 카카오 REST/JS 키와 같은 구조다.
- 사진은 **관광공사 사진이 없는 빈 시간 추천 카드에서만** 요청한다. 주변 추천 목록에는 쓰지 않는다. 요청 한 번에
  Text Search(Pro) 1회 + Place Photo 1회라 비용이 카드 수에 비례한다.
- 이름으로 찾은 곳이 **150m 안**일 때만 같은 가게로 본다. 다른 지점 사진을 붙이는 것보다 없는 게 낫다.
- 서버 일일 상한 30건(`GOOGLE_DAILY_PHOTO_BUDGET`). 월 무료 한도 Place Photo 1,000건 안에 머물게 잡았다.
- 지도 핀: 확정 정류장은 번호 + 라임, 빈 시간 추천은 번호 없이 주황. 색은 테마 토큰을 런타임에 읽는다.

## 같이 고친 것 — 지도가 렌더마다 새로 만들어지던 문제

카카오 지도가 `[points]`에 걸려 있었는데 호출부가 렌더마다 새 배열을 넘겼다. 화면이 조금만 바뀌어도 지도를 새로
만들었고, 빈 시간 추천이 하나씩 채워질 때마다 다시 그려졌다. 두 지도 모두 핀 내용(JSON)이 바뀔 때만 다시 그린다.

## 하지 않은 것

- **키를 넣은 실동작 검증.** 키가 아직 없다. 응답 해석·라우트 경계·카카오 화면 차단은 테스트했지만, 실제 Google 지도와
  사진은 키를 넣은 뒤 로컬·프리뷰에서 확인해야 한다. 그때 캡처도 찍는다(키 없이는 화면 변화가 없다).
- 여러 날 일정 화면 지도, 장소 검색으로 고르기(카카오 키워드 검색 쪽이 맞다 — 별도 작업).
- AdvancedMarker. Map ID가 필요해서 클래식 Marker를 쓴다(경고는 나오지만 동작한다).

## 바뀐 검사

- 신규 `e2e/google.spec.ts`: 150m 안 가장 가까운 곳의 사진·촬영자 / 멀면·촬영자 없으면·사진 이름이 이상하면 없음 /
  라우트 입력 검사(400·413), `no-store`, 키 미노출.
- `gap-fill.spec`: 카카오 지도 화면에서는 Google 사진을 한 번도 요청하지 않는다.

## 검증

- typecheck 0, lint 오류 0
- E2E 전체 **396건 통과 · 3 skip · 0 실패** (390/768/1440)
- 캡처 없음 — 키가 없는 빌드는 화면이 T-051과 같다. 키를 넣은 뒤 찍는다.

## 해야 할 일 (사용자)

- Google Cloud에서 키 둘을 만들고 `.env.local`과 Vercel에 넣는다. 절차는 `.env.example`의 Google 항목.
- 서버 키는 Vercel에서 **Sensitive**, 브라우저 키(`NEXT_PUBLIC_`)는 Sensitive로 두지 않는다(빌드에 들어가야 한다, T-040 교훈).
