import type { Knex } from 'knex';

import { PRODUCT_HIGHLIGHT_SPEC_TABLE } from '../product-group/product-group.types';
import { PRODUCT_IMAGE_TABLE } from './product-variant.types';

export async function syncVariantGroupReferences(
  db: Knex.Transaction,
  productVariantId: string,
  productGroupId: string
): Promise<void> {
  for (const table of [PRODUCT_IMAGE_TABLE, PRODUCT_HIGHLIGHT_SPEC_TABLE]) {
    await db(table)
      .where({ product_variant_id: productVariantId })
      .whereNot({ product_group_id: productGroupId })
      .update({ product_group_id: productGroupId });
  }
}
