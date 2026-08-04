import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';

import { ProductGroupList } from '@/features/product-groups/ProductGroupList';

type RelatedProductsProps = {
  items: PublicProductGroupListItem[];
};

export function RelatedProducts({ items }: RelatedProductsProps) {
  const safeItems = items.slice(0, 4);

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <section className="space-y-8">
      <h2 className="type-section-title text-secondary">Sản phẩm liên quan</h2>
      <ProductGroupList columns="four" productGroups={safeItems} />
    </section>
  );
}
