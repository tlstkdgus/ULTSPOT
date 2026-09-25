# T-075 · 아티스트 검색 예시 언어 통일

| | |
|---|---|
| 상태 | 완료 |
| 브랜치 | `fix/T-075-artist-placeholder` |
| 기간 | 2026-09-26 |
| 근거 | 사용자 지적(2026-09-26, 스크린샷) — 한국어 화면 "스트레이 키즈, Felix…", 영어 화면 "Stray Kids, 필릭스…" |

| 화면 언어 | 전 | 후 |
|---|---|---|
| 한국어 | 스트레이 키즈, Felix… | 스트레이 키즈, 필릭스… |
| 영어 | Stray Kids, 필릭스… | Stray Kids, Felix… |
| 일본어·중국어 | Stray Kids、Felix… | 그대로 |

검색은 전처럼 한국어·영어·별칭 어느 쪽으로도 된다. 바꾼 건 예시 문구뿐이다.

**검증:** i18n-guard·artists 테스트 24건 통과. 빈 검색칸을 직접 캡처해서 확인했다. 한국어 [mobile](https://github.com/tlstkdgus/ULTSPOT/blob/7574c27695db3812eea04cc5841c5ef8ba3a7e14/docs/tasks/T-075/screenshots/artist-search-ko-mobile.png) · [desktop](https://github.com/tlstkdgus/ULTSPOT/blob/7574c27695db3812eea04cc5841c5ef8ba3a7e14/docs/tasks/T-075/screenshots/artist-search-ko-desktop.png), 영어 [mobile](https://github.com/tlstkdgus/ULTSPOT/blob/7574c27695db3812eea04cc5841c5ef8ba3a7e14/docs/tasks/T-075/screenshots/artist-search-en-mobile.png) · [desktop](https://github.com/tlstkdgus/ULTSPOT/blob/7574c27695db3812eea04cc5841c5ef8ba3a7e14/docs/tasks/T-075/screenshots/artist-search-en-desktop.png).
