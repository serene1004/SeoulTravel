import test from 'node:test';
import assert from 'node:assert/strict';

import { estimateCostUsd, validateEnrichment } from './enrich-travel-places.mjs';

test('estimates model tokens plus one cent per web search call', () => {
  assert.equal(
    estimateCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, 1, 'gpt-5-mini'),
    2.26,
  );
  assert.equal(estimateCostUsd({ input_tokens: 0, output_tokens: 0 }, 2, 'gpt-6-luna'), 0.02);
});

test('keeps only values tied to URLs returned by web search', () => {
  const result = validateEnrichment(
    {
      status: 'verified',
      fields: {
        address: { value: '서울 주소', sourceUrl: 'https://official.example/place' },
        hours: { value: '10:00-18:00', sourceUrl: 'https://made-up.example' },
        closedDays: { value: null, sourceUrl: null },
        transport: { value: '지하철 1호선', sourceUrl: 'https://official.example/place' },
        officialUrl: {
          value: 'https://official.example/place',
          sourceUrl: 'https://official.example/place',
        },
      },
      sources: [
        { url: 'https://official.example/place', title: '공식 안내', type: 'official' },
        { url: 'https://made-up.example', title: '확인되지 않은 출처', type: 'secondary' },
      ],
      notes: '',
    },
    new Set(['https://official.example/place']),
  );

  assert.equal(result.status, 'partial_review_required');
  assert.equal(result.fields.address.value, '서울 주소');
  assert.equal(result.fields.hours.value, null);
  assert.equal(result.sources.length, 1);
});

test('marks records without source-backed values as not found', () => {
  const fields = Object.fromEntries(
    ['address', 'hours', 'closedDays', 'transport', 'officialUrl'].map((field) => [
      field,
      { value: null, sourceUrl: null },
    ]),
  );
  const result = validateEnrichment({ fields, sources: [], notes: '확인하지 못함' }, new Set());
  assert.equal(result.status, 'not_found');
  assert.ok(Object.values(result.fields).every((field) => field.value === null));
});
