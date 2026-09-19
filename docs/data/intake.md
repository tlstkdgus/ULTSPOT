# 수집 자료 전달·비공개 적재

원본은 **`.local-data/incoming/`**에 넣는다. Git 제외 폴더이며 파일을 넣어도 업로드·공개되지 않는다. 비밀 키·사적 연락처는 포함하지 않는다. 엑셀·문서 원본도 전달 가능하지만 명령 실행 전 별도 변환·대조가 필요하다.

## 입력

명령은 UTF-8 CSV 10개가 있는 폴더 또는 JSON 한 파일을 읽는다. 탭 이름: artists, artist_relations, places, events, event_artists, place_artists, hours, benefits, sources, assets. CSV는 각 이름에 `.csv`, JSON은 각 이름을 키로 행 객체 배열을 사용한다. 빈 탭도 CSV 필수 헤더/JSON 빈 배열로 포함한다.

필드는 [요청서](collection-brief.md)를 따르며 기계 입력 표기를 명확히 한다.

- 관계 상태 열: `status`(`current/past/unknown`). 연결 설명·사실 요약: `description`.
- `source_ids`, `aliases`, `supported_fields`: CSV에서 `|` 구분, JSON 문자열 배열.
- `organizer_type`: `official/fan/store/unknown`. `weekday`: 일요일=0 ~ 토요일=6.
- 출처 `target_type`: `artist/artist_relation/place/event/event_artist/place_artist/hours/benefit/asset`. 연결의 target_id는 `event_id::artist_id` 또는 `place_id::artist_id`. 그 외는 해당 행 ID.
- ID: 영문·숫자로 시작, 영문·숫자·`_`·`-`만, 최대 100자. 이름은 한글 가능. 사실의 `미확인`·`해당 없음`은 보존하되 ID·참조는 실제 값이 필요하다.
- 파일당 5 MB, 탭당 10,000행, SQL 페이로드 10 MB. 모든 참조가 묶음 안에서 해결되어야 한다.

## 실행

```sh
pnpm data:check .local-data/incoming/batch-01
pnpm data:check .local-data/incoming/batch-01.json
pnpm data:prepare .local-data/incoming/batch-01.json batch-01
pnpm test:data
```

CSV 폴더/JSON 중 하나를 선택한다. 오류는 탭·데이터 행 번호(1부터)·필드·코드로 출력한다. 중복 ID, 참조, 날짜·시각·HTTPS URL, 일부 enum, 관계 순환, 운영 구간을 검사한다. prepare는 오류가 없을 때만 `.local-data/prepared/`에 SQL을 생성하고 덮어쓰지 않는다. 네트워크 요청·API 키가 필요 없다.

형식 통과는 사실 확인·사용 허가가 아니다. 출처의 실제 근거, 개인정보, 이용 조건·권리, 주소·시간 충돌, 번역은 사람이 검수한다. 미확인 값을 자동 승인하지 않는다.

## Supabase 적용

관리자가 SQL Editor에서 `supabase/migrations/202609190002_catalog_intake.sql`을 한 번 실행한 뒤 생성 SQL을 검토·실행한다. 기존 guest_trips SQL과 별개이며 클라이언트에 새 키를 추가하지 않는다. `catalog_private`를 Data API exposed schemas에 추가하지 않는다. anon/authenticated/service_role 접근 권한을 제거하고 RLS를 켰다.

동일 batch ID·내용은 중복 저장되지 않는다. 변경된 내용은 새 SHA256 버전으로 보존하며 이전 검수를 승계하지 않는다. 객체 키 순서는 정규화하지만 행 순서 변경도 새 버전이다. 검수 기록은 정확한 digest에 연결한다.

```sql
insert into catalog_private.intake_reviews
  (batch_id, digest, decision, reviewer_alias, notes)
values
  ('batch-01', '<64자리 SHA256>', 'hold', 'reviewer-01', '출처·권리 확인 대기');
```

자리표시자를 실제 값으로 바꾼다. 자유 텍스트 작은따옴표는 SQL 방식으로 이중 처리하고 실명 대신 팀 별칭을 쓴다. decision은 `hold/rejected/reviewed`. **reviewed도 공개 상태가 아니다.** 공개용 테이블·게시 승인·아티스트 검색·플래너 연결은 다음 작업이며 기존 장소 카탈로그는 바뀌지 않는다. 원격 적용은 별도 확인해야 한다.

근거: [Supabase 권한·RLS](https://supabase.com/docs/guides/api/securing-your-api), [PGlite 로컬 PostgreSQL](https://pglite.dev/docs/). 로컬 DB 검증은 Supabase 네트워크 설정까지 재현하지 않는다.
