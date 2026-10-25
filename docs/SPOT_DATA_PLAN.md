# 서울 장소 데이터와 지도

이 문서는 현재 장소 데이터의 흐름과 관리 방법을 안내합니다. 지도에 넣을 장소의 세부 선정 기준은 [장소 선정 정책](TRAVEL_PLACE_POLICY.md), 항목별 판단 결과는 [장소 검토 결과](TRAVEL_PLACE_REVIEW.md)를 참고하세요.

## 현재 데이터 흐름

지도·검색·카테고리 필터·장소 상세 화면은 `src/data/seoul-travel-places.json` 하나를 공통으로 사용합니다. 이 파일은 직접 편집하지 않는 생성 결과이며, 장소 선정·좌표 검사 결과에 상세정보 보강값을 합칩니다.

| 파일                                                | 역할                                   | 수정 방법              |
| --------------------------------------------------- | -------------------------------------- | ---------------------- |
| `src/data/seoul-open-attractions.json`              | 서울시 관광 명소 원천 스냅샷           | 동기화 명령으로 갱신   |
| `src/data/seoul-public-attraction-coordinates.json` | 원천 장소의 좌표와 주소 대조 정보      | 지오코딩 명령으로 갱신 |
| `src/data/seoul-travel-place-review.json`           | 장소별 포함·제외·보류 판단과 근거      | 판단을 수정할 때 편집  |
| `src/data/seoul-travel-place-enrichment.json`       | 주소·운영시간·교통·공식 링크와 출처    | 조사 결과를 보존       |
| `src/data/seoul-travel-places.json`                 | 앱에서 사용하는 선정 장소 카탈로그     | 빌더로 재생성          |
| `docs/TRAVEL_PLACE_REVIEW.md`                       | 전체 검토 결과를 읽기 쉽게 출력한 문서 | 빌더로 재생성          |

`src/data/spots.ts`는 카탈로그를 앱의 장소 타입으로 변환합니다. `src/App.tsx`의 지도와 탐색 화면, `src/data/publicAttractions.ts`와 장소 상세 화면도 같은 카탈로그를 참조합니다. 기존 장소 카탈로그 파일을 별도로 합산하지 않습니다.

## 상세 정보 AI 조사 배치

상세 정보 보강은 원천 데이터를 덮어쓰지 않고 `src/data/seoul-travel-place-enrichment.json`에 조사값과 필드별 출처를 보존합니다. 앱 카탈로그를 재생성하면 원천 스냅샷과 일치하는 조사값 중 출처 URL이 있는 값만 기존 상세정보 위에 적용합니다. 조사되지 않은 값은 원천 값을 유지합니다. 상세 화면은 보강된 값과 출처 링크, 조사일을 표시하며 방문 전 최신 운영 안내를 확인하도록 안내합니다. 사용자 승인에 따라 현재 366개 후보의 보강 결과를 앱에 적용했습니다. 이 결과는 사람의 개별 교차 검증을 마친 자료가 아니며, `not_found`는 기존 원천 정보만 유지합니다.

```sh
pnpm enrich:travel-places -- --dry-run
pnpm enrich:travel-places -- --limit 25 --offset 0
pnpm enrich:travel-places -- --limit 25 --offset 25
pnpm test:travel-place-enrichment
```

`--offset`과 `--limit`으로 배치를 나눌 수 있고, `OPENAI_MODEL`로 모델을 지정할 수 있습니다. 응답별 토큰·검색 호출 수·추정 비용을 결과 파일에 기록하며 비용 상한에 가까우면 다음 장소를 처리하지 않습니다. 이 추정 상한은 공급자 측 과금 차단을 대체하지 않습니다. `pnpm build:travel-places`는 조사 파일의 원천 스냅샷이 현재 원천과 일치하는지 확인한 뒤 필드별 출처 URL이 있는 값을 앱 카탈로그에 적용합니다.

## 데이터 갱신과 검증

원천 데이터를 갱신하고 선정 결과를 다시 만들 때 다음 순서로 실행합니다.

```sh
pnpm sync:seoul-attractions
pnpm geocode:seoul-attractions
pnpm build:travel-places
pnpm test:travel-places
```

빌더는 AI를 호출하지 않습니다. 검토 원장에 기록된 판단과 원천·좌표를 대조해 카탈로그와 검토 문서를 결정적으로 생성합니다. 신규 또는 주요 원천 정보가 바뀐 장소는 기존 판단을 그대로 적용하지 않고 검토 대상으로 보류합니다.

지도에 장소를 포함하려면 방문 목적에 맞는다는 판단뿐 아니라 서울 주소와 좌표 대조도 통과해야 합니다. 좌표 범위 검사는 명백한 오류를 찾기 위한 것으로, 정확한 입구나 현재 접근 가능 여부까지 보증하지는 않습니다. 운영시간과 교통 정보는 원천 데이터 기준이므로 실제 방문 전 공식 안내를 확인해야 합니다.

## 커밋 원칙

장소 선정 변경은 판단 원장, 생성된 카탈로그, 사람이 읽을 수 있는 검토 결과를 함께 커밋합니다. 그래야 앱에 반영된 데이터와 그 판단 근거를 같은 버전에서 검토하고 재현할 수 있습니다. `TRAVEL_PLACE_REVIEW.md`와 `seoul-travel-places.json`은 생성 파일이므로 직접 편집하지 말고, 검토 원장을 수정한 뒤 `pnpm build:travel-places`를 실행하세요.

원천 스냅샷이나 좌표 데이터가 바뀌었다면 그 파일도 함께 커밋해야 다음 갱신과 검증을 같은 입력으로 재현할 수 있습니다. 생성 결과가 원장과 일치하는지는 `pnpm test:travel-places`로 확인합니다.
