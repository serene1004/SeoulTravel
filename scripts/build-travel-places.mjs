import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const categories = ['Culture', 'Nature', 'Food', 'Cafe', 'Shopping', 'Experience'];
const districts = new Set(
  '강남구 강동구 강북구 강서구 관악구 광진구 구로구 금천구 노원구 도봉구 동대문구 동작구 마포구 서대문구 서초구 성동구 성북구 송파구 양천구 영등포구 용산구 은평구 종로구 중구 중랑구'.split(
    ' ',
  ),
);
const outsideSeoulMarkers =
  /(?:^|\s)(?:경기도?|인천(?:광역시|시)?|부산(?:광역시|시)?|대구(?:광역시|시)?|광주(?:광역시|시)?|대전(?:광역시|시)?|울산(?:광역시|시)?|세종(?:특별자치시|시)?|강원(?:특별자치도|도)?|충청북도|충청남도|전라북도|전라남도|경상북도|경상남도|제주(?:특별자치도|도)?)(?:\s|$)/;

export function recordFingerprint(record) {
  const fields = [
    'id',
    'language',
    'name',
    'address',
    'tags',
    'hours',
    'closedDays',
    'officialUrl',
    'transport',
  ];
  return createHash('sha256')
    .update(JSON.stringify(fields.map((key) => record[key] ?? '')))
    .digest('hex');
}

export function buildTravelPlaces(
  raw,
  coordinates,
  review,
  enrichment = { schemaVersion: 1, entries: [] },
) {
  if (review.schemaVersion !== 1) throw new Error('Unsupported review schema.');
  if (enrichment.schemaVersion !== 1) throw new Error('Unsupported enrichment schema.');
  const records = raw.attractions.filter((record) => record.language === 'ko');
  const sourceIds = new Set(records.map((record) => record.id));
  if (sourceIds.size !== records.length) throw new Error('Duplicate Korean source IDs.');
  const enrichmentById = new Map();
  for (const entry of enrichment.entries) {
    if (enrichmentById.has(entry.sourceId))
      throw new Error(`Duplicate enrichment: ${entry.sourceId}`);
    enrichmentById.set(entry.sourceId, entry);
  }
  const decisions = new Map();
  for (const decision of review.decisions) {
    if (decisions.has(decision.sourceId)) throw new Error(`Duplicate review: ${decision.sourceId}`);
    if (!['include', 'exclude', 'review'].includes(decision.decision) || !decision.reason?.trim()) {
      throw new Error(`Invalid review: ${decision.sourceId}`);
    }
    if (decision.decision === 'include' && !categories.includes(decision.category)) {
      throw new Error(`Invalid category: ${decision.sourceId}`);
    }
    if (
      decision.duplicateOf &&
      (!sourceIds.has(decision.duplicateOf) ||
        decision.duplicateOf === decision.sourceId ||
        decision.decision !== 'exclude')
    ) {
      throw new Error(`Invalid duplicate target: ${decision.sourceId}`);
    }
    decisions.set(decision.sourceId, decision);
  }
  const coordinateById = new Map(coordinates.attractions.map((record) => [record.id, record]));
  if (coordinateById.size !== coordinates.attractions.length)
    throw new Error('Duplicate coordinate IDs.');
  const places = [];
  const results = records.map((record) => {
    const decision = decisions.get(record.id);
    const coordinate = coordinateById.get(record.id);
    let outcome = decision?.decision ?? 'review';
    let reason = decision?.reason ?? '새 원천 항목: AI 적합성 검토가 필요합니다.';
    if (decision && decision.inputFingerprint !== recordFingerprint(record)) {
      outcome = 'review';
      reason = '원천 정보 변경: 이전 판단을 재사용하지 않고 다시 검토합니다.';
    }
    if (
      outcome === 'include' &&
      !/서울(?:특별시|시)?/.test(record.address) &&
      outsideSeoulMarkers.test(record.address)
    ) {
      outcome = 'exclude';
      reason =
        '원천 주소에서 서울 밖의 시·도 지역이 확인되어 서울 여행 데이터 범위에서 제외합니다.';
    }
    if (outcome === 'include') {
      if (!districts.has(coordinate?.district) || !record.address.includes(coordinate.district)) {
        outcome = 'review';
        reason = '서울 내 주소와 자치구를 확인해야 합니다.';
      } else if (coordinate.address !== record.address || coordinate.name !== record.name) {
        outcome = 'review';
        reason = '좌표를 생성한 이름·주소가 현재 원천과 다릅니다.';
      } else if (
        coordinate.coordinateStatus !== 'geocoded' ||
        !Array.isArray(coordinate.coordinates) ||
        coordinate.coordinates.length !== 2 ||
        !coordinate.coordinates.every(Number.isFinite) ||
        coordinate.coordinates[0] < 126.7 ||
        coordinate.coordinates[0] > 127.25 ||
        coordinate.coordinates[1] < 37.4 ||
        coordinate.coordinates[1] > 37.72
      ) {
        outcome = 'review';
        reason = '좌표 미해결·키워드 검색·서울 범위 밖 좌표: 위치 검토가 필요합니다.';
      }
    }
    if (outcome === 'include') {
      const candidateEnrichment = enrichmentById.get(record.id);
      const enrichmentFields = ['address', 'hours', 'closedDays', 'transport', 'officialUrl'];
      const currentSnapshotMatches =
        candidateEnrichment &&
        enrichmentFields.every(
          (field) =>
            (candidateEnrichment.current?.[field] ?? null) ===
            ((field === 'address' ? record[field]?.trim() : record[field]) || null),
        );
      const placeEnrichment = currentSnapshotMatches ? candidateEnrichment : undefined;
      const enrichedValue = (field) => {
        const suggestion = placeEnrichment?.fields?.[field];
        return suggestion?.value && suggestion.sourceUrl ? suggestion.value : record[field];
      };
      const enrichedFields = Object.fromEntries(
        enrichmentFields
          .map((field) => [field, placeEnrichment?.fields?.[field]])
          .filter(([, field]) => field?.value && field.sourceUrl),
      );
      places.push({
        id: `seoul-attraction-${record.id}`,
        sourceId: record.id,
        name: record.name.trim(),
        ...(decision.localizedNames ? { localizedNames: decision.localizedNames } : {}),
        ...(decision.legacyId ? { legacyId: decision.legacyId } : {}),
        category: decision.category,
        placeType: decision.placeType,
        address: enrichedValue('address').trim(),
        district: coordinate.district,
        coordinates: coordinate.coordinates,
        coordinateStatus: coordinate.coordinateStatus,
        tags: record.tags,
        hours: enrichedValue('hours'),
        closedDays: enrichedValue('closedDays'),
        officialUrl: enrichedValue('officialUrl'),
        transport: enrichedValue('transport'),
        ...(Object.keys(enrichedFields).length
          ? {
              enrichedInfo: {
                researchedAt: placeEnrichment.researchedAt,
                fields: enrichedFields,
              },
            }
          : {}),
        curationReason: decision.reason,
        reviewedAt: decision.reviewedAt,
        evidenceUrls: decision.evidenceUrls ?? [],
        operatingStatus: decision.operatingStatus ?? 'unverified',
      });
    }
    return {
      sourceId: record.id,
      name: record.name.trim(),
      decision: outcome,
      category: decision?.category ?? null,
      reason,
      duplicateOf: decision?.duplicateOf ?? null,
    };
  });
  return {
    schemaVersion: 1,
    source: raw.source,
    policyVersion: review.policyVersion,
    reviewedAt: review.reviewedAt,
    scope:
      '서울 여행 방문 목적에 대한 AI 적합성 검토. 모든 장소의 현재 영업·개방·좌표 정확성을 보증하지 않습니다.',
    categories,
    summary: {
      sourceRecords: records.length,
      included: places.length,
      excluded: results.filter((record) => record.decision === 'exclude').length,
      needsReview: results.filter((record) => record.decision === 'review').length,
      retiredReviewIds: [...decisions.keys()].filter((id) => !sourceIds.has(id)),
    },
    places,
    results,
  };
}

