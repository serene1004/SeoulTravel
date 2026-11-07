import assert from 'node:assert/strict';
import test from 'node:test';

import { getSeoulOpenDataBaseUrl } from './seoul-open-data-url.mjs';

test('accepts HTTPS proxies without URL credentials, query, or fragment', () => {
  assert.equal(
    getSeoulOpenDataBaseUrl('https://proxy.example/seoul/'),
    'https://proxy.example/seoul',
  );
  assert.throws(() => getSeoulOpenDataBaseUrl('https://user:pass@proxy.example'), /credentials/);
  assert.throws(() => getSeoulOpenDataBaseUrl('https://proxy.example?key=value'), /credentials/);
});

test('allows the official HTTP API only with the explicit one-time opt-in', () => {
  const options = { allowInsecureHttpOnce: true };
  assert.equal(
    getSeoulOpenDataBaseUrl('http://openapi.seoul.go.kr:8088/', options),
    'http://openapi.seoul.go.kr:8088',
  );
  assert.throws(
    () => getSeoulOpenDataBaseUrl('http://openapi.seoul.go.kr:8088'),
    /explicitly opted-in one-time request/,
  );
  assert.throws(
    () => getSeoulOpenDataBaseUrl('http://proxy.example:8088', options),
    /explicitly opted-in one-time request/,
  );
  assert.throws(
    () => getSeoulOpenDataBaseUrl('http://openapi.seoul.go.kr:8088/other', options),
    /explicitly opted-in one-time request/,
  );
});
