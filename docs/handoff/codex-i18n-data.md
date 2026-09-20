# Codex 인계 — 일본어·중국어 장소 데이터

작성 기준: 2026-09-20, `main` = `000e0f3`. 브랜치·배포 상태는 시작할 때 다시 확인한다.

## 왜 지금

T-022(#30)로 **UI 문구**는 한국어·영어·일본어·중국어 4개가 됐고 배포됐다. 첫 방문은 브라우저 언어(`Accept-Language`)로 결정되고, 고른 값은 `ultspot-locale` 쿠키에 남는다.

그런데 **장소 데이터**는 `_ko`까지만 있다. 그래서 일본어 화면은 이렇게 나간다.

```
UI 껍데기:  日程を決める / プランを受け取る      ← 일본어
카드 본문:  HiKR Ground · K-Pop Experience     ← 영어
           Browse the public K-pop exhibition…  ← 영어
```

주 대상이 외국인 팬인데 정작 보러 온 내용이 영어다. UI만 번역된 절반짜리 화면이다.

**지금 영어로 두는 것은 의도한 선택이다.** 운영시간·참여 조건을 기계 번역하면 오역이 곧 잘못된 정보가 된다. `lang="en"`을 붙여 스크린리더가 일본어로 읽지 않게만 해뒀다. 이 판단을 뒤집자는 게 아니라, **검수된 번역을 데이터로 받자**는 요청이다.

## 요청 1 — 언어 필드 확장

`src/lib/trip/planner.ts`의 `FanEvent`와 `src/lib/trip/catalog.ts`. 기존 `_ko` 패턴 그대로 이어간다.

| 지금 | 더할 것 |
|---|---|
| `title_ko` `do_ko` `get_ko` `area_ko` | `_ja` `_zh` 각각 |
| `transit.station_ko` `line_ko` | `station_ja` `line_ja` · `station_zh` `line_zh` |
| `participation.price_ko` | `price_ja` · `price_zh` |

전부 optional이다. 없으면 지금처럼 영어로 떨어지면 되고, 화면은 이미 그 상태를 처리한다.

`exit` `walk_minutes` `cash_required` `first_come_quantity` `lucky_draw`는 숫자·불리언이라 번역 대상이 아니다.

## 요청 2 — `eventCopy` 확장

`src/lib/trip/event-copy.ts`는 지금 `locale: 'ko' | 'en'`을 받는다. `'ja' | 'zh'`를 더해야 한다.

**폴백은 요청 언어 → 영어.** 한국어로 떨어뜨리면 일본어 화면에 한국어가 섞인다. 일본 방문자에게 한국어는 영어보다 멀다.

**`provenance.mode === 'reviewed'` 조건을 반드시 유지한다.** 지금 이 함수는 검수된 카탈로그 항목에만 번역본을 쓰고, 사용자가 직접 넣은 개인 행사는 원문 그대로 둔다. 사용자 입력을 우리가 번역해 보여주면 안 된다. ja/zh에도 같은 조건이 걸려야 한다.

`src/lib/trip/storage.ts:17`의 개인 행사 판별 목록에도 새 키를 더한다. 이 목록은 "비공개 초안에서 검수 메타데이터가 올라오면 거부한다"는 불변식이라, 새 필드를 빠뜨리면 초안으로 카탈로그 필드를 주입할 수 있게 된다.

```ts
['title_ko', 'do_ko', 'get_ko', 'area_ko', 'image_asset_id', 'transit', 'participation']
//  ← 여기에 _ja, _zh 8개를 더한다
```

## 요청 3 — 번역 출처를 기록할 것

`source` · `checked_on`과 같은 수준으로 **누가 번역했는지**를 남긴다. 기계 번역이면 기계 번역이라고 적는다.

원어민 검수 전이라면, **사실을 바꾸는 문구는 번역 대상에서 빼는 편이 안전하다.** 장소 이름과 "무엇을 하는 곳인가"는 오역해도 회복되지만, 운영시간·현금 필요 여부·선착순 수량은 오역이 헛걸음으로 이어진다.

## 하지 않아도 되는 것

- **번체 중국어(zh-Hant)** — 간체만 있으면 된다. `zh-TW` `zh-HK` 브라우저도 간체 화면으로 보내고 있고, `<html lang="zh-Hans">`로 표기한다.
- **UI 문구 번역** — `src/i18n/messages.ja.ts` · `messages.zh.ts`에 이미 있다. Claude 담당 파일이라 건드리지 않는다.
- **아티스트 이름** — 번역·음역하지 않는다. 팬이 아는 표기가 원표기다.

## 화면 쪽 준비 상태

필드가 오면 Claude 쪽은 두 곳만 바꾸면 된다. 미리 손대지 말 것.

```ts
// src/components/spot-card.tsx
const dataLocale = locale === "ko" ? "ko" : "en";   // ← locale 그대로 넘기게 바뀜
const langOf = (korean?: string) => …                // ← lang 속성 계산도 같이
```

## 소유권

| 담당 | 이 작업에서 | |
|---|---|---|
| Codex | `src/lib/trip/**` · `scripts/catalog/**` · 수집 원본 | 데이터와 계약 |
| Claude | `src/components/**` · `src/i18n/**` | 표시 연결 |

같은 파일을 동시에 고치지 않는다. 계약(`FanEvent` 타입과 `eventCopy` 시그니처)이 정해지면 양쪽이 각자 붙인다.

## 검증 요청

- `pnpm test:data` — 새 필드가 optional인지, 없을 때 영어로 떨어지는지
- 개인 행사에 `title_ja`를 넣은 초안이 `isPersonalEvent`에서 거부되는지
- `provenance.mode === 'personal'`인 항목에 `eventCopy(e, 'ja')`가 원문을 돌려주는지
