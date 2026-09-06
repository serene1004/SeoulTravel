import matchedRecords from './seoul-spot-public-records.json';

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

export function getPublicAttractionRecord(spotId: string) {
  return catalog.matches.find((match) => match.spotId === spotId)?.record;
}

export const publicAttractionDataset = catalog.source;
export const publicAttractionMatchCount = catalog.matches.length;
