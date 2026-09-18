# 덕질여행 테마 테스트 — 초안 v0.1

> 근거: 프로덕트 기획안 v0.4 §4.1-2 "테마 선택", §7.1 "실제 동작 (문항 3~5개)", §10.2 오픈 이슈 "테마 종류와 문항 수"
> 상태: **초안** — 기획 확인 필요. 데모 UI는 영어(§7.2)라 영어 문구가 원문이고 한국어는 검토용이다.

---

## 1. 이 테스트가 하는 일

심리테스트처럼 가볍게 답하면, 결과로 **테마 1개**와 **일정 생성에 쓰는 숫자 3개**가 나온다.

| 결과 | 어디에 쓰나 |
|------|-------------|
| **테마** (공유 가능한 이름·설명) | 결과 화면, 발자취 공유 카드 |
| **장소 유형 가중치** 4개 (합 1.0) | Best 3 후보 정렬, AI 일정 생성 입력 |
| **하루 장소 수** (2 / 3 / 4 / 6) | 일정 밀도 |
| **대기 허용도** (low / mid / high) | 선착순 특전 이벤트 포함 여부, 도착 시각 |

### 판단: 테마 해석은 AI가 아니라 규칙으로 계산한다

기획안 §3.3은 "심리테스트형 답변을 장소 가중치로 바꾸는 작업"을 AI가 필요한 이유로 들었다.
데모에서는 **점수표로 계산**하는 쪽을 제안한다.

- 같은 답이면 항상 같은 결과가 나와야 결과 공유 카드와 재방문 경험이 흔들리지 않는다
- 문항이 5개·보기 4개라 조합이 1,024가지뿐이다. 점수표로 모두 설명할 수 있다
- AI 호출은 비용과 실패 가능성이 있는 **일정 생성**에 아낀다

AI는 결과 화면의 "당신에게 맞춘 한 줄 설명"을 쓰는 데만 선택적으로 쓸 수 있다(실패하면 아래 고정 문구).

---

## 2. 장소 유형 (가중치 대상)

기획안 §3.1·§7.2의 장소 유형을 4개로 묶었다.

| 코드 | 유형 | 예 | 기간 |
|------|------|----|------|
| `birthday_cafe` | 생일카페·컵홀더 이벤트 | 필릭스 생일카페, 팬 주최 컵홀더 | 기간 한정 (보통 3~5일) |
| `popup` | 팝업스토어·공식 이벤트 | 앨범 발매 팝업, 브랜드 콜라보 팝업 | 기간 한정 |
| `filming_spot` | 촬영지 | MV·예능·화보 촬영 장소 | 상설 |
| `bias_eats` | 멤버 방문 식당·카페 | 방송·SNS에 나온 식당 | 상설 |

**제외:** 사옥, 숙소, 멤버 자택 인근 등 개인 공간 (기획안 §2.2, §7.3)

---

## 3. 테마 4종

| 코드 | 영어 이름 (UI) | 한국어 (검토용) | 주 유형 | 한 줄 설명 (영어 / 한국어) |
|------|----------------|-----------------|---------|----------------------------|
| `collector` | **Cup Sleeve Collector** | 컵홀더 컬렉터 | `birthday_cafe` | You travel for the drop. Birthday cafes, perks, and every cup sleeve with your bias's face. / 특전과 컵홀더를 위해 움직이는 사람. 생일카페가 여행의 이유. |
| `scene` | **Scene Stealer** | 장면 수집가 | `filming_spot` | You want to stand exactly where it happened — same angle, same pose. / 그 장면, 그 자리, 그 각도. 촬영지에서 똑같이 찍어야 완성. |
| `taste` | **Bias Taste Tour** | 최애 입맛 탐방러 | `bias_eats` | If your bias ate it, you're ordering it. The trip is a menu. / 최애가 먹은 건 나도 먹는다. 여행은 곧 메뉴판. |
| `raider` | **Pop-up Raider** | 팝업 레이더 | `popup` | Limited means now. You map pop-ups before you map meals. / 한정은 곧 지금. 밥집보다 팝업 지도를 먼저 그린다. |

**혼합 결과:** 1위와 2위가 **동점**이면 두 이름을 붙인다. 예: `Cup Sleeve Collector × Pop-up Raider`
섞인 취향을 한 유형에 억지로 넣지 않기 위해서다. 처음엔 "차이 1점 이하"로 잡았는데, 전체 1,024개 응답 조합을 계산해 보니 **62.5%가 혼합 결과**가 돼 테마 이름이 의미를 잃었다. 동점 기준에서는 25%다.

---

## 4. 문항 (5개)

표기: `C` collector · `S` scene · `T` taste · `R` raider. 숫자는 더하는 점수.

> 문구는 특정 아티스트를 쓰지 않는다. 데모는 스트레이 키즈지만(기획안 §7.2) 테스트는 다른 그룹 팬에게도 그대로 쓸 수 있어야 한다.

