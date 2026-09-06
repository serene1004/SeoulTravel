import spotCatalog from './seoul-spots.json';

export const locales = ['ko', 'en', 'ja'] as const;
export type Locale = (typeof locales)[number];

export const spotCategories = ['Culture', 'Cafe', 'Food', 'Nature'] as const;
export type SpotCategory = (typeof spotCategories)[number];
export type LocalizedText = Record<Locale, string>;

export const spotCategoryLabels: Record<SpotCategory, LocalizedText> = {
  Culture: { ko: '관광명소', en: 'Attraction', ja: '観光地' },
  Cafe: { ko: '카페', en: 'Café', ja: 'カフェ' },
  Food: { ko: '식당', en: 'Restaurant', ja: 'レストラン' },
  Nature: { ko: '자연', en: 'Nature', ja: '自然' },
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
  minutes: number;
  coordinates: [number, number];
  dataSourceId: string;
  sourceUrl: string;
};

type SpotCatalog = {
  schemaVersion: number;
  updatedAt: string;
  sourcePolicy: string;
  spots: Spot[];
};

// JSON imports do not preserve tuple literals, so this is the typed catalog boundary.
export const seoulSpotCatalog = spotCatalog as unknown as SpotCatalog;
export const seoulSpots = seoulSpotCatalog.spots;

export function getSpotById(spotId?: string) {
  return seoulSpots.find((spot) => spot.id === spotId);
}
