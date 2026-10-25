# Seoul Travel

서울 여행에 필요한 장소, 지도, 이동 경로, 날씨 정보를 한곳에서 보여주는 React 웹 앱입니다.

## 현재 구현된 기능

- 서울 관광명소·카페·식당·자연 장소를 지도에서 탐색
- 카테고리 필터와 장소명·지역 검색
- 한국어·영어·일본어 UI 전환
- 선정 장소 상세 정보와 조사 출처 연결
- 서울 현재 날씨, 강수 확률, 기온 및 추천 복장 안내
- 검색 가능한 출발지·도착지 선택과 대중교통 경로 안내

## 향후 개발 계획

- 날씨와 장소 정보를 연결한 상황별 여행 추천
- 관광 정보의 주기적 갱신과 변경 사항 검토 흐름 강화

## 기술 스택

- React 19 + TypeScript
- Vite
- React Router
- MapLibre GL JS
- Open-Meteo 날씨 API
- Seoul Open Data Plaza 관광 데이터
- pnpm

## 시작하기

```bash
pnpm install
pnpm dev
```

개발 서버가 실행되면 터미널에 표시된 로컬 주소를 브라우저에서 엽니다.

## Docker 실행

```bash
docker compose up --build
```

앱: [http://localhost:8090](http://localhost:8090)

## GitHub Pages

`main` 브랜치에 푸시하면 GitHub Actions가 빌드해 배포합니다. 최초 배포 전에 저장소 Settings → Pages에서 배포 소스를 GitHub Actions로 설정하세요.

배포: [https://serene1004.github.io/SeoulTravel/](https://serene1004.github.io/SeoulTravel/)

## 주요 명령어

```bash
pnpm dev                    # 개발 서버
pnpm build                  # 타입 검사 및 프로덕션 빌드
pnpm preview                # 프로덕션 빌드 미리보기
pnpm lint                   # ESLint 검사
pnpm format                 # Prettier 적용
pnpm format:check           # 포맷 검사
pnpm sync:seoul-attractions # 서울 공공 관광 데이터 동기화
pnpm enrich:travel-places -- --limit 25 --offset 0 # 장소 상세 정보 조사 배치
pnpm test:travel-place-enrichment                 # 조사 파이프라인 검사
```

## 환경 변수

공공 관광 데이터를 동기화하거나 AI 조사 배치를 실행할 때 `.env.local`을 사용합니다. 실제 키는 커밋하지 않습니다.

```env
VITE_SEOUL_OPEN_DATA_KEY=발급받은_API_키
OPENAI_API_KEY=발급받은_API_키
OPENAI_MODEL=gpt-6-luna
ENRICH_MAX_SPEND_USD=4.5
```

서울 데이터 키는 `pnpm sync:seoul-attractions`, OpenAI 키는 `pnpm enrich:travel-places` 실행 시 사용됩니다. `.env.example`에 변수 목록이 있습니다.

## 페이지

| 경로             | 설명                     |
| ---------------- | ------------------------ |
| `/`              | 서비스 소개 및 주요 기능 |
| `/explore`       | 장소 검색·필터·지도 탐색 |
| `/spots/:spotId` | 장소 상세 정보           |
| `/routes`        | 장소 간 이동 경로 안내   |
| `/weather`       | 서울 날씨 및 추천 복장   |

## 장소 데이터

지도·검색·상세 화면은 선정된 서울 장소 카탈로그를 공유합니다. 장소 선정 기준은 [장소 선정 정책](docs/TRAVEL_PLACE_POLICY.md), 전체 판단 내역은 [장소 검토표](docs/TRAVEL_PLACE_REVIEW.md)에 있습니다. `pnpm build:travel-places`로 카탈로그를 재생성하고 `pnpm test:travel-places`로 검증합니다. 빌드 시에도 카탈로그를 재생성합니다.

- `src/data/seoul-travel-places.json`: 지도·검색·상세 화면에 사용하는 선정 장소 카탈로그
- `src/data/seoul-travel-place-review.json`: 포함·제외·보류 판단과 근거
- `src/data/seoul-travel-place-enrichment.json`: AI 조사 제안, 필드별 출처, 사용량과 비용 기록
- `src/data/spots.ts`: 장소 데이터 타입과 조회 함수
- `src/data/publicAttractions.ts`: 공공 관광 데이터 접근 함수
- `docs/SPOT_DATA_PLAN.md`: 장소 데이터 관리 및 검증 규칙

조사 배치는 `.env.local`의 `OPENAI_API_KEY`를 사용하며 기본 25곳씩 처리합니다. 예: `pnpm enrich:travel-places -- --limit 25 --offset 0`. 조사 결과는 검토용 원장에 저장되고, 출처 URL이 있는 필드만 카탈로그 생성 시 반영합니다. 자세한 데이터 흐름과 재실행 절차는 [장소 데이터 계획](docs/SPOT_DATA_PLAN.md)을 참고하세요.

Google Maps 경로 링크는 한국에서 지원되는 대중교통 경로를 엽니다. 장소명과 주소를 함께 전달해 위치를 명확히 찾습니다.

## 이미지 출처

홈 화면 이미지의 출처와 라이선스 정보는 [`public/images/landing/README.md`](public/images/landing/README.md)에 정리되어 있습니다.
