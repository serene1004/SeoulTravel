import travelCatalog from './seoul-travel-places.json';

export const locales = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof locales)[number];

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
    district: localize(place.district),
    neighborhood: localize(place.district),
    note: localize(place.tags || place.name),
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
