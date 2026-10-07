import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const envPath = resolve('.env.local');
const candidatePath = resolve('src/data/seoul-public-attraction-candidates.json');
const outputPath = resolve('src/data/seoul-public-attraction-coordinates.json');
const reviewPath = resolve('src/data/seoul-public-attraction-category-review.json');
const addressEndpoint = 'https://dapi.kakao.com/v2/local/search/address.json';
const keywordEndpoint = 'https://dapi.kakao.com/v2/local/search/keyword.json';

function getEnvValue(envText, name) {
  const line = envText.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

const apiKey = getEnvValue(await readFile(envPath, 'utf8'), 'KAKAO_REST_API_KEY');
if (!apiKey) throw new Error('KAKAO_REST_API_KEY is missing from .env.local.');

const catalog = JSON.parse(await readFile(candidatePath, 'utf8'));
let geocoded = 0;
let keywordGeocoded = 0;
let unresolved = 0;

function addressQuery(address) {
  const withoutDetails = address
    .trim()
    .replace(/^\d{5}\s+/, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutDetails.match(/^(.*?\s\d+(?:-\d+)?)(?=\s|$)/)?.[1] ?? withoutDetails;
}

const categoryRules = [
  { category: 'Cafe', pattern: /카페|커피|coffee|cafe|찻집|다방|tea/g },
  {
    category: 'Culture',
    pattern:
      /박물관|미술관|갤러리|궁|성당|사찰|절|도서관|기념|유적|역사|한옥|전시|공예|공연|학교|대학|극장|서점|교회|성지|문화재/g,
  },
  {
    category: 'Food',
    pattern:
      /맛집|식당|음식|레스토랑|restaurant|푸드|먹거리|제과|빵|치킨|냉면|면옥|과자|분식|떡볶이|만두|호프|맥주|주점|술집|와인|디저트|베이커리|케이크|아이스크림|국밥|고기|구이|한식|중식|일식|양식|피자|버거|라면|찌개|족발|보쌈|칼국수|비빔밥|갈비|삼계탕|죽|포차|감자탕|감자국|뼈찜|순대|설렁탕|불고기|삼겹|닭갈비|곰탕/g,
  },
  {
    category: 'Nature',
    pattern: /공원|숲|한강|호수|생태|수목원|계곡|습지|둘레길|북한산|남산|관악산|인왕산|북악산|도봉산|일자산/g,
  },
];

function classifyAttraction({ name, tags }) {
  const text = `${name} ${tags}`.toLocaleLowerCase('ko');
  const matchesByCategory = categoryRules
    .map((rule) => ({ ...rule, matches: [...new Set(text.match(rule.pattern) ?? [])] }))
    .filter((rule) => rule.matches.length);
  if (matchesByCategory.length) {
    return {
      category: matchesByCategory[0].category,
      matchedKeywords: matchesByCategory[0].matches,
      matchedCategories: matchesByCategory.map((rule) => rule.category),
    };
  }
  return { category: 'Culture', matchedKeywords: [], matchedCategories: [] };
}

async function search(endpoint, query) {
  const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
  });
  const body = await response.json();
  if (Array.isArray(body.documents)) return body.documents[0];
  if (!response.ok) {
    throw new Error(`Kakao request failed: HTTP ${response.status} ${JSON.stringify(body)}.`);
  }
  throw new Error('Kakao response did not include documents.');
}

for (const attraction of catalog.attractions) {
  if (Array.isArray(attraction.coordinates) || attraction.coordinateStatus === 'not_found') continue;

  let result = await search(addressEndpoint, addressQuery(attraction.address));
  if (result) {
    attraction.coordinates = [Number(result.x), Number(result.y)];
    attraction.coordinateStatus = 'geocoded';
    geocoded += 1;
  } else {
    result = await search(keywordEndpoint, `${attraction.name} ${attraction.district ?? '서울'}`);
    if (result) {
      attraction.coordinates = [Number(result.x), Number(result.y)];
      attraction.coordinateStatus = 'geocoded_keyword';
      keywordGeocoded += 1;
    } else {
      attraction.coordinateStatus = 'not_found';
      unresolved += 1;
    }
  }
}

catalog.geocodedAt = new Date().toISOString();
catalog.coordinatePolicy =
  '카카오 주소 검색 결과를 [경도, 위도] WGS84 좌표로 저장합니다. coordinateStatus가 geocoded인 항목은 이름·주소를 검토한 뒤 지도에 사용합니다.';
await writeFile(candidatePath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
const classifiedAttractions = catalog.attractions
  .filter((attraction) => Array.isArray(attraction.coordinates))
  .map((attraction) => ({ attraction, classification: classifyAttraction(attraction) }));
const coordinateCatalog = {
  source: catalog.source,
  geocodedAt: catalog.geocodedAt,
  totalCount: classifiedAttractions.length,
  attractions: classifiedAttractions.map(({ attraction, classification }) => ({
      id: attraction.id,
      name: attraction.name,
      address: attraction.address,
      district: attraction.district,
      tags: attraction.tags,
      hours: attraction.hours,
      officialUrl: attraction.officialUrl,
      coordinates: attraction.coordinates,
      coordinateStatus: attraction.coordinateStatus,
      category: classification.category,
    })),
};
await writeFile(outputPath, `${JSON.stringify(coordinateCatalog, null, 2)}\n`, 'utf8');
const reviewCatalog = {
  source: catalog.source,
  reviewedAt: new Date().toISOString(),
  criteria: categoryRules.map(({ category, pattern }) => ({ category, keywords: pattern.source })),
  records: classifiedAttractions.map(({ attraction, classification }) => ({
    id: attraction.id,
    name: attraction.name,
    tags: attraction.tags,
    category: classification.category,
    matchedKeywords: classification.matchedKeywords,
    matchedCategories: classification.matchedCategories,
    needsReview: classification.matchedCategories.length !== 1,
  })),
};
await writeFile(reviewPath, `${JSON.stringify(reviewCatalog, null, 2)}\n`, 'utf8');
console.log(`Geocoded ${geocoded} by address, ${keywordGeocoded} by keyword; ${unresolved} addresses were not found.`);
console.log(`Wrote ${classifiedAttractions.length} category reviews; ${reviewCatalog.records.filter((record) => record.needsReview).length} need review.`);
