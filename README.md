# Seoul Path

서울 여행에 필요한 장소, 지도, 이동 경로, 날씨 정보를 한곳에서 보여주는 React 웹 앱입니다.

> 현재 개발 중인 프로젝트입니다. 일부 화면과 기능은 프로토타입 또는 예시 데이터로 구성되어 있으며, 실제 서비스 수준의 데이터와 기능으로 계속 확장할 예정입니다.

## 현재 구현된 기능

- 서울 관광명소·카페·식당·자연 장소를 지도에서 탐색
- 카테고리 필터와 장소명·지역 검색
- 한국어·영어·일본어 UI 전환
- 장소 상세 정보와 공식 관광 정보 연결
- 서울 현재 날씨, 강수 확률, 기온 및 추천 복장 안내
- 서울 여행 경로 안내 화면

## 향후 개발 계획

- 서울시 공공 API에서 관광지 데이터를 주기적으로 받아 가공하고, 실제 지도에 더 많은 관광지를 표시
- 관광지 데이터를 카테고리·지역·좌표 기준으로 정리해 검색과 장소 상세 정보 강화
- 출발지와 목적지 사이의 이동 경로 및 예상 소요 시간 확인 기능 개발
- 현재 날씨와 강수 확률 등을 기준으로 한 추천 복장 및 준비물 안내 고도화
- 공공 API 데이터 갱신과 좌표·운영 정보 검증 흐름 정비

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

## 주요 명령어

```bash
pnpm dev                    # 개발 서버
pnpm build                  # 타입 검사 및 프로덕션 빌드
pnpm preview                # 프로덕션 빌드 미리보기
pnpm lint                   # ESLint 검사
pnpm format                 # Prettier 적용
pnpm format:check           # 포맷 검사
pnpm sync:seoul-attractions # 서울 공공 관광 데이터 동기화
```

## 환경 변수

공공 관광 데이터를 동기화하려면 `.env.local`을 만들고 서울 Open Data Plaza API 키를 설정합니다.

```env
VITE_SEOUL_OPEN_DATA_KEY=발급받은_API_키
```

이 키는 `pnpm sync:seoul-attractions` 실행 시에만 사용됩니다. `.env.local`은 커밋하지 않습니다.

## 페이지

| 경로 | 설명 |
| --- | --- |
| `/` | 서비스 소개 및 주요 기능 |
| `/explore` | 장소 검색·필터·지도 탐색 |
| `/spots/:spotId` | 장소 상세 정보 |
| `/routes` | 장소 간 이동 경로 안내 |
| `/weather` | 서울 날씨 및 추천 복장 |

## 데이터 구조

- `src/data/seoul-spots.json`: 지도와 검색에 사용하는 장소 카탈로그
- `src/data/spots.ts`: 장소 데이터 타입과 조회 함수
- `src/data/seoul-spot-public-records.json`: 서울시 공공 관광 데이터와 매칭된 정보
- `src/data/publicAttractions.ts`: 공공 관광 데이터 접근 함수
- `docs/SPOT_DATA_PLAN.md`: 장소 데이터 관리 및 검증 규칙

장소 데이터를 수정할 때는 안정적인 `id`, 다국어 이름, 카테고리, 지역, 좌표, `sourceUrl`을 유지해야 합니다. 좌표와 운영 정보는 공식 출처를 기준으로 확인합니다.

## 이미지 출처

홈 화면 이미지의 출처와 라이선스 정보는 [`public/images/landing/README.md`](public/images/landing/README.md)에 정리되어 있습니다.
