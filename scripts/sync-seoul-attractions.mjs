import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const envPath = resolve('.env.local');
const outputPath = resolve('src/data/seoul-open-attractions.json');
const candidateOutputPath = resolve('src/data/seoul-public-attraction-candidates.json');
const seedPath = resolve('src/data/seoul-spots.json');
const matchOutputPath = resolve('src/data/seoul-spot-public-records.json');
const datasetUrl = 'https://data.seoul.go.kr/dataList/OA-21050/A/1/datasetView.do';
const apiBaseUrl = 'http://openapi.seoul.go.kr:8088';
const pageSize = 1000;

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

if (!apiKey) {
  throw new Error('VITE_SEOUL_OPEN_DATA_KEY is missing from .env.local.');
}

async function fetchPage(startIndex, endIndex) {
  const response = await fetch(
    `${apiBaseUrl}/${apiKey}/json/TbVwAttractions/${startIndex}/${endIndex}/`,
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
const seedCatalog = JSON.parse(await readFile(seedPath, 'utf8'));

function normalizeName(value) {
  return value.replace(/[\s·()-]/g, '').toLocaleLowerCase('ko');
}

const normalizedRows = rows.map(toPublicAttraction);
const koreanAttractions = normalizedRows
  .filter((record) => record.language === 'ko')
  .map((record) => ({
    ...record,
    district: getDistrict(record.address),
    placeType: '관광지',
    coordinates: null,
    coordinateStatus: 'pending',
  }));
const matches = seedCatalog.spots.flatMap((spot) => {
  const sourceRecord = normalizedRows.find(
    (record) => normalizeName(record.name) === normalizeName(spot.name.ko),
  );
  return sourceRecord ? [{ spotId: spot.id, record: sourceRecord }] : [];
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

const matchedCatalog = {
  source: catalog.source,
  matchedAt: catalog.source.retrievedAt,
  matches,
};

const candidateCatalog = {
  source: catalog.source,
  totalCount: koreanAttractions.length,
  coordinatePolicy:
    '공공 관광 명소 원천의 주소를 보존하며, 별도 공공 지오코딩 절차 완료 전에는 지도 마커로 사용하지 않습니다.',
  attractions: koreanAttractions,
};

await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
await writeFile(matchOutputPath, `${JSON.stringify(matchedCatalog, null, 2)}\n`, 'utf8');
await writeFile(candidateOutputPath, `${JSON.stringify(candidateCatalog, null, 2)}\n`, 'utf8');
console.log(
  `Wrote ${catalog.attractions.length} public records, ${koreanAttractions.length} map candidates, and ${matches.length} matched map spots.`,
);
