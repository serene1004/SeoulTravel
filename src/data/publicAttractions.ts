import travelCatalog from './seoul-travel-places.json';
import { getSpotById } from './spots';

export function getPublicAttractionRecord(spotId: string) {
  const spot = getSpotById(spotId);
  return spot ? travelCatalog.places.find((place) => place.id === spot.id) : undefined;
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
