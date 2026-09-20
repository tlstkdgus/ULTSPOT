# 일본어·중국어 장소 데이터 계약 (T-027)

PR #33 요청 구현. FanEvent의 title/do/get/area에 ja/zh, transit의 station/line에 ja/zh, participation의 price에 ja/zh 선택 필드를 추가했다.

- eventCopy(e, locale)는 ko/en/ja/zh를 받는다. reviewed 카탈로그에만 번역을 적용하고 요청 언어가 없거나 공백이면 영어 기본 필드로 복귀한다. personal은 원문 그대로다.
- translation_review[locale][field]에 author/source/status/checked_on을 기록한다. draft는 eventCopy에서 영어로 복귀한다. 기존 계약 호환을 위해 메타데이터가 없는 직접 입력 번역 필드는 표시 가능하므로, 신규 번역을 카탈로그에 넣을 때 메타데이터를 함께 검토해야 한다.
- transit/participation의 새 필드는 데이터 계약만 추가했다. Claude가 표시 연결 시 동일한 검수 상태와 영어 폴백을 적용해야 한다.
- catalog-translation-drafts.ts에 기존 장소 3곳의 이름·지역 ja/zh 초안 12개와 AI 작성 메타데이터를 남겼다. public catalog.ts에 합치지 않았다. 원어민 검수 완료를 주장하지 않는다. 운영시간·참여 조건은 번역하지 않았다.
- 개인 초안에는 새 8개 번역 필드와 translation_review를 금지한다. 기존 transit/participation 금지도 유지한다.

Claude 후속: spot-card의 dataLocale을 실제 locale로 전달하고 lang 속성을 필드별 폴백 언어에 맞춘다. UI 파일은 이번 작업에서 수정하지 않았다. 검수된 번역을 넣기 전에는 영어 표시가 정상이다.

검증: test:data 18/18 (새 테스트 5개). 개인 초안 주입 9키 각각 문자열/null 거부 검사 포함.
