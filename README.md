# 논문AI

논문, 설문조사, 통계분석을 잘 몰라도 간편하게 의뢰할 수 있는 원스톱 논문 지원 서비스입니다. 운영 성균관컨설팅.

## 구성

| 폴더 | 내용 |
|---|---|
| `src/` | 사이트 원본: 화면(templates), 페이지 내용(content), 브라우저 코드(js), 스타일(styles), 이미지(assets) |
| `src/js/core/` | 연구 설계 엔진(주제 해석, 연구모형, 가설, 목차, 표본 수), 가격 계산, 문서·데이터 진단 |
| `src/js/app/` | 신청서(논문·설문·통계), 결제, 주문 조회 화면 |
| `src/js/admin/` | 운영자 화면(오늘의 작업, 작업지시문, 결과물 전달, 설정, 가격표) |
| `backend/` | Google Apps Script 서버. `backend/src/*.gs`를 묶은 `backend/dist/Code.gs`를 Apps Script에 붙여 넣어 웹 앱으로 배포 |
| `tools/` | 빌드, 이미지 생성, 개발 서버, Apps Script 에뮬레이터, 테스트 |

## 배포

- `main` 브랜치에 올리면 GitHub Actions가 테스트, 빌드 후 GitHub Pages에 배포합니다.
- 웹에서 `_upload/` 폴더에 소스 묶음(zip)을 올려도 Actions가 풀어서 저장소에 반영한 뒤 배포합니다. 지울 파일은 `_upload/delete.txt`에 한 줄씩 적습니다.
- 사이트 주소와 서버 주소는 `site.config.json`의 `siteUrl`, `basePath`, `apiUrl`로 정합니다. 도메인을 연결하면 `siteUrl`을 도메인으로, `basePath`를 빈 값으로 바꿉니다.

## 서버(Apps Script)

1. `node tools/build-backend.mjs`로 `backend/dist/Code.gs`와 `appsscript.json`을 만듭니다.
2. Apps Script 새 프로젝트에 두 파일 내용을 붙여 넣고 `setup` 함수를 한 번 실행합니다. 운영 시트, 자료 폴더, 예약 작업이 만들어지고 관리자 비밀번호가 운영 메일로 갑니다.
3. 웹 앱으로 배포(실행: 나, 액세스: 모든 사용자)하고, 받은 주소를 `site.config.json`의 `apiUrl`에 넣습니다.

## 개발

```bash
npm ci
node tools/test/run-all.mjs     # 설계 엔진·가격·서버 API 테스트
./tools/dev-restart.sh          # docs-dev 빌드 + 에뮬레이터 서버(http://localhost:4174, 예시 주문 포함)
node tools/build.mjs            # 배포용 빌드(docs/)
node tools/og.mjs               # OG 이미지·아이콘 다시 만들기(Playwright 필요)
```