### Q1. 여행의 이유

**EN** It's your first morning in Seoul. What gets you out of bed?
**KO** 서울에서의 첫 아침. 무엇 때문에 눈이 번쩍 뜨이나요?

| | EN | KO | 점수 |
|---|----|----|------|
| A | A cup sleeve with my bias's face is waiting for me | 최애 얼굴이 박힌 컵홀더가 날 기다린다 | C+2 |
| B | Standing exactly where that MV scene was shot | 그 뮤비 장면을 찍은 바로 그 자리에 서기 | S+2 |
| C | Breakfast at the place my bias ate at | 최애가 먹었던 그 집에서 아침 먹기 | T+2 |
| D | A limited pop-up opens today and it will sell out | 오늘 오픈하는 한정 팝업, 곧 품절될 예정 | R+2 |

### Q2. 대기 줄 (대기 허용도)

**EN** There's a 2-hour line for a first-come perk. You…
**KO** 선착순 특전 때문에 줄이 2시간이에요. 당신은…

| | EN | KO | 점수 | 대기 |
|---|----|----|------|------|
| A | Join it. That perk is the whole point. | 선다. 그 특전이 여행의 목적이다 | C+1 | +2 |
| B | Only if it's limited merch I can't get online | 온라인에서 못 사는 한정 굿즈면 선다 | R+1 | +1 |
| C | Skip it and go take the perfect photo somewhere else | 패스하고 다른 곳에서 인생샷을 찍는다 | S+1 | 0 |
| D | Grab food nearby and check again later | 근처에서 밥 먹고 나중에 다시 와 본다 | T+1 | +1 |

### Q3. 하루 밀도 (하루 장소 수)

**EN** How many spots in one day feels right?
**KO** 하루에 몇 곳이 딱 좋아요?

| | EN | KO | 점수 | 하루 장소 수 |
|---|----|----|------|-------------|
| A | As many as possible — I'll sleep on the plane | 최대한 많이. 잠은 비행기에서 | — | 6 |
| B | 4 or so, with a real lunch in between | 4곳 정도, 점심은 제대로 | — | 4 |
| C | 2–3, and I want to enjoy each one | 2~3곳, 하나하나 즐기면서 | — | 3 |
| D | One must-go, then I'll wander | 꼭 갈 곳 하나, 나머진 발길 닿는 대로 | — | 2 |

테마 점수는 주지 않는다. 밀도 취향은 테마와 무관해서, 여기서 점수를 주면 결과가 한쪽으로 쏠린다.

### Q4. 여행 후 사진첩 (가장 직접적인 신호)

**EN** After the trip, your camera roll is mostly…
**KO** 여행이 끝나면 내 사진첩은 대부분…

| | EN | KO | 점수 |
|---|----|----|------|
| A | Cup sleeves, photocards, and cafe decorations | 컵홀더, 포토카드, 카페 장식 | C+2 |
| B | Me recreating my bias's exact pose | 최애 포즈를 똑같이 따라 한 내 사진 | S+2 |
| C | Food. So much food. | 음식. 정말 음식뿐. | T+2 |
| D | Shopping bags, booths, and unboxing | 쇼핑백, 부스, 언박싱 | R+2 |

### Q5. 동행 (대기 허용도 보정)

**EN** Who's coming with you?
**KO** 누구와 함께 가나요?

| | EN | KO | 점수 | 대기 |
|---|----|----|------|------|
| A | Just me — solo stan mode | 나 혼자, 솔로 덕질 모드 | C+1, R+1 | +1 |
| B | Fan friends who love the same group | 같은 그룹 좋아하는 덕메 | C+1, S+1 | +1 |
| C | A friend or family member who isn't a fan | 팬이 아닌 친구나 가족 | T+1, S+1 | −1 |
| D | Still deciding | 아직 정하지 않았다 | T+1, R+1 | 0 |

### 점수 균형 검증

각 테마가 받을 수 있는 최대 점수가 같아야 특정 테마로 쏠리지 않는다.

| 테마 | Q1 | Q2 | Q4 | Q5 | 최대 |
|------|----|----|----|----|------|
| C collector | 2 | 1 | 2 | 1 | **6** |
| S scene | 2 | 1 | 2 | 1 | **6** |
| T taste | 2 | 1 | 2 | 1 | **6** |
| R raider | 2 | 1 | 2 | 1 | **6** |

각 테마는 Q1·Q2·Q4에서 보기 1개, Q5에서 보기 2개에 점수가 있다. 4개 테마가 대칭이다.
어떻게 답해도 점수 총합은 항상 7점이다 (Q1 2 + Q2 1 + Q4 2 + Q5 2).

