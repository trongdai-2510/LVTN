import type { PublicProductPriceSummary } from './public.types';

export interface PublicPriceRow {
  product_group_id: string;
  public_price_mode: string;
  public_price_amount: number | null;
}

export function buildPublicPriceSummaryMap(
  productGroupIds: string[],
  rows: PublicPriceRow[]
): Map<string, PublicProductPriceSummary> {
  const groups = new Map<string, {
    variantCount: number;
    pricedCount: number;
    minimum: number | null;
    samePrice: boolean;
  }>();

  for (const row of rows) {
    const group = groups.get(row.product_group_id) ?? {
      variantCount: 0,
      pricedCount: 0,
      minimum: null,
      samePrice: true
    };
    group.variantCount += 1;
    const amount = Number(row.public_price_amount);
    if (row.public_price_mode === 'public_price' && Number.isFinite(amount) && amount > 0) {
      if (group.minimum !== null && group.minimum !== amount) group.samePrice = false;
      group.minimum = group.minimum === null ? amount : Math.min(group.minimum, amount);
      group.pricedCount += 1;
    }
    groups.set(row.product_group_id, group);
  }

  return new Map(productGroupIds.map((id) => {
    const group = groups.get(id);
    const variantCount = group?.variantCount ?? 0;
    const pricedCount = group?.pricedCount ?? 0;
    const exact = pricedCount > 0 && pricedCount === variantCount && group?.samePrice === true;
    return [id, {
      display_mode: pricedCount === 0 ? 'contact_for_quote' : exact ? 'exact_price' : 'from_price',
      display_amount: pricedCount === 0 ? null : group?.minimum ?? null,
      priced_variant_count: pricedCount,
      variant_count: variantCount
    } satisfies PublicProductPriceSummary];
  }));
}
