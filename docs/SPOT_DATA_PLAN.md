# 서울 장소 데이터와 지도

이 문서는 현재 장소 데이터의 흐름과 관리 방법을 안내합니다. 지도에 넣을 장소의 세부 선정 기준은 [장소 선정 정책](TRAVEL_PLACE_POLICY.md), 항목별 판단 결과는 [장소 검토 결과](TRAVEL_PLACE_REVIEW.md)를 참고하세요.

## 현재 데이터 흐름

`src/data/seoul-travel-places.json`은 전체 선정 장소 카탈로그 생성 결과입니다. 빌더는 여기서 지도·검색·경로 화면용 경량 색인과 상세 화면용 데이터 조각을 생성합니다. 앱은 색인을 공통으로 사용하고, 상세 화면은 해당 장소가 속한 조각만 지연 로드합니다. 영어·일본어 상세 문구도 별도 생성 파일에서 지연 로드합니다. 생성 파일은 직접 편집하지 않습니다.

| 파일                                                           | 역할                                    | 수정 방법                  |
| -------------------------------------------------------------- | --------------------------------------- | -------------------------- |
| `src/data/seoul-open-attractions.json`                         | 서울시 관광 명소 원천 스냅샷            | 동기화 명령으로 갱신       |
| `src/data/seoul-public-attraction-coordinates.json`            | 원천 장소의 좌표와 주소 대조 정보       | 지오코딩 명령으로 갱신     |
| `src/data/seoul-travel-place-review.json`                      | 포함·제외 판단, 방문 안내·주소 보정과 근거 | 판단·보정을 수정할 때 편집 |
| `src/data/seoul-travel-place-enrichment.json`                  | 주소·운영시간·교통·공식 링크와 출처     | 조사 결과를 보존           |
| `src/data/seoul-travel-place-localization-candidates.json`     | 영어·일본어 장소명 1차 번역 후보        | 후보 생성 후 API 검토      |
| `src/data/seoul-travel-place-localization-review.json`         | 번역별 OpenAI 검토·수정 제안·사용량     | 검토 배치로 생성           |
| `src/data/seoul-travel-place-content-localization-review.json` | 주소·태그·운영정보별 번역과 검토 결과   | 검토 배치로 생성           |
| `src/data/seoul-travel-place-review-suggestions.json`          | 원천 변경 장소의 AI 선정 재검토 제안    | 검토 배치로 생성           |
| `src/data/seoul-travel-places.json`                            | 전체 선정 장소 카탈로그 생성 결과       | 빌더로 재생성              |
| `src/data/seoul-travel-place-index.json`                       | 지도·검색·경로 화면용 경량 색인         | 빌더로 재생성              |
| `src/data/seoul-travel-place-details-*.json`                   | 상세 화면에서 지연 로드하는 장소 데이터 | 빌더로 재생성              |
| `src/data/seoul-travel-place-localized-content.json`           | 지연 로드하는 영어·일본어 상세 문구     | 빌더로 재생성              |
| `docs/TRAVEL_PLACE_REVIEW.md`                                  | 전체 검토 결과를 읽기 쉽게 출력한 문서  | 빌더로 재생성              |

`src/data/spots.ts`는 경량 색인을 앱의 장소 타입으로 변환합니다. `src/App.tsx`와 지도·검색·경로 화면은 이 색인을 사용하고, `src/data/publicAttractions.ts`는 상세 화면에서 장소 ID에 맞는 데이터 조각을 지연 로드합니다. 번역 문구는 별도 파일에서 불러옵니다.

공식 홈페이지 주소가 서울시 원천 주소와 다르면 검토 원장의 `locationOverride`에 주소·근거 URL을 기록합니다. 원천 스냅샷은 보존하고, 동기화 스크립트가 지도 후보에 확인된 주소를 적용한 뒤 지오코딩합니다. 빌더는 좌표 데이터의 주소가 보정 주소와 일치할 때만 그 장소를 카탈로그에 포함합니다.

## 상세 정보 AI 조사 배치

상세 정보 보강은 원천 데이터를 덮어쓰지 않고 `src/data/seoul-travel-place-enrichment.json`에 조사값과 필드별 출처를 보존합니다. 앱 카탈로그를 재생성하면 원천 스냅샷과 일치하는 조사값 중 출처 URL이 있는 값만 기존 상세정보 위에 적용합니다. 조사되지 않은 값은 원천 값을 유지합니다. 상세 화면은 보강된 값과 출처 링크, 조사일을 표시하며 방문 전 최신 운영 안내를 확인하도록 안내합니다. 2026-10-25에는 당시 선정 장소 369곳 중 366곳의 보강 결과를 생성했습니다. 이번 원천 갱신 뒤에도 원문 스냅샷과 일치하는 값만 반영됩니다. 이 결과는 사람의 개별 교차 검증을 마친 자료가 아니며, `not_found`는 기존 원천 정보만 유지합니다.

