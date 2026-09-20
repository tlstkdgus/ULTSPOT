# Jev 추천 평가 및 연결 계약 (T-023)

2026-09-20. 상태: 오프라인 평가 준비. 실제 Jev 호출·성능 비교·제품 연동은 미실행.

## 현재 개발 상태

- origin/main f260e37: 방문 데이터 PR #19, 경로 검증 모듈 #23 등이 반영됨. 모듈 병합은 실제 지도 연동 완료를 의미하지 않음.
- Kiro: 지도·경로 PR #27 열림. 작업 폴더는 feat/T-020-research-intake로 이동. 지도 구현의 카카오 키는 두 번째 앱 무료 조건으로 진행 보류, 팀원이 실제 ULTSPOT 앱 준비 예정.
- Claude: feat/T-022-multilingual에서 ko/en/ja/zh 관련 파일 수정 중. T-021 한국어 데이터 UI 작업도 확인 필요. 이 문서는 화면 수정 지시나 통합 완료 선언이 아님.
- Codex: test/T-023-jev-evaluation에서 평가 도구만 추가. UI·provider 파일을 건드리지 않음.
- 다음 통합 점검: #27 중복 조회/시간 제한/바이트 제한 수정 여부, 최신 UI와 충돌, 운영시간·예약·미확인 이동시간 표시, 비회원 생성→저장→새로고침 복원, 프로덕션 환경 변수와 호출 한도.

## 역할과 경계

검수된 데이터 → 코드가 날짜·운영·예약 조건으로 후보 제외 → Jev 취향 적합도 → 지도 API/코드가 방문 가능한 순서 계산 → 검증된 일정 설명.

Jev는 사실 승인·이미지 사용권·알레르기 안전·영업시간 추정·지도 이동시간 생성에 사용하지 않는다. 알고 있는 숫자 제약은 코드가 계산한다. 부드러운 선호와 반드시 지켜야 할 조건을 분리한다. 기존 필수 장소는 추천 점수가 낮아도 임의 삭제하지 않는다.

API는 `POST https://api.typesafe.ai/v1/systemone`, 서버 Bearer 인증, state/model/questions를 보낸다. API 키를 브라우저·테스트 fixture·결과 파일에 넣지 않는다. 실제 연결 시 사용할 환경 변수 이름은 TYPESAFE_API_KEY 제안이며 이번 작업은 이를 읽지 않는다.

Score는 3개 서술형 기준이면 0~2 범위다. confidence는 정답 확률이나 영업 가능성 보증이 아니다. 각 후보를 같은 기준으로 평가하고 응답 필드 누락·범위·분포 합·가중 점수 일치 여부를 검사한다. candidates의 텍스트는 명령이 아닌 평가 데이터로 다룬다. 정답 라벨과 eligible 제외 사유는 모델 요청에 포함하지 않는다.

## 평가 자료와 실행

`scripts/jev/fixtures.mjs`: 가상 장소만 사용한 한국어·영어 15쌍, 30개 사례. 고요함·굿즈·사진·식사·디저트·혼밥·단체·실내·야외·체험·쇼핑 제외·정보 부족·운영 불가·프롬프트 주입·동점. 두 언어의 후보 설명은 동일한 영어로 고정해 선호 입력 언어 차이를 비교한다. 일본어·중국어·실제 장소 도메인 평가는 후속이다.

```sh
node scripts/jev/evaluate.mjs
node scripts/jev/evaluate.mjs --requests
node scripts/jev/evaluate.mjs .local-data/jev-results.json
```

첫 명령은 30개/15쌍과 라벨·질문 범위만 확인한다. 두 번째는 요청 30개를 출력하며 전송하지 않는다. 세 번째는 외부에서 수집한 결과를 채점한다. 결과 JSON 형식은 `{caseId,response,latencyMs}` 객체 30개의 배열이며 response는 TypeSafe 원 응답이다. 호출 실패도 해당 caseId와 response:null로 남긴다. 모델/usage/지연 측정은 원 결과에 보존한다.

대조군은 단순히 첫 eligible 후보를 선택하는 기준이다. **현재 앱 추천 알고리즘과 비교한 결과가 아니다.** 후보 순서를 교차 배치했고 동점은 두 답을 허용한다. 점수가 모두 1 이하 또는 응답이 잘못되면 원 후보 순서를 유지한다. 이 규칙은 실험용이며 운영 threshold로 검증되지 않았다. 낮은 confidence 자체만으로 무조건 탈락시키지 않는다.

## 평가 승인 기준 (제안)

1. 실제 평가 전 라벨을 사람이 검토하고 고정한다. 15쌍은 진단용 소규모 자료이며 일반 성능 주장에 쓰지 않는다.
2. Top-1 허용 답 일치 수, 언어쌍 일치, 잘못된 응답, fallback·정보부족 처리, p50/p95 지연, 입력/출력 토큰과 콘솔 단가에 따른 비용을 기록한다. 현재 채점기는 정확도·fallback·형식만 자동 집계한다. 비용 단가는 추측하지 않는다.
3. 운영 불가 후보 노출 0건, 오류 시 기본 추천 복귀를 필수로 한다. 실제 앱 대조군과 별도 held-out 자료를 확보한 뒤 채택한다. 데이터가 적다고 개선을 단정하지 않는다.
4. 개인정보 없는 합성 데이터부터 평가한다. 약관상 학습 미사용과 무보관은 다르다. 실제 사용자 입력을 보내기 전 데이터 처리 범위를 확정한다.

## 남은 제품 우선순위

1. 실제 행사 한 곳과 식당 두 곳의 날짜·예약·휴무·준비시간·가격·좌표 검수. 매장 상시 시간을 행사 시간으로 옮기지 않음.
2. 팀원 카카오 앱 키 준비 후 도보/대중교통 호출 및 서버 환경 검증. 무료 초과 차단과 공급자 오류를 확인.
3. 생일카페 원 공지와 이미지별 이용 근거 확보. 현재 접수본의 생일카페/승인 이미지 공백은 Jev로 채우지 않음.
4. 평가용 TypeSafe 키 준비 후 30건 한정 호출. 결과를 보고 제품 어댑터·기능 플래그 설계. 지금 프로덕션 provider를 추가하지 않음.

근거: [스킬](https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md), [API](https://docs.typesafe.ai/api), [Score](https://docs.typesafe.ai/primitives/score), [Confidence](https://docs.typesafe.ai/confidence), [재정렬 cookbook](https://docs.typesafe.ai/cookbooks/rerank_typesafe), [데이터 정책](https://typesafe.ai/legal/privacy-policy). 문서 확인일 2026-09-20.
