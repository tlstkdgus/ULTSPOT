# T-074 · 추적되지 않은 파일 정리

| | |
|---|---|
| 상태 | 완료 |
| 브랜치 | `chore/T-074-untracked-cleanup` |
| 기간 | 2026-09-26 |
| 근거 | 사용자 결정(2026-09-26) "copilot 안써 진행해" |

| 파일 | 정체 | 처리 |
|---|---|---|
| `public/images/image (14)~(18).png` | 사이트가 쓰는 WebP·JPG의 원본(같은 해상도) | 저장소 밖 `Desktop/ULTSPOT-originals/`로 옮김 |
| `public/images/KakaoTalk_…_02.jpg` | `hikr-ground.jpg`와 SHA256이 같다 | 같은 곳으로 옮김 |
| `debug.log` | 9/20 브라우저 경고 한 줄 | 지우고 `.gitignore`에 추가 |
| `.github/agents/`, `.github/hooks/` | impeccable 설치가 만든 Copilot 전용 파일 | `.gitignore`에 추가(Copilot을 쓰지 않음) |

**하지 않은 것:** 원본 이미지를 지우지 않았다. 전부 git 이력에 있는지 확인하지 않았기 때문이다.