```sh
pnpm enrich:travel-places -- --dry-run
pnpm enrich:travel-places -- --limit 25 --offset 0
pnpm enrich:travel-places -- --limit 25 --offset 25
pnpm test:travel-place-enrichment
```

`--offset`과 `--limit`으로 배치를 나눌 수 있고, `OPENAI_MODEL`로 모델을 지정할 수 있습니다. 응답별 토큰·검색 호출 수·추정 비용을 결과 파일에 기록하며 비용 상한에 가까우면 다음 장소를 처리하지 않습니다. 이 추정 상한은 공급자 측 과금 차단을 대체하지 않습니다. `pnpm build:travel-places`는 조사 파일의 원천 스냅샷이 현재 원천과 일치하는지 확인한 뒤 필드별 출처 URL이 있는 값을 앱 카탈로그에 적용합니다.

## 영어·일본어 장소명 검토 배치

현재 카탈로그에 다국어 장소명이 없는 항목은 앱 데이터와 분리된 `seoul-travel-place-localization-candidates.json`에 1차 후보로 기록합니다. 원래 한국어 이름과 기존 다국어 이름은 보존하며, 이 후보 파일은 앱에서 직접 사용하지 않습니다. API 검토 결과는 `seoul-travel-place-localization-review.json`에 언어별 승인·수정 제안·추가 검토 상태와 토큰 사용량 및 추정 비용으로 누적됩니다. 공식 출처를 추가로 확인한 표기는 같은 파일의 `manualReview`에 근거 URL과 함께 기록하며, 빌더가 AI 제안보다 우선 반영합니다. `brand_preserved`는 공식 일본어 표기를 찾지 못해 확인된 라틴 브랜드명을 그대로 쓰는 상태입니다. 검토 스크립트는 앱 카탈로그를 직접 수정하지 않습니다. 검토 후 `pnpm build:travel-places`를 실행하면 승인·수정된 이름과 근거가 확인된 수동 검토 이름만 생성 카탈로그에 반영합니다. `needs_review`이거나 검토 사유에 표기 불확실성이 드러난 이름은 확정하지 않아 한국어 원문을 표시합니다. 기존에 등록된 다국어 이름은 유지합니다.

```sh
pnpm review:place-localizations -- --dry-run --limit 25 --offset 0
pnpm review:place-localizations -- --limit 25 --offset 0
pnpm review:place-localizations -- --limit 25 --offset 25
```

실행 전 `.env.local`에 `OPENAI_API_KEY`를 설정하고, 필요하면 `OPENAI_MODEL`과 `LOCALIZATION_REVIEW_MAX_SPEND_USD`를 지정합니다. 기본 모델은 `gpt-6-luna`, 실행당 기본 처리량은 25곳, 누적 추정 비용 상한은 $1입니다. `--dry-run`은 API를 호출하지 않습니다. 이 배치는 제공된 한국어 이름과 문맥으로 번역 품질을 검토하며, 장소의 공식 외국어 표기를 웹에서 독립 검증하지는 않습니다.

## 장소 정보 번역 검토 배치

지도 팝업과 상세 화면에 표시하는 주소·태그·운영시간·휴무일·교통 안내·선정 설명은 `src/data/seoul-travel-place-content-localization-review.json`에 별도로 검토 결과를 누적합니다. 장소명 검토 결과와 원문 카탈로그는 덮어쓰지 않습니다. 원문 값의 지문이 현재 카탈로그와 일치하고 언어별 상태가 `approved` 또는 `corrected`인 번역만 빌더가 카탈로그에 반영합니다. `needs_review` 상태인 번역은 표시하지 않고 화면의 현지화된 안내 문구로 대체합니다. 주소가 번역되지 않았을 때는 현지 주소 표기를 보여주며 외부 지도 검색에는 한국어 원문을 사용합니다.

```sh
pnpm review:place-content-localizations -- --dry-run --limit 5 --offset 0
pnpm review:place-content-localizations -- --limit 25 --offset 0
pnpm review:place-content-localizations -- --limit 25 --offset 25
pnpm review:place-content-localizations -- --retry-needs-review --dry-run --limit 25 --offset 0
pnpm review:place-content-localizations -- --retry-needs-review --limit 25 --offset 0
```

실행 전 `.env.local`의 `OPENAI_API_KEY`를 설정합니다. `OPENAI_MODEL`로 모델을 선택하고 `CONTENT_LOCALIZATION_MAX_SPEND_USD`로 누적 추정 비용 상한을 조정할 수 있습니다. 기본 모델은 `gpt-6-luna`, 기본 비용 상한은 $1입니다. 한 API 요청은 5곳이며 태그 개수와 교통 경로 수가 원문과 달라지면 해당 요청 결과를 저장하지 않습니다. `--dry-run`은 API를 호출하지 않습니다.

