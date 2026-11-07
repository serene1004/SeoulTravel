import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildPlaceDetailShards,
  buildPlaceIndex,
  buildTravelPlaces,
  recordFingerprint,
} from './build-travel-places.mjs';
import { fingerprint } from './review-place-content-localizations.mjs';

const read = (name) => JSON.parse(readFileSync(`src/data/${name}.json`, 'utf8'));
const raw = read('seoul-open-attractions');
const coordinates = read('seoul-public-attraction-coordinates');
const review = read('seoul-travel-place-review');
const enrichment = read('seoul-travel-place-enrichment');
const localizationReview = read('seoul-travel-place-localization-review');
const contentLocalizationReview = read('seoul-travel-place-content-localization-review');

test('every Korean source has a current explicit review and the generated catalog is reproducible', () => {
  const records = raw.attractions.filter((record) => record.language === 'ko');
  assert.equal(review.decisions.length, records.length);
  for (const record of records) {
    assert.equal(
      review.decisions.find((decision) => decision.sourceId === record.id)?.inputFingerprint,
      recordFingerprint(record),
    );
  }
  const { results, ...catalog } = buildTravelPlaces(
    raw,
    coordinates,
    review,
    enrichment,
    localizationReview,
    contentLocalizationReview,
  );
  const appCatalog = {
    ...catalog,
    places: catalog.places.map((place) =>
      Object.fromEntries(Object.entries(place).filter(([key]) => key !== 'localizedInfo')),
    ),
  };
  const localizedContent = {
    schemaVersion: 1,
    entries: catalog.places.flatMap(({ id, localizedInfo }) =>
      localizedInfo ? [{ id, ...localizedInfo }] : [],
    ),
  };
  assert.deepEqual(appCatalog, read('seoul-travel-places'));
  assert.deepEqual(buildPlaceIndex(appCatalog), read('seoul-travel-place-index'));
  for (const [index, shard] of buildPlaceDetailShards(appCatalog).entries()) {
    assert.deepEqual(shard, read(`seoul-travel-place-details-${index}`));
  }
  assert.deepEqual(localizedContent, read('seoul-travel-place-localized-content'));
  assert.equal(
    results.length,
    catalog.summary.included + catalog.summary.excluded + catalog.summary.needsReview,
  );
  assert.equal(new Set(catalog.places.map((place) => place.id)).size, catalog.places.length);
  for (const id of ['72', '8646', '42288', '23561', '35015', '1789']) {
    assert.ok(
      catalog.places.some((place) => place.sourceId === id),
      `Missing travel purpose: ${id}`,
    );
  }
  for (const id of [
    '46447',
    '49295',
    '27814',
    '15109',
    '252',
    '35405',
    '50129',
    '3452',
    '7162',
    '49356',
  ]) {
    assert.ok(
      !catalog.places.some((place) => place.sourceId === id),
      `Unexpected destination: ${id}`,
    );
  }
});

test('only current approved content translations enter the generated catalog', () => {
  const catalogPlace = read('seoul-travel-places').places.find(
    (place) => place.sourceId === '53539',
  );
  const fields = ['address', 'tags', 'hours', 'closedDays', 'transport', 'curationReason'];
  const source = Object.fromEntries(fields.map((field) => [field, catalogPlace[field] || '']));
  const entry = {
    id: catalogPlace.id,
    sourceFingerprint: fingerprint(source),
    source,
    review: {
      en: {
        status: 'approved',
        reason: 'Reviewed against the supplied Korean source.',
        fields: Object.fromEntries(
          fields.map((field) => [field, source[field] ? `English ${field}` : '']),
        ),
      },
      ja: {
        status: 'needs_review',
        reason: 'The route wording needs a native review.',
        fields: Object.fromEntries(
          fields.map((field) => [field, source[field] ? `日本語${field}` : '']),
        ),
      },
    },
  };
  const reviewData = { schemaVersion: 1, entries: [entry] };
  const result = buildTravelPlaces(
    raw,
    coordinates,
    review,
    enrichment,
    localizationReview,
    reviewData,
  );
  const translated = result.places.find((place) => place.sourceId === '53539');
  assert.equal(translated.localizedInfo.en.hours, 'English hours');
  assert.equal(translated.localizedInfo.ja, undefined);

  const stale = structuredClone(reviewData);
  stale.entries[0].source.tags = 'changed source';
  const staleResult = buildTravelPlaces(
    raw,
    coordinates,
    review,
    enrichment,
    localizationReview,
    stale,
  );
  assert.equal(
    staleResult.places.find((place) => place.sourceId === '53539').localizedInfo,
    undefined,
  );

  const invalid = structuredClone(reviewData);
  invalid.entries[0].review.en.fields.tags = '';
  assert.throws(
    () => buildTravelPlaces(raw, coordinates, review, enrichment, localizationReview, invalid),
    /Invalid en content localization/,
  );
});

