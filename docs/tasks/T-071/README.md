# T-071 · 포스터 추출 모델 (Hugging Face)

| | |
|---|---|
| 상태 | 완료 (실행은 HF_TOKEN 발급 후) |
| 브랜치 | `feat/T-071-poster-extract` |
| 기간 | 2026-09-25 |
| 근거 | 사용자 결정(2026-09-25) "AI 모델은 huggingface 등에서 가져와줘" — [x-collection-plan §3](../../data/x-collection-plan.md) |

## 무엇이 가능해졌나

`pnpm data:extract <포스터 이미지> [본문.txt] [연도]`를 돌리면 Qwen3.8-27B가 포스터에서 카페명·주소·기간·운영시간·특전·참여 조건·아티스트를 읽는다.
필드마다 근거 문구와 신뢰도를 붙여 `.local-data/extract/<해시>.json`에 검수용으로 저장한다.

## 동작

| 입력 / 상황 | 결과 |
|---|---|
| 정상 응답 | 필드 + 근거 + 신뢰도. 신뢰도 0.7 미만·근거 없음 → needsReview |
| 2026-02-30, "9월 22일", 18:00–02:00 | 그 필드를 비우고 issues에 이유 |
| JSON이 아님 | 던지지 않고 전 필드 needsReview |
| 제공자가 json_schema 거부(400) | json_object로 한 번 더 |
| 기본 모델 404·5xx | gemma-4-31B-it로 한 번 더 |
| 429·401·403 | 한 번만 부르고 실패를 알림 |
| HF_TOKEN 없음 | 실행 전에 발급 방법과 함께 멈춤 |

## 쓰려면

1. https://huggingface.co/settings/tokens 에서 fine-grained 토큰을 만든다. 권한은 "Make calls to Inference Providers"다.
2. `.env.local`에 `HF_TOKEN=...`을 넣는다. Vercel에는 넣지 않는다(앱은 이 키를 쓰지 않는다).
3. 결제 설정에서 월 한도를 건다.

## 하지 않은 것

- 실제 포스터로는 돌리지 않았다. 토큰이 없어서 정확도와 비용을 모른다.
- X 수집기와 잇지 않았다. X 연결 뒤에 한다.

## 검증

test:data 71건 통과. 여기에는 poster-extract 단위 테스트 4건(가짜 라우터)이 들어 있다. eslint 0건, 키 스캔 0건. UI 변경이 없어 캡처하지 않았다.
