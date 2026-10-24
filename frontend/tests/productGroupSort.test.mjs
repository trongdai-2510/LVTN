import assert from 'node:assert/strict';
import test from 'node:test';

import { getProductGroupSortLabel, PRODUCT_GROUP_SORT_OPTIONS } from '../src/features/product-groups/productGroupSort.ts';

test('the default product order is described as the admin priority order', () => {
  assert.equal(getProductGroupSortLabel(''), 'Ưu tiên');
  assert.deepEqual(PRODUCT_GROUP_SORT_OPTIONS[0], { value: '', label: 'Ưu tiên' });
});

test('newest is an explicit alternative to the admin priority order', () => {
  assert.equal(getProductGroupSortLabel('newest'), 'Mới nhất');
  assert.ok(PRODUCT_GROUP_SORT_OPTIONS.some((option) => option.value === 'newest'));
});