test('verified localizations override AI review while uncertain names stay omitted', () => {
  const decision = review.decisions.find(
    (item) => item.decision === 'include' && !item.localizedNames,
  );
  const record = raw.attractions.find(
    (item) => item.id === decision.sourceId && item.language === 'ko',
  );
  const secondDecision = review.decisions.find(
    (item) =>
      item.decision === 'include' && !item.localizedNames && item.sourceId !== decision.sourceId,
  );
  const secondRecord = raw.attractions.find(
    (item) => item.id === secondDecision.sourceId && item.language === 'ko',
  );
  const thirdDecision = review.decisions.find(
    (item) =>
      item.decision === 'include' &&
      !item.localizedNames &&
      item.sourceId !== decision.sourceId &&
      item.sourceId !== secondDecision.sourceId,
  );
  const thirdRecord = raw.attractions.find(
    (item) => item.id === thirdDecision.sourceId && item.language === 'ko',
  );
  const localization = {
    schemaVersion: 1,
    entries: [
      {
        id: `seoul-attraction-${record.id}`,
        sourceName: record.name.trim(),
        review: {
          en: {
            status: 'approved',
            suggestion: 'Uncertain name',
            reason: 'The official spelling is uncertain.',
          },
          ja: { status: 'corrected', suggestion: '修正された名称' },
        },
      },
      {
        id: `seoul-attraction-${secondRecord.id}`,
        sourceName: secondRecord.name.trim(),
        review: {
          en: { status: 'needs_review', suggestion: 'Uncertain name' },
          ja: { status: 'approved', suggestion: '承認された名称' },
        },
      },
      {
        id: `seoul-attraction-${thirdRecord.id}`,
        sourceName: thirdRecord.name.trim(),
        review: {
          en: { status: 'needs_review', suggestion: 'Uncertain name' },
          ja: { status: 'approved', suggestion: '承認された名称' },
        },
        manualReview: {
          en: {
            status: 'verified',
            suggestion: 'Verified official name',
            sourceUrls: ['https://example.com/official'],
          },
        },
      },
    ],
  };
  const result = buildTravelPlaces(raw, coordinates, review, enrichment, localization);
  const place = result.places.find((item) => item.sourceId === record.id);
  assert.equal(place.localizedNames.en, undefined);
  assert.equal(place.localizedNames.ja, '修正された名称');
  const secondPlace = result.places.find((item) => item.sourceId === secondRecord.id);
  assert.equal(secondPlace.localizedNames.en, undefined);
  assert.equal(secondPlace.localizedNames.ja, '承認された名称');
  const thirdPlace = result.places.find((item) => item.sourceId === thirdRecord.id);
  assert.equal(thirdPlace.localizedNames.en, 'Verified official name');

  const duplicate = structuredClone(localization);
  duplicate.entries.push(duplicate.entries[0]);
  assert.throws(
    () => buildTravelPlaces(raw, coordinates, review, enrichment, duplicate),
    /Duplicate localization review/,
  );
});

test('verified address overrides require matching geocoded addresses and supersede old enrichment', () => {
  const nextReview = structuredClone(review);
  const decision = nextReview.decisions.find((item) => item.sourceId === '46391');
  const address = '서울특별시 종로구 사직로10길 4 (필운동)';
  decision.locationOverride = {
    address,
    evidenceUrl: 'https://www.mosoon.co/',
    reviewedAt: '2026-11-07',
  };

  const nextCoordinates = structuredClone(coordinates);
  const coordinate = nextCoordinates.attractions.find((item) => item.id === '46391');
  coordinate.address = address;
  coordinate.district = '종로구';
  const result = buildTravelPlaces(raw, nextCoordinates, nextReview, enrichment);
  const place = result.places.find((item) => item.sourceId === '46391');
  assert.equal(place.address, address);
  assert.equal(place.district, '종로구');
  assert.equal(place.enrichedInfo.fields.address, undefined);

  const staleCoordinates = structuredClone(coordinates);
  const staleCoordinate = staleCoordinates.attractions.find((item) => item.id === '46391');
  staleCoordinate.address = raw.attractions.find((item) => item.id === '46391').address;
  const mismatched = buildTravelPlaces(raw, staleCoordinates, nextReview, enrichment);
  assert.equal(mismatched.results.find((item) => item.sourceId === '46391').decision, 'review');
  assert.ok(!mismatched.places.some((item) => item.sourceId === '46391'));
});

