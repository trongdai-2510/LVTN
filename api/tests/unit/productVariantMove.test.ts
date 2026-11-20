import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { syncVariantGroupReferences } from '../../src/modules/product-variant/variantGroupReferences';

type ChildRow = {
  product_variant_id: string;
  product_group_id: string;
  deleted_at: Date | null;
};

test('moving a variant also moves active and archived images and highlights', async () => {
  const imageRows: ChildRow[] = [
    { product_variant_id: 'moving', product_group_id: 'old', deleted_at: null },
    { product_variant_id: 'moving', product_group_id: 'old', deleted_at: new Date() },
    { product_variant_id: 'other', product_group_id: 'old', deleted_at: null }
  ];
  const highlightRows: ChildRow[] = [
    { product_variant_id: 'moving', product_group_id: 'old', deleted_at: null },
    { product_variant_id: 'moving', product_group_id: 'old', deleted_at: new Date() },
    { product_variant_id: 'other', product_group_id: 'old', deleted_at: null }
  ];
  const rowsByTable: Record<string, ChildRow[]> = {
    product_image: imageRows,
    product_highlight_spec: highlightRows
  };

  const transaction = (table: string) => {
    let variantId: string | null = null;
    let excludedGroup: string | null = null;
    return {
      where(filter: { product_variant_id: string }) {
        variantId = filter.product_variant_id;
        return this;
      },
      whereNot(filter: { product_group_id: string }) {
        excludedGroup = filter.product_group_id;
        return this;
      },
      async update(patch: { product_group_id: string }) {
        const matching = (rowsByTable[table] ?? []).filter((row) =>
          row.product_variant_id === variantId && row.product_group_id !== excludedGroup
        );
        for (const row of matching) row.product_group_id = patch.product_group_id;
        return matching.length;
      }
    };
  };

  await syncVariantGroupReferences(transaction as never, 'moving', 'new');

  assert.deepEqual(imageRows.map((row) => row.product_group_id), ['new', 'new', 'old']);
  assert.deepEqual(highlightRows.map((row) => row.product_group_id), ['new', 'new', 'old']);
});
