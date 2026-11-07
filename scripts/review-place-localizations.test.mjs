import assert from 'node:assert/strict';
import test from 'node:test';

import { selectReviewBatch } from './review-place-localizations.mjs';

test('localization batches offset through pending places after completed entries drop out', () => {
  const drafts = [{ id: 'place-1' }, { id: 'place-2' }, { id: 'place-3' }];
  const entries = [{ id: 'place-1' }];
  const options = { force: false, limit: 1, offset: 0 };

  assert.deepEqual(selectReviewBatch(drafts, entries, options), [drafts[1]]);
  entries.push({ id: 'place-2' });
  assert.deepEqual(selectReviewBatch(drafts, entries, options), [drafts[2]]);
});
