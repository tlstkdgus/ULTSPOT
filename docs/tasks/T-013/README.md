# T-013 · 원문 행사 조건과 수집 부가 파일 수용

- 배경: 두 번째 자료의 조건 21건과 소속 표기를 검사기가 지원하지 못했다.
- 변경: optional event_conditions와 source 대상 연결, artists agency_label/row_note 지원. 조건 값은 원문 문자열로 보존하고 행사·출처 참조 및 중복 ID는 기존 검사 적용.
- 부가 CSV는 감사 시 해시와 원본 바이트(base64)를 sidecar에 보존한다. strict CSV intake는 알 수 없는 CSV를 발견하면 실패시켜 조용한 누락을 방지한다.
- 검증: test:data 13건 통과. 실제 접수 재검사 121→36건. 조건 21건 수용. 새 결과는 `.local-data/audits/second-t013-20260920/`에 보존.
- 남은 36건: 시각 3, 수치 3, 장소 참조 2, 열린 구간 시간 6, 날짜 8, 출처 필드 14. 출처 필드에는 date_or_weekday 별칭과 '없음' 설명이 있어 후속 원문 대조 필요.
- 하지 않은 것: 사실 검수 승인, DB 업로드, 행사 공개/자동 편성, UI 변경. UI E2E/캡처는 실행하지 않음.
- 다음: 공식 근거가 확인된 행사 발견 화면 연결. Claude UI 분담은 [전달 문서](../../claude-ui-handoff.md) 참고.
- 정적 검사: lint 오류 0(설치된 스킬 스크립트 경고 94), typecheck 오류 0.
