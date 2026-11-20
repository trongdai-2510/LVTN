import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProductQuoteRequestItem,
  getProductRequestActionLabel
} from '../src/features/product-detail/quote-request-context.ts';

const product = { id: 'product-1', name: 'Thiết bị thử', slug: 'thiet-bi-thu' };

test('a publicly priced variant keeps its selected price in the inquiry context', () => {
  const variant = {
    id: 'variant-1', variant_name: 'Mẫu A',
    public_price_mode: 'public_price', public_price_amount: 125000
  };
  assert.deepEqual(buildProductQuoteRequestItem(product, variant), {
    product_group_id: 'product-1',
    product_variant_id: 'variant-1',
    product_name: 'Thiết bị thử',
    variant_name: 'Mẫu A',
    public_price_amount: 125000,
    request_kind: 'priced'
  });
  assert.equal(getProductRequestActionLabel(variant), 'Gửi yêu cầu ngay');
});

test('a quote-only variant never carries a stale public amount', () => {
  const variant = {
    id: 'variant-2', variant_name: 'Mẫu B',
    public_price_mode: 'contact_for_quote', public_price_amount: 125000
  };
  const context = buildProductQuoteRequestItem(product, variant);
  assert.equal(context.request_kind, 'quote');
  assert.equal(context.public_price_amount, undefined);
  assert.equal(getProductRequestActionLabel(variant), 'Nhận báo giá ngay');
});

test('a public-price mode without a valid amount still requests a quote', () => {
  const variant = {
    id: 'variant-3', variant_name: 'Mẫu C',
    public_price_mode: 'public_price', public_price_amount: 0
  };
  const context = buildProductQuoteRequestItem(product, variant);
  assert.equal(context.request_kind, 'quote');
  assert.equal(context.public_price_amount, undefined);
  assert.equal(getProductRequestActionLabel(variant), 'Nhận báo giá ngay');
});
