import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fields,
  fingerprint,
  readArgs,
  selectReviewBatch,
  sourceFields,
  validateReviews,
} from './review-place-content-localizations.mjs';

const place = {
  id: 'seoul-attraction-example',
  name: '서울숲',
  address: '서울특별시 성동구 뚝섬로 273',
  tags: '공원,산책,자연',
  hours: '매일 00:00-24:00',
  closedDays: '',
  transport: '수인분당선 서울숲역 4번 출구\n2호선 뚝섬역 8번 출구',
  curationReason: '도심 속 자연을 즐길 수 있는 공원입니다.',
};

function responseFor(translation = {}) {
  const translatedFields = Object.fromEntries(
    fields.map((field) => {
      if (!place[field]) return [field, ''];
      if (field === 'tags')
        return [
          field,
          translation.tags ||
            place.tags
              .split(',')
              .map((_, index) => `tag${index}`)
              .join(','),
        ];
      if (field === 'transport')
        return [
          field,
          translation.transport ||
            place.transport
              .split(/\r?\n/)
              .map((_, index) => `route${index}`)
              .join('\n'),
        ];
      return [field, translation[field] || `translated ${field}`];
    }),
  );
  return {
    id: place.id,
    en: { status: 'approved', reason: 'Reviewed.', fields: translatedFields },
    ja: { status: 'needs_review', reason: 'Check station names.', fields: translatedFields },
  };
}

test('content review validates localized tag separators without rejecting route formatting', () => {
  const source = sourceFields(place);
  const entry = validateReviews([responseFor({ tags: 'park,walk,nature' })], [place])[0];
  assert.equal(entry.sourceFingerprint, fingerprint(source));
  assert.equal(entry.review.en.fields.tags.split(',').length, 3);
  assert.equal(entry.review.ja.status, 'needs_review');

  const japaneseTags = validateReviews(
    [
      responseFor({
        tags: '公園、散策、自然',
        transport: 'Seoul Forest Station\nTtukseom Station',
      }),
    ],
    [place],
  )[0];
  assert.equal(japaneseTags.review.en.status, 'approved');
  assert.equal(japaneseTags.review.ja.status, 'needs_review');

  const changedTags = validateReviews([responseFor({ tags: 'park,nature' })], [place])[0];
  assert.equal(changedTags.review.en.status, 'needs_review');
  assert.match(changedTags.review.en.reason, /태그 개수가 원문과 다릅니다/);
});

test('retry mode accepts 25-place batches for entries still marked for review', () => {
  assert.deepEqual(readArgs(['--retry-needs-review', '--limit', '25', '--offset', '0']), {
    limit: 25,
    offset: 0,
    dryRun: false,
    force: false,
    retryNeedsReview: true,
  });
});

test('content localization batches offset through pending places after completed entries drop out', () => {
  const places = [
    { ...place, id: 'place-1' },
    { ...place, id: 'place-2', name: '남산' },
    { ...place, id: 'place-3', name: '서울숲길' },
  ];
  const existingById = new Map([
    [places[0].id, { sourceFingerprint: fingerprint(sourceFields(places[0])) }],
    [places[2].id, { sourceFingerprint: 'stale-fingerprint' }],
  ]);
  const options = { retryNeedsReview: false, force: false, limit: 1, offset: 0 };

  assert.deepEqual(selectReviewBatch(places, existingById, options), [places[1]]);

  existingById.set(places[1].id, { sourceFingerprint: fingerprint(sourceFields(places[1])) });
  assert.deepEqual(selectReviewBatch(places, existingById, options), [places[2]]);
});
