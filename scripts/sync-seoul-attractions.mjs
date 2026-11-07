import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { compareAttractions } from './compare-travel-source.mjs';
import { getSeoulOpenDataBaseUrl } from './seoul-open-data-url.mjs';

const envPath = resolve('.env.local');
const outputPath = resolve('src/data/seoul-open-attractions.json');
const candidateOutputPath = resolve('src/data/seoul-public-attraction-candidates.json');
const datasetUrl = 'https://data.seoul.go.kr/dataList/OA-21050/A/1/datasetView.do';
const pageSize = 1000;
const dryRun = process.argv.includes('--dry-run');
const allowInsecureHttpOnce = process.argv.includes('--allow-insecure-http-once');

function getEnvValue(envText, name) {
  const line = envText.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

function toPublicAttraction(row) {
  return {
    id: row.POST_SN,
    language: row.LANG_CODE_ID,
    name: row.POST_SJ,
    address: row.NEW_ADDRESS || row.ADDRESS,
    tags: row.TAG,
    hours: row.CMMN_USE_TIME,
    closedDays: row.CMMN_RSTDE,
    officialUrl: row.CMMN_HMPG_URL || row.POST_URL,
    transport: row.SUBWAY_INFO,
  };
}

function getDistrict(address) {
  return address?.match(/서울(?:특별시|시)?\s+([가-힣]+구)/)?.[1] ?? null;
}

const envText = await readFile(envPath, 'utf8');
const apiKey = getEnvValue(envText, 'VITE_SEOUL_OPEN_DATA_KEY');
const configuredApiBaseUrl = getEnvValue(envText, 'SEOUL_OPEN_DATA_API_BASE_URL');

if (!apiKey) {
  throw new Error('VITE_SEOUL_OPEN_DATA_KEY is missing from .env.local.');
}
if (!configuredApiBaseUrl) {
  throw new Error(
    'SEOUL_OPEN_DATA_API_BASE_URL must point to an HTTPS proxy; the official endpoint uses unencrypted HTTP.',
  );
}

const apiBaseUrl = new URL(configuredApiBaseUrl);
const secureApiBaseUrl = getSeoulOpenDataBaseUrl(configuredApiBaseUrl, {
  allowInsecureHttpOnce,
});
if (apiBaseUrl.protocol === 'http:') {
  console.error(
    'WARNING: This one-time sync sends the API key over unencrypted HTTP to the official Seoul Open API endpoint.',
  );
}

async function fetchPage(startIndex, endIndex) {
  const response = await fetch(
    `${secureApiBaseUrl}/${apiKey}/json/TbVwAttractions/${startIndex}/${endIndex}/`,
  );
  if (!response.ok) {
    throw new Error(`Seoul Open Data request failed with HTTP ${response.status}.`);
  }

  const body = await response.json();
  const payload = body.TbVwAttractions;
  if (payload?.RESULT?.CODE !== 'INFO-000') {
    throw new Error(
      `Seoul Open Data returned ${payload?.RESULT?.CODE ?? 'an unknown error'}: ${payload?.RESULT?.MESSAGE ?? ''}`,
    );
  }

  return payload;
}

const firstPage = await fetchPage(1, pageSize);
const totalCount = firstPage.list_total_count;
const pages = [firstPage];

for (let startIndex = pageSize + 1; startIndex <= totalCount; startIndex += pageSize) {
  pages.push(await fetchPage(startIndex, Math.min(startIndex + pageSize - 1, totalCount)));
}

const rows = pages.flatMap((page) => page.row);
const previousCatalog = JSON.parse(await readFile(outputPath, 'utf8'));
const existingCandidateCatalog = JSON.parse(await readFile(candidateOutputPath, 'utf8'));
const placeReview = JSON.parse(await readFile('src/data/seoul-travel-place-review.json', 'utf8'));
const existingCoordinates = new Map(
  existingCandidateCatalog.attractions.map((attraction) => [attraction.id, attraction]),
);
const locationOverrides = new Map(
  placeReview.decisions
    .filter((decision) => decision.locationOverride?.address)
    .map((decision) => [decision.sourceId, decision.locationOverride.address.trim()]),
);

const normalizedRows = rows.map(toPublicAttraction);
const koreanAttractions = normalizedRows
  .filter((record) => record.language === 'ko')
  .map((record) => {
    const address = locationOverrides.get(record.id) ?? record.address;
    const previousCoordinate = existingCoordinates.get(record.id);
    const coordinateMatchesAddress = previousCoordinate?.address?.trim() === address?.trim();
    return {
      ...record,
      address,
      district: getDistrict(address),
      placeType: '관광지',
      coordinates: coordinateMatchesAddress ? previousCoordinate.coordinates : null,
      coordinateStatus: coordinateMatchesAddress ? previousCoordinate.coordinateStatus : 'pending',
    };
  });
const catalog = {
  source: {
    name: '서울시 관광 명소',
    datasetUrl,
    serviceName: 'TbVwAttractions',
    license: '공공누리 제1유형 (출처표시, 상업적 이용 및 변경 가능)',
    retrievedAt: new Date().toISOString(),
  },
  totalCount,
  attractions: normalizedRows,
};

const candidateCatalog = {
  source: catalog.source,
  totalCount: koreanAttractions.length,
  coordinatePolicy:
    '공공 관광 명소 원천의 주소를 보존하며, 별도 공공 지오코딩 절차 완료 전에는 지도 마커로 사용하지 않습니다.',
  attractions: koreanAttractions,
};

const changes = compareAttractions(previousCatalog.attractions, normalizedRows);
const coordinateAddressChanges = koreanAttractions
  .filter((attraction) => {
    const previous = existingCoordinates.get(attraction.id);
    return previous?.address?.trim() !== attraction.address?.trim();
  })
  .map(({ id, name, address }) => ({ id, name, address }))
  .sort((left, right) => left.id.localeCompare(right.id, 'en'));

console.log(
  JSON.stringify(
    {
      mode: dryRun ? 'preview' : 'write',
      previousCount: previousCatalog.attractions.length,
      updatedCount: normalizedRows.length,
      added: changes.added,
      changed: changes.changed,
      removed: changes.removed,
      coordinateAddressChanges,
    },
    null,
    2,
  ),
);

if (!dryRun) {
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  await writeFile(candidateOutputPath, `${JSON.stringify(candidateCatalog, null, 2)}\n`, 'utf8');
  console.log(
    `Wrote ${catalog.attractions.length} public records and ${koreanAttractions.length} map candidates.`,
  );
}
