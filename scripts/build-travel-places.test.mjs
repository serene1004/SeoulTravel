import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildTravelPlaces, recordFingerprint } from './build-travel-places.mjs';

const read = (name) => JSON.parse(readFileSync(`src/data/${name}.json`, 'utf8'));
const raw = read('seoul-open-attractions');
const coordinates = read('seoul-public-attraction-coordinates');
const review = read('seoul-travel-place-review');

test('every Korean source has a current explicit review and the generated catalog is reproducible', () => {
  const records = raw.attractions.filter((record) => record.language === 'ko');
  assert.equal(review.decisions.length, records.length);
  for (const record of records) {
    assert.equal(
      review.decisions.find((decision) => decision.sourceId === record.id)?.inputFingerprint,
      recordFingerprint(record),
    );
  }
  const { results, ...catalog } = buildTravelPlaces(raw, coordinates, review);
  assert.deepEqual(catalog, read('seoul-travel-places'));
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
    '5538',
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

test('explicit out-of-Seoul addresses are excluded while Seoul places with unverified geocoding stay under review', () => {
  const outside = structuredClone(raw);
  const outsideRecord = outside.attractions.find((item) => item.id === '72' && item.language === 'ko');
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
