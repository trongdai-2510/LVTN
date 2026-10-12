import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { normalizePublicQuoteQuantity } from '../../src/modules/public/publicQuote';

test('legacy quantities remain backward compatible', () => {
  assert.deepEqual(normalizePublicQuoteQuantity({ quantity: 2 }), {
    ok: true,
    value: {
      quantity: 2,
      quantity_raw: '2',
      quantity_unit: null,
      quantity_state: 'confirmed'
    }
  });
  assert.deepEqual(normalizePublicQuoteQuantity({}), {
    ok: true,
    value: {
      quantity: null,
      quantity_raw: null,
      quantity_unit: null,
      quantity_state: 'unspecified'
    }
  });
});

test('confirmed quantity requires raw ASCII integer matching the numeric value', () => {
  assert.deepEqual(
    normalizePublicQuoteQuantity({
      quantity: 2,
      quantity_raw: '02',
      quantity_unit: 'sản phẩm',
      quantity_state: 'confirmed'
    }),
    {
      ok: true,
      value: {
        quantity: 2,
        quantity_raw: '02',
        quantity_unit: 'sản phẩm',
        quantity_state: 'confirmed'
      }
    }
  );

  for (const quantityRaw of ['1/2', '0,5', '2 cái', '1e2', '１２']) {
    const result = normalizePublicQuoteQuantity({
      quantity: 1,
      quantity_raw: quantityRaw,
      quantity_state: 'confirmed'
    });
    assert.equal(result.ok, false, quantityRaw);
  }

  assert.equal(
    normalizePublicQuoteQuantity({
      quantity: 2,
      quantity_raw: '3',
      quantity_state: 'confirmed'
    }).ok,
    false
  );
});

test('unspecified state preserves ambiguous raw input without inventing a number', () => {
  assert.deepEqual(
    normalizePublicQuoteQuantity({
      quantity_raw: '1/2',
      quantity_unit: 'sản phẩm',
      quantity_state: 'unspecified'
    }),
    {
      ok: true,
      value: {
        quantity: null,
        quantity_raw: '1/2',
        quantity_unit: 'sản phẩm',
        quantity_state: 'unspecified'
      }
    }
  );
  assert.equal(
    normalizePublicQuoteQuantity({
      quantity: 1,
      quantity_raw: '1/2',
      quantity_state: 'unspecified'
    }).ok,
    false
  );
});

test('extended fields require an explicit state and reject unsafe boundaries', () => {
  assert.equal(normalizePublicQuoteQuantity({ quantity_raw: '2' }).ok, false);
  assert.equal(
    normalizePublicQuoteQuantity({
      quantity: 2_147_483_648,
      quantity_raw: '2147483648',
      quantity_state: 'confirmed'
    }).ok,
    false
  );
  assert.equal(
    normalizePublicQuoteQuantity({
      quantity_raw: 'x'.repeat(65),
      quantity_state: 'unspecified'
    }).ok,
    false
  );
  assert.equal(
    normalizePublicQuoteQuantity({
      quantity_unit: 'm\u0000',
      quantity_state: 'unspecified'
    }).ok,
    false
  );
});
