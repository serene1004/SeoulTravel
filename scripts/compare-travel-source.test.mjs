import assert from 'node:assert/strict';
import test from 'node:test';

import { compareAttractions } from './compare-travel-source.mjs';

test('reports added, removed, and changed source records by id', () => {
  const previous = [
    { id: '1', name: 'Old name', address: 'Old address' },
    { id: '2', name: 'Removed place', address: 'Address' },
    { id: '3', name: 'Unchanged place', address: 'Address' },
  ];
  const next = [
    { id: '4', name: 'New place', address: 'Address' },
    { id: '1', name: 'New name', address: 'New address' },
    { id: '3', name: 'Unchanged place', address: 'Address' },
  ];

  assert.deepEqual(compareAttractions(previous, next), {
    added: [{ id: '4', name: 'New place' }],
    changed: [{ id: '1', name: 'New name', fields: ['address', 'name'] }],
    removed: [{ id: '2', name: 'Removed place' }],
  });
});

test('rejects missing and duplicate ids instead of producing an ambiguous report', () => {
  assert.throws(() => compareAttractions([{ name: 'Missing id' }], []), /missing or duplicate/);
  assert.throws(
    () =>
      compareAttractions(
        [],
        [
          { id: '1', name: 'First' },
          { id: '1', name: 'Duplicate' },
        ],
      ),
    /missing or duplicate/,
  );
});
