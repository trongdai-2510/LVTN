import assert from 'node:assert/strict';
import test from 'node:test';

import { selectBrandProducts } from '../src/features/partners/brandProductSelection.ts';

test('first pinned product is featured and does not repeat in the product grid', () => {
  const pinned = [{ id: 'featured' }, { id: 'second' }];
  const fetched = [{ id: 'featured' }, { id: 'third' }];

  const selection = selectBrandProducts(pinned, fetched, 3);

  assert.equal(selection.featuredProduct?.id, 'featured');
  assert.deepEqual(selection.otherProducts.map((product) => product.id), ['second', 'third']);
});

test('a brand without pinned products uses only the regular product grid', () => {
  const selection = selectBrandProducts([], [{ id: 'first' }, { id: 'second' }], 2);

  assert.equal(selection.featuredProduct, null);
  assert.deepEqual(selection.otherProducts.map((product) => product.id), ['first', 'second']);
});

test('the product limit includes the featured product', () => {
  const selection = selectBrandProducts([{ id: 'featured' }], [{ id: 'second' }, { id: 'third' }], 2);

  assert.equal(selection.featuredProduct?.id, 'featured');
  assert.deepEqual(selection.otherProducts.map((product) => product.id), ['second']);
});