`--retry-needs-review`는 현재 원문과 지문이 일치하는 보류 항목만 다시 처리합니다. 25곳씩 나눠 반복 실행할 때는 완료된 항목이 목록에서 빠지므로 다음 실행도 `--offset 0`부터 시작합니다. 2차 검토 후에도 원문이 모호한 항목은 자동 승인하지 않습니다.

## 데이터 갱신과 검증

원천 데이터를 갱신하고 선정 결과를 다시 만들 때 다음 순서로 실행합니다.

```sh
pnpm sync:seoul-attractions -- --dry-run
pnpm sync:seoul-attractions
pnpm geocode:seoul-attractions
pnpm build:travel-places
pnpm test:travel-places
```

`--dry-run`은 원천 API를 조회해 기존 스냅샷과 비교하지만 파일은 저장하지 않습니다. 추가·삭제·변경된 항목과 바뀐 필드를 보여주며, 주소가 새로 생기거나 바뀌어 좌표 확인이 필요한 한국어 장소도 따로 표시합니다. 결과를 확인한 뒤 `pnpm sync:seoul-attractions`를 실행해야 스냅샷을 저장합니다.

서울시 공식 API는 HTTP 주소만 제공하므로 기본 동기화는 API 키를 보호하는 HTTPS 프록시가 필요합니다. 사용자가 명시적으로 승인한 단발성 작업에는 `--allow-insecure-http-once`를 함께 지정할 수 있습니다. 이 옵션은 공식 `openapi.seoul.go.kr:8088` 주소에서만 동작하며, API 키가 HTTP로 평문 전송됩니다. 매번 명령에 직접 지정해야 하고 기본 설정으로 저장되지 않습니다.

빌더는 AI를 호출하지 않습니다. 검토 원장에 기록된 판단과 원천·좌표를 대조해 카탈로그와 검토 문서를 결정적으로 생성합니다. 신규 또는 주요 원천 정보가 바뀐 장소는 기존 판단을 그대로 적용하지 않고 검토 대상으로 보류합니다.

원천 변경으로 보류된 장소는 다음 명령으로 AI 재검토 제안을 만들 수 있습니다. 기본 실행은 API를 호출하지 않는 미리보기이며, 실제 API 요청은 최대 20곳씩 나눠 보냅니다. 응답의 장소 수가 맞지 않으면 더 작은 단위로 나눠 재시도합니다.

```sh
pnpm review:travel-place-suitability -- --dry-run --limit 25 --offset 0
pnpm review:travel-place-suitability -- --limit 25 --offset 0
```

제안은 `seoul-travel-place-review-suggestions.json`에 별도 저장하며 선정 원장이나 앱 카탈로그를 자동 변경하지 않습니다. 검토 제안이 기존 정책과 맞는지 확인한 뒤 원장에 반영해야 합니다. 기본 누적 비용 상한은 $1이며 `TRAVEL_PLACE_REVIEW_MAX_SPEND_USD`로 설정합니다. 실행 결과에는 실제 토큰 사용량과 추정 비용을 기록합니다.

지도에 장소를 포함하려면 방문 목적에 맞는다는 판단뿐 아니라 서울 주소와 좌표 대조도 통과해야 합니다. 좌표 범위 검사는 명백한 오류를 찾기 위한 것으로, 정확한 입구나 현재 접근 가능 여부까지 보증하지는 않습니다. 운영시간과 교통 정보는 원천 데이터 기준이므로 실제 방문 전 공식 안내를 확인해야 합니다.

## 커밋 원칙

장소 선정 변경은 판단 원장, 전체 생성 카탈로그, 앱용 색인·상세 조각, 사람이 읽을 수 있는 검토 결과를 함께 커밋합니다. 그래야 앱에 반영된 데이터와 그 판단 근거를 같은 버전에서 검토하고 재현할 수 있습니다. `TRAVEL_PLACE_REVIEW.md`와 `seoul-travel-places.json`, `seoul-travel-place-index.json`, `seoul-travel-place-details-*.json`은 생성 파일이므로 직접 편집하지 말고, 검토 원장을 수정한 뒤 `pnpm build:travel-places`를 실행하세요.

원천 스냅샷이나 좌표 데이터가 바뀌었다면 그 파일도 함께 커밋해야 다음 갱신과 검증을 같은 입력으로 재현할 수 있습니다. 생성 결과가 원장과 일치하는지는 `pnpm test:travel-places`로 확인합니다.
