import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildPublicPriceSummaryMap, type PublicPriceRow } from '../../src/modules/public/publicPrice';

function row(groupId: string, amount: number | null): PublicPriceRow {
  return {
    product_group_id: groupId,
    public_price_mode: amount === null ? 'contact_for_quote' : 'public_price',
    public_price_amount: amount
  };
}

test('public price summary distinguishes quote, exact, varying and mixed variants', () => {
  const summaries = buildPublicPriceSummaryMap(
    ['empty', 'quote', 'single', 'same', 'varying', 'mixed'],
    [
      row('quote', null),
      row('single', 125000),
      row('same', 90000), row('same', 90000),
      row('varying', 140000), row('varying', 110000),
      row('mixed', 80000), row('mixed', null)
    ]
  );

  assert.deepEqual(summaries.get('empty'), {
    display_mode: 'contact_for_quote', display_amount: null,
    priced_variant_count: 0, variant_count: 0
  });
  assert.deepEqual(summaries.get('quote'), {
    display_mode: 'contact_for_quote', display_amount: null,
    priced_variant_count: 0, variant_count: 1
  });
  assert.equal(summaries.get('single')?.display_mode, 'exact_price');
  assert.equal(summaries.get('same')?.display_mode, 'exact_price');
  assert.deepEqual(summaries.get('varying'), {
    display_mode: 'from_price', display_amount: 110000,
    priced_variant_count: 2, variant_count: 2
  });
  assert.deepEqual(summaries.get('mixed'), {
    display_mode: 'from_price', display_amount: 80000,
    priced_variant_count: 1, variant_count: 2
  });
});