async function main() {
  const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const raw = await readJson('src/data/seoul-open-attractions.json');
  const coordinates = await readJson('src/data/seoul-public-attraction-coordinates.json');
  const review = await readJson('src/data/seoul-travel-place-review.json');
  const enrichment = await readJson('src/data/seoul-travel-place-enrichment.json');
  const { results, ...catalog } = buildTravelPlaces(raw, coordinates, review, enrichment);
  await writeFile('src/data/seoul-travel-places.json', `${JSON.stringify(catalog, null, 2)}\n`);
  const counts = catalog.summary;
  const escape = (value) =>
    String(value ?? '')
      .replaceAll('|', '／')
      .replaceAll(/\r?\n/g, ' ');
  const report = [
    '# 서울 여행 장소 검토 결과',
    '',
    `검토일: ${review.reviewedAt}. 정책: ${review.policyVersion}. 원천 수집일: ${raw.source.retrievedAt}.`,
    '',
    `한국어 원천 ${counts.sourceRecords}건 → 지도 데이터 ${counts.included}건 / 제외 ${counts.excluded}건 / 추가 확인 ${counts.needsReview}건.`,
    '',
    '이 파일은 `pnpm build:travel-places`로 생성합니다. 판단 수정은 `src/data/seoul-travel-place-review.json`에서 합니다.',
    '',
    'AI가 원천 이름·태그·주소·운영 안내를 읽고 방문 목적을 분류한 결과입니다. 명시된 외부 근거가 있는 일부 항목만 웹 확인했으며, 전체 영업·개방 여부를 검증한 목록은 아닙니다. 지도·검색·상세 화면은 이 선정 데이터셋만 사용합니다.',
    '',
    '## 지도 데이터',
    '',
    '| 원천 ID | 장소 | 카테고리 | 판단 근거 |',
    '| --- | --- | --- | --- |',
    ...results
      .filter((record) => record.decision === 'include')
      .map(
        (record) =>
          `| ${record.sourceId} | ${escape(record.name)} | ${record.category} | ${escape(record.reason)} |`,
      ),
    '',
    '## 추가 확인 — 지도 데이터에서 보류',
    '',
    '| 원천 ID | 장소 | 보류 이유 |',
    '| --- | --- | --- |',
    ...results
      .filter((record) => record.decision === 'review')
      .map(
        (record) => `| ${record.sourceId} | ${escape(record.name)} | ${escape(record.reason)} |`,
      ),
    '',
    '## 제외 — 원천 보존',
    '',
    '| 원천 ID | 장소 | 제외 이유 | 중복 대표 ID |',
    '| --- | --- | --- | --- |',
    ...results
      .filter((record) => record.decision === 'exclude')
      .map(
        (record) =>
          `| ${record.sourceId} | ${escape(record.name)} | ${escape(record.reason)} | ${record.duplicateOf ?? ''} |`,
      ),
    '',
  ].join('\n');
  await writeFile('docs/TRAVEL_PLACE_REVIEW.md', report);
  console.log(JSON.stringify(counts, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
