import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ProductVariantRepository } from '../../src/modules/product-variant/product-variant.repository';

type ChildRow = {
  product_variant_id: string;
  product_group_id: string;
  deleted_at: Date | null;
};

test('moving a variant also moves its active images and highlights', async () => {
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
    let activeOnly = false;
    return {
      where(filter: { product_variant_id: string }) {
        variantId = filter.product_variant_id;
        return this;
      },
      whereNull(field: string) {
        assert.equal(field, 'deleted_at');
        activeOnly = true;
        return this;
      },
      async update(patch: { product_group_id: string }) {
        const matching = (rowsByTable[table] ?? []).filter((row) =>
          row.product_variant_id === variantId && (!activeOnly || row.deleted_at === null)
        );
        for (const row of matching) row.product_group_id = patch.product_group_id;
        return matching.length;
      }
    };
  };

  const repository = new ProductVariantRepository({} as never);
  const move = repository as unknown as {
    updateVariantDependentsProductGroup: (
      trx: typeof transaction,
      variantId: string,
      productGroupId: string
    ) => Promise<void>;
  };
  await move.updateVariantDependentsProductGroup(transaction, 'moving', 'new');

  assert.deepEqual(imageRows.map((row) => row.product_group_id), ['new', 'old', 'old']);
  assert.deepEqual(highlightRows.map((row) => row.product_group_id), ['new', 'old', 'old']);
});
