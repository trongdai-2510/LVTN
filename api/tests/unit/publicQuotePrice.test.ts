import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { publicPriceAmountAtRequest } from '../../src/modules/public/publicQuotePrice';

test('captures the server-side public variant price at request time', () => {
  assert.equal(publicPriceAmountAtRequest({
    public_price_mode: 'public_price', public_price_amount: 125000
  }), 125000);
});

test('does not invent a price for quote-only or missing variants', () => {
  assert.equal(publicPriceAmountAtRequest({
    public_price_mode: 'contact_for_quote', public_price_amount: 125000
  }), null);
  assert.equal(publicPriceAmountAtRequest(null), null);
  assert.equal(publicPriceAmountAtRequest({
    public_price_mode: 'public_price', public_price_amount: null
  }), null);
});
