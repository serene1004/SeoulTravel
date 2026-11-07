import assert from 'node:assert/strict';
import test from 'node:test';

import { addressQuery } from './seoul-address-query.mjs';

test('normalizes postal codes and road numbers before address lookup', () => {
  assert.equal(addressQuery('03098 서울 종로구 율곡로283 1~3층'), '서울 종로구 율곡로 283');
  assert.equal(addressQuery('134060 서울 강동구 둔촌동 산86'), '서울 강동구 둔촌동 산86');
  assert.equal(
    addressQuery('100-101 서울특별시 중구 세종대로 110'),
    '서울특별시 중구 세종대로 110',
  );
});
