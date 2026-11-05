import { locales, type Locale } from '../i18n/locales';

import travelCatalog from './seoul-travel-places.json';

export { locales };
export type { Locale };

export const spotCategories = [
  'Culture',
  'Food',
  'Cafe',
  'Nature',
  'Shopping',
  'Experience',
] as const;
export type SpotCategory = (typeof spotCategories)[number];
export type LocalizedText = Record<Locale, string>;

export const spotCategoryLabels: Record<SpotCategory, LocalizedText> = {
  Culture: { ko: '관광명소', en: 'Attraction', ja: '観光地' },
  Cafe: { ko: '카페', en: 'Café', ja: 'カフェ' },
  Food: { ko: '식당', en: 'Restaurant', ja: 'レストラン' },
  Nature: { ko: '자연', en: 'Nature', ja: '自然' },
  Shopping: { ko: '쇼핑', en: 'Shopping', ja: 'ショッピング' },
  Experience: { ko: '체험', en: 'Experience', ja: '体験' },
};

const districtLabels: Record<string, LocalizedText> = {
  종로구: { ko: '종로구', en: 'Jongno-gu', ja: '鍾路区' },
  중구: { ko: '중구', en: 'Jung-gu', ja: '中区' },
  용산구: { ko: '용산구', en: 'Yongsan-gu', ja: '龍山区' },
  성동구: { ko: '성동구', en: 'Seongdong-gu', ja: '城東区' },
  광진구: { ko: '광진구', en: 'Gwangjin-gu', ja: '広津区' },
  동대문구: { ko: '동대문구', en: 'Dongdaemun-gu', ja: '東大門区' },
  중랑구: { ko: '중랑구', en: 'Jungnang-gu', ja: '中浪区' },
  성북구: { ko: '성북구', en: 'Seongbuk-gu', ja: '城北区' },
  강북구: { ko: '강북구', en: 'Gangbuk-gu', ja: '江北区' },
  도봉구: { ko: '도봉구', en: 'Dobong-gu', ja: '道峰区' },
  노원구: { ko: '노원구', en: 'Nowon-gu', ja: '蘆原区' },
  은평구: { ko: '은평구', en: 'Eunpyeong-gu', ja: '恩平区' },
  서대문구: { ko: '서대문구', en: 'Seodaemun-gu', ja: '西大門区' },
  마포구: { ko: '마포구', en: 'Mapo-gu', ja: '麻浦区' },
  양천구: { ko: '양천구', en: 'Yangcheon-gu', ja: '陽川区' },
  강서구: { ko: '강서구', en: 'Gangseo-gu', ja: '江西区' },
  구로구: { ko: '구로구', en: 'Guro-gu', ja: '九老区' },
  금천구: { ko: '금천구', en: 'Geumcheon-gu', ja: '衿川区' },
  영등포구: { ko: '영등포구', en: 'Yeongdeungpo-gu', ja: '永登浦区' },
  동작구: { ko: '동작구', en: 'Dongjak-gu', ja: '銅雀区' },
  관악구: { ko: '관악구', en: 'Gwanak-gu', ja: '冠岳区' },
  서초구: { ko: '서초구', en: 'Seocho-gu', ja: '瑞草区' },
  강남구: { ko: '강남구', en: 'Gangnam-gu', ja: '江南区' },
  송파구: { ko: '송파구', en: 'Songpa-gu', ja: '松坡区' },
  강동구: { ko: '강동구', en: 'Gangdong-gu', ja: '江東区' },
};

function localizeDistrict(value: string): LocalizedText {
  return districtLabels[value] ?? { ko: value, en: value, ja: value };
}

export function getSpotCategoryLabel(category: SpotCategory, locale: Locale) {
  return spotCategoryLabels[category][locale];
}

export type Spot = {
  id: string;
  name: LocalizedText;
  category: SpotCategory;
  district: LocalizedText;
  neighborhood: LocalizedText;
  note: LocalizedText;
  address: string;
  coordinates: [number, number];
  sourceId: string;
  sourceUrl: string;
};

const localize = (value: string): LocalizedText => ({ ko: value, en: value, ja: value });

export const seoulSpots: Spot[] = travelCatalog.places.map((place) => {
  return {
    id: place.id,
    sourceId: place.sourceId,
    name: {
      ...localize(place.name),
      en: place.localizedNames?.en || place.name,
      ja: place.localizedNames?.ja || place.name,
    },
    category: place.category as SpotCategory,
    district: localizeDistrict(place.district),
    neighborhood: localizeDistrict(place.district),
    note: localize(place.tags || place.name),
    address: place.address,
    coordinates: place.coordinates as [number, number],
    sourceUrl: travelCatalog.source.datasetUrl,
  };
});

const spotsById = new Map(
  seoulSpots.map((spot) => {
    const place = travelCatalog.places.find((candidate) => candidate.sourceId === spot.sourceId);
    return [spot.id, { spot, aliases: [spot.sourceId, place?.legacyId].filter(Boolean) }];
  }),
);

export function getSpotById(spotId?: string) {
  if (!spotId) return undefined;
  const directMatch = spotsById.get(spotId);
  if (directMatch) return directMatch.spot;
  return [...spotsById.values()].find(({ aliases }) => aliases.includes(spotId))?.spot;
}
