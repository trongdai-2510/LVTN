import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';

import { ProductGroupCard } from './ProductGroupCard';

type ProductGroupListProps = {
  productGroups: PublicProductGroupListItem[];
  columns?: 'three' | 'four' | 'five';
  /** slug thương hiệu → nguồn ảnh logo, để thẻ hiển thị logo thay vì chữ. */
  brandLogoBySlug?: Record<string, string | null>;
};

export function ProductGroupList({
  productGroups,
  columns = 'three',
  brandLogoBySlug
}: ProductGroupListProps) {
  const gridClassName =
    columns === 'four'
      ? 'grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4'
      : columns === 'five'
        ? 'grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        : 'grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3';

  if (productGroups.length === 0) {
    return (
      <div className="rounded-sm border border-borderSoft/30 bg-white px-8 py-12 shadow-soft">
        <h3 className="font-display text-[24px] font-extrabold leading-8 text-secondary">
          Không tìm thấy sản phẩm phù hợp
        </h3>
        <p className="mt-2 max-w-[44ch] text-[15px] leading-6 text-body">
          Thử điều chỉnh từ khóa, thương hiệu hoặc danh mục con để tiếp tục tra cứu.
        </p>
      </div>
    );
  }

  return (
    <div className={gridClassName}>
      {productGroups.map((productGroup) => (
        <ProductGroupCard
          brandLogoSource={
            productGroup.brand_slug ? brandLogoBySlug?.[productGroup.brand_slug] ?? null : null
          }
          key={productGroup.id}
          productGroup={productGroup}
        />
      ))}
    </div>
  );
}
