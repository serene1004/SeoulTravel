import travelCatalog from './seoul-travel-place-index.json';
import { getSpotById, type Locale } from './spots';

export type PublicAttractionRecord =
  (typeof import('./seoul-travel-places.json'))['places'][number];

type PlaceDetailShard = { places: PublicAttractionRecord[] };

type LocalizedPlaceContent = Partial<
  Record<
    Locale,
    Partial<
      Record<'address' | 'tags' | 'hours' | 'closedDays' | 'transport' | 'curationReason', string>
    >
  >
>;
export type LocalizedPlaceContentMap = Record<string, LocalizedPlaceContent>;

const placeDetailShardLoaders = import.meta.glob<{ default: PlaceDetailShard }>(
  './seoul-travel-place-details-*.json',
);

export async function loadPublicAttractionRecord(spotId: string) {
  const spot = getSpotById(spotId);
  if (!spot) return undefined;

  const sourceId = Number(spot.sourceId);
  const shardCount = travelCatalog.detailShardCount;
  if (
    !Number.isInteger(sourceId) ||
    sourceId < 0 ||
    !Number.isInteger(shardCount) ||
    shardCount < 1
  ) {
    return undefined;
  }

  const shardIndex = sourceId % shardCount;
  const loadShard = placeDetailShardLoaders[`./seoul-travel-place-details-${shardIndex}.json`];
  if (!loadShard) throw new Error(`Missing generated place detail shard: ${shardIndex}`);

  const { default: shard } = await loadShard();
  return shard.places.find((place) => place.id === spot.id);
}

export async function loadLocalizedPlaceContents(): Promise<LocalizedPlaceContentMap> {
  const { default: localizedContent } = await import('./seoul-travel-place-localized-content.json');
  return Object.fromEntries(
    localizedContent.entries.map(({ id, ...content }) => [id, content]),
  ) as LocalizedPlaceContentMap;
}

export const publicAttractionDataset = travelCatalog.source;

export function getOfficialPlaceUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value.startsWith('www.') ? `https://${value}` : value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