**전수 계산 (1,024개 응답 조합, 2026-09-17):** 1위 테마 분포 collector 256 · scene 256 · taste 256 · raider 256 — 완전 균형. 혼합(동점) 결과 256건(25%).

---

## 5. 계산 규칙

```
1) 테마 점수   score[C|S|T|R] = Q1 + Q2 + Q4 + Q5 점수 합

2) 테마 결정   1위 = 최고점
               동점이면 → Q4에서 고른 보기의 테마 → 그래도 같으면 Q1의 테마
               1위와 2위가 동점이면 혼합 결과 "1위 × 2위" (순서는 위 동점 규칙으로 정한 순서)

3) 가중치     raw[type] = score[theme] + 1        (0점 테마도 후보에서 완전히 빠지지 않게 +1)
               weight[type] = raw[type] / 11        (Σ raw는 항상 7 + 4 = 11)
               collector→birthday_cafe, scene→filming_spot, taste→bias_eats, raider→popup

4) 하루 장소 수 = Q3 값 (2 / 3 / 4 / 6)

5) 대기 허용도  q = Q2 대기 + Q5 대기   (범위 −1 ~ 3)
               q ≤ 0 → low  : 선착순·대기 긴 이벤트는 후보에서 뒤로, 일정에 넣으면 경고
               q 1~2 → mid  : 포함하되 오픈 시각 도착으로 배치
               q ≥ 3 → high : 선착순 특전 이벤트를 우선 배치
```

### 예시

| 답 (Q1~Q5) | 점수 C/S/T/R | 결과 | 가중치 birthday/filming/eats/popup | 하루 | 대기 |
|------------|--------------|------|------------------------------------|------|------|
| A A B A A | 6 / 0 / 0 / 1 | Cup Sleeve Collector | .64 / .09 / .09 / .18 | 4 | high (3) |
| B C C B C | 0 / 6 / 1 / 0 | Scene Stealer | .09 / .64 / .18 / .09 | 3 | low (−1) |
| C D B C D | 0 / 0 / 6 / 1 | Bias Taste Tour | .09 / .09 / .64 / .18 | 4 | mid (1) |
| D B A A A | 3 / 0 / 0 / 4 | Pop-up Raider | .36 / .09 / .09 / .45 | 6 | mid (2) |
| A D C D B | 3 / 1 / 1 / 2 | Cup Sleeve Collector | .36 / .18 / .18 / .27 | 3 | mid (2) |

> 이 표는 스크립트로 계산한 값이다. 구현할 때 단위 테스트로 이 5개 예시와 "1위 테마 256건씩 균형"을 고정한다.

---

## 6. Best 3 후보 정렬에 쓰는 법 (초안)

```
후보 = 여행 날짜와 운영 기간이 1일 이상 겹치는 장소 (상설 장소는 항상 포함)
정렬 점수 = weight[장소 유형] × 날짜 적합도 × 최애 일치
  날짜 적합도: 기간 한정 이벤트가 여행 기간과 겹치는 날 수 / 이벤트 기간 (최대 1.0), 상설 0.7
  최애 일치:  선택한 멤버 전용 이벤트 1.0 · 그룹 전체 0.8 · 다른 멤버 0.3
```

상설 장소를 0.7로 둔 이유: 언제든 갈 수 있는 곳보다 **이번 여행 기간에만 열리는 곳**을 먼저 보여줘야 "날짜가 먼저"(기획안 §2.2) 원칙에 맞다.

---

## 7. 화면 흐름 (UI 초안, 영어)

1. 인트로 — "What kind of stan traveler are you?" · 5 questions · 30 seconds
2. 문항 1개씩 전체 화면, 상단 진행 도트 5개 (브랜드 도트 모티프)
3. 보기 선택 즉시 다음 문항 (뒤로 가기 가능)
4. 결과 — 테마 이름(`text-display`), 한 줄 설명, 가중치를 도트 크기로 표현, CTA "Pick your Best 3"
5. 결과 공유 카드는 발자취 카드와 같은 틀을 재사용

---

## 8. 오픈 이슈

- [ ] 테마 이름 톤: 팬 은어("stan", "bias")를 영어 UI에 그대로 써도 되는가 — 글로벌 팬에게는 자연스럽지만 비팬 동행자는 모른다
- [ ] 테마 4종이 기획 의도와 맞는가 — "공연·콘서트 중심" 테마가 필요한가 (현재 장소 유형에 공연장이 없음)
- [ ] 멤버 방문 식당(`bias_eats`)을 테마로 둘지: 방문 식당은 사생활 경계에 가까워 "방송·공식 SNS에 공개된 곳만" 조건이 필요
- [ ] Q3 "하루 6곳"이 서울 이동 시간 기준으로 현실적인가 — 장소 데이터 조사 후 조정
- [ ] 결과 한 줄 설명을 AI로 개인화할지, 고정 문구만 쓸지
