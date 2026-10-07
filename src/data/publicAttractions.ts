import coordinateRecords from './seoul-public-attraction-coordinates.json';
import matchedRecords from './seoul-spot-public-records.json';

import type { SpotCategory } from './spots';

type PublicAttractionRecord = {
  id: string;
  language: string;
  name: string;
  address: string;
  tags: string;
  hours: string;
  closedDays: string;
  officialUrl: string;
  transport: string;
};

type MatchedSpotRecord = {
  spotId: string;
  record: PublicAttractionRecord;
};

type MatchedCatalog = {
  source: {
    datasetUrl: string;
    license: string;
  };
  matches: MatchedSpotRecord[];
};

const catalog = matchedRecords as MatchedCatalog;
export type MapAttraction = {
  id: string;
  name: string;
  address: string;
  district: string | null;
  tags: string;
  hours: string;
  officialUrl: string;
  coordinates: [number, number] | null;
  coordinateStatus: 'geocoded' | 'geocoded_keyword' | 'not_found';
  category: SpotCategory;
};

const mapCandidates = coordinateRecords as unknown as { attractions: MapAttraction[] };

export function getPublicAttractionRecord(spotId: string) {
  return catalog.matches.find((match) => match.spotId === spotId)?.record;
}

export const publicAttractionDataset = catalog.source;
export const publicAttractionMatchCount = catalog.matches.length;
export const mapPublicAttractions = mapCandidates.attractions.filter(
  (attraction): attraction is MapAttraction & { coordinates: [number, number] } =>
    Array.isArray(attraction.coordinates),
);