test('places marked closed by the review ledger are excluded from the map catalog', () => {
  const result = buildTravelPlaces(raw, coordinates, review, enrichment, localizationReview);
  assert.ok(!result.places.some((item) => item.sourceId === '28330'));
  assert.equal(result.results.find((item) => item.sourceId === '28330').decision, 'exclude');
  assert.match(result.results.find((item) => item.sourceId === '28330').reason, /\[Closed\]/);
});

test('new and changed source records require review instead of inheriting publication', () => {
  const next = structuredClone(raw);
  const record = next.attractions.find((item) => item.id === '72' && item.language === 'ko');
  record.hours = '관람 중단';
  next.attractions.push({ ...record, id: 'new-place' });
  const result = buildTravelPlaces(next, coordinates, review);
  for (const id of ['72', 'new-place']) {
    assert.equal(result.results.find((item) => item.sourceId === id).decision, 'review');
    assert.ok(!result.places.some((place) => place.sourceId === id));
  }
});

test('unknown, invalid, non-Seoul and mismatched coordinates cannot enter the dataset', () => {
  for (const patch of [
    { coordinateStatus: 'geocoded_keyword' },
    { coordinates: [NaN, 37.5] },
    { coordinates: [126.4, 37.5] },
    { coordinates: [126.98] },
    { coordinates: null },
    { district: null },
    { address: 'changed address' },
    { name: 'changed place' },
  ]) {
    const next = structuredClone(coordinates);
    Object.assign(
      next.attractions.find((record) => record.id === '72'),
      patch,
    );
    const result = buildTravelPlaces(raw, next, review);
    assert.equal(result.results.find((record) => record.sourceId === '72').decision, 'review');
  }
});

test('missing coordinate data is reported as a location verification hold', () => {
  const missingCoordinates = structuredClone(coordinates);
  missingCoordinates.attractions = missingCoordinates.attractions.filter(
    (record) => record.id !== '72',
  );
  const result = buildTravelPlaces(raw, missingCoordinates, review);
  const place = result.results.find((record) => record.sourceId === '72');
  assert.equal(place.decision, 'review');
  assert.equal(place.reason, '좌표 데이터가 없어 위치 검증이 필요합니다.');
});

test('explicit out-of-Seoul addresses are excluded while Seoul places with unverified geocoding stay under review', () => {
  const outside = structuredClone(raw);
  const outsideRecord = outside.attractions.find(
    (item) => item.id === '72' && item.language === 'ko',
  );
  outsideRecord.address = outsideRecord.address.replace('서울 종로구', '경기도 고양시');
  const outsideReview = structuredClone(review);
  outsideReview.decisions.find((item) => item.sourceId === '72').inputFingerprint =
    recordFingerprint(outsideRecord);
  const outsideResult = buildTravelPlaces(outside, coordinates, outsideReview);
  const outsideDecision = outsideResult.results.find((item) => item.sourceId === '72');
  assert.equal(outsideDecision.decision, 'exclude');
  assert.match(outsideDecision.reason, /서울 밖/);

  const unverifiedCoordinates = structuredClone(coordinates);
  const palaceCoordinates = unverifiedCoordinates.attractions.find((item) => item.id === '72');
  palaceCoordinates.coordinateStatus = 'geocoded_keyword';
  const localResult = buildTravelPlaces(raw, unverifiedCoordinates, review);
  assert.equal(localResult.results.find((item) => item.sourceId === '72').decision, 'review');
});

test('invalid review data fails loudly', () => {
  const duplicate = structuredClone(review);
  duplicate.decisions.push(duplicate.decisions[0]);
  assert.throws(() => buildTravelPlaces(raw, coordinates, duplicate), /Duplicate review/);
  for (const patch of [{ category: 'Unknown' }, { reason: '' }, { duplicateOf: 'missing-id' }]) {
    const next = structuredClone(review);
    Object.assign(
      next.decisions.find((record) => record.sourceId === '72'),
      patch,
    );
    assert.throws(() => buildTravelPlaces(raw, coordinates, next), /Invalid/);
  }
});
