# AI 프로젝트 프로필

## 프로젝트

- 목적: 서울 여행 장소, 지도, 이동 경로 및 날씨를 안내하는 웹 앱
- 언어 / 프레임워크 / 런타임: TypeScript, React 19, Vite, 브라우저 및 Node.js 스크립트
- 패키지 관리자: pnpm
- 주요 디렉터리: `src/components`, `src/context`, `src/data`, `src/hooks`, `src/i18n`, `src/pages`, `scripts`, `public`, `docs`
- 데이터 흐름: 장소 원본·검토 자료를 `scripts/build-travel-places.mjs`가 `src/data/seoul-travel-places.json`으로 생성하고, 앱의 지도·검색·상세 화면이 카탈로그를 공유합니다. 날씨는 Open-Meteo를 사용하며 장소 관련 데이터는 서울 공공 데이터를 동기화하는 스크립트가 있습니다.

## 소유권과 경계

- 생성 파일 및 원본: `src/data/seoul-travel-places.json`은 생성 산출물입니다. 기준 원본과 검토 자료를 수정한 뒤 `pnpm build:travel-places`로 재생성합니다. `dist/`는 빌드 산출물입니다.
- API / DB 스키마 / 마이그레이션: 서버 DB 및 마이그레이션은 확인되지 않았습니다. 외부 데이터 스크립트의 계약과 출처는 관련 `docs/` 문서를 확인합니다.
- 인증·권한·민감 데이터: 앱의 배포 및 데이터 동기화용 키는 환경 변수로 관리하며 `.env.local` 및 실키를 출력하거나 커밋하지 않습니다. `.env.example`은 변수 목록 참고용입니다.
- 주의 작업: 장소 데이터 생성·동기화·조사 스크립트는 데이터 파일을 변경하거나 외부 API를 호출할 수 있으므로 사용자 요청과 해당 스크립트의 동작을 확인합니다. 커밋·푸시·배포는 별도 요청 없이 수행하지 않습니다.

## 검증 명령

| 범위                        | 명령                                | 비고                                                     |
| --------------------------- | ----------------------------------- | -------------------------------------------------------- |
| 전체 검증                   | `pnpm verify`                       | 린트, 전체 테스트, 카탈로그 생성·타입 검사·프로덕션 빌드 |
| 린트                        | `pnpm lint`                         | ESLint, 경고를 오류로 처리                               |
| 전체 테스트                 | `pnpm test`                         | `scripts/*.test.mjs` 전체 실행                           |
| 포맷 검사                   | `pnpm format:check`                 | 저장소 전체 Prettier 검사                                |
| 타입 검사 및 프로덕션 빌드  | `pnpm build`                        | 카탈로그 생성 후 `tsc -b`와 Vite 빌드 실행               |
| 장소 카탈로그 단위 테스트   | `pnpm test:travel-places`           | 카탈로그 빌드 로직                                       |
| 조사 파이프라인 단위 테스트 | `pnpm test:travel-place-enrichment` | 조사 파이프라인                                          |

## 참고 문서

- 장소 데이터 정책과 출처: `docs/TRAVEL_PLACE_POLICY.md`
- 장소 검토 내역: `docs/TRAVEL_PLACE_REVIEW.md`
- 데이터 흐름과 재생성 절차: `docs/SPOT_DATA_PLAN.md`
- 에이전트 작업·검토·자가 수정 루프: `docs/AGENT_WORKFLOW.md`
- 코드 리뷰 절차와 체크리스트: `serene-harness/review-checklist.md`

## 완료 기준

- 요청한 동작과 기존 프로젝트 패턴을 충족합니다.
- 변경에 관련된 검증을 실행하고 결과를 정확히 보고합니다. 실행하지 않은 검사는 구분합니다.
- 생성 데이터나 외부 연동을 변경했다면 원본 정의·출처·재생성 절차를 확인합니다.
