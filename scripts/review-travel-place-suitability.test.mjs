import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeReview, readArgs, validateReviews } from './review-travel-place-suitability.mjs';

const place = {
  id: '123',
  language: 'ko',
  name: '서울숲',
  address: '서울 성동구 뚝섬로 273',
  tags: '공원, 산책',
  hours: '연중무휴',
  closedDays: '',
  officialUrl: 'https://example.com',
  transport: '',
};

test('parses bounded batch options and dry-run mode', () => {
  assert.deepEqual(readArgs(['--', '--dry-run', '--limit', '25', '--offset', '0']), {
    limit: 25,
    offset: 0,
    dryRun: true,
  });
  assert.throws(() => readArgs(['--limit', '0']), /1 이상의/);
});

test('requires one valid result per requested source and classification only for included places', () => {
  const included = {
    id: '123',
    decision: 'include',
    category: 'Nature',
    placeType: 'walk_garden_scenery',
    reason: '공원 산책을 목적으로 방문할 수 있습니다.',
    evidenceFields: ['name', 'tags'],
  };
  const entry = validateReviews([included], [place])[0];
  assert.equal(entry.sourceId, place.id);
  assert.equal(entry.name, place.name);
  assert.equal(entry.decision, 'include');
  assert.throws(
    () => validateReviews([{ ...included, id: 'unknown' }], [place]),
    /알 수 없거나 중복된 ID/,
  );
  assert.throws(() => validateReviews([], [place]), /응답 장소 수.*0\/1/);
  assert.throws(
    () => validateReviews([{ ...included, placeType: null }], [place]),
    /포함 결과에 분류가 없습니다/,
  );
  assert.throws(
    () => validateReviews([{ ...included, decision: 'review' }], [place]),
    /포함 외 결과에는 분류를 지정할 수 없습니다/,
  );
});

test('holds exclusions whose reason contradicts the decision or only cites time-limited operation', () => {
  const base = { decision: 'exclude', category: null, placeType: null };
  assert.equal(
    normalizeReview({ ...base, reason: '서울 음식점으로 방문 목적에 포함합니다.' }).decision,
    'review',
  );
  assert.equal(
    normalizeReview({ ...base, reason: '시범 운영 기간이 한정되어 있습니다.' }).decision,
    'review',
  );
  assert.equal(
    normalizeReview({ ...base, reason: '관광안내소로 여행 지원 시설에 해당합니다.' }).decision,
    'exclude',
  );
});
