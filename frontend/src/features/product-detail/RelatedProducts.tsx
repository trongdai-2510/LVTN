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
    <section className="space-y-6 sm:space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.07em] text-primary">
            Cùng danh mục
          </p>
          <h2 className="mt-1 type-section-title text-secondary">Sản phẩm liên quan</h2>
        </div>
      </div>
      <ProductGroupList columns={safeItems.length <= 3 ? 'three' : 'four'} productGroups={safeItems} />
    </section>
  );
}
