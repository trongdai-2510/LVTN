import type { PublicProductGroupListItem } from '@/types/contracts/public-product-groups';

import { ProductGroupCard } from './ProductGroupCard';
import { ProductCatalogCard } from './ProductCatalogCard';

type ProductGroupListProps = {
  productGroups: PublicProductGroupListItem[];
  columns?: 'three' | 'four' | 'five' | 'catalog';
  mobileRail?: boolean;
  priorityFirst?: boolean;
  headingLevel?: 2 | 3 | 4;
  /** slug thương hiệu → nguồn ảnh logo, để thẻ hiển thị logo thay vì chữ. */
  brandLogoBySlug?: Record<string, string | null>;
};

export function ProductGroupList({
  productGroups,
  columns = 'three',
  brandLogoBySlug,
  mobileRail = false,
  priorityFirst = false,
  headingLevel = 3
}: ProductGroupListProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const responsiveGridClassName =
    columns === 'catalog'
      ? 'sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
      : columns === 'four'
      ? 'sm:grid-cols-2 sm:gap-6 xl:grid-cols-4'
      : columns === 'five'
        ? 'sm:grid-cols-2 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
        : 'sm:grid-cols-2 sm:gap-5 xl:grid-cols-3';
  const gridClassName = columns === 'catalog'
    ? `grid grid-cols-1 gap-4 ${responsiveGridClassName}`
    : mobileRail
    ? `-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0 ${responsiveGridClassName}`
    : `grid grid-cols-1 gap-4 ${responsiveGridClassName}`;

  if (productGroups.length === 0) {
    return (
      <div className="rounded-sm border border-borderSoft/30 bg-white px-8 py-12 shadow-soft">
        <Heading className="font-display text-[24px] font-extrabold leading-8 text-secondary">
          Không tìm thấy sản phẩm phù hợp
        </Heading>
        <p className="mt-2 max-w-[44ch] text-[15px] leading-6 text-body">
          Thử điều chỉnh từ khóa, thương hiệu hoặc danh mục con để tiếp tục tra cứu.
        </p>
      </div>
    );
  }

  return (
    <div className={gridClassName} data-product-grid="true">
      {productGroups.map((productGroup, index) => (
        <div
          className={mobileRail ? 'w-[78vw] max-w-[310px] shrink-0 snap-start sm:w-auto sm:max-w-none sm:min-w-0' : 'contents'}
          key={productGroup.id}
        >
          {columns === 'catalog' ? (
            <ProductCatalogCard product={productGroup} priority={priorityFirst && index === 0} />
          ) : <ProductGroupCard
            compactMobile={!mobileRail}
            brandLogoSource={
              productGroup.brand_slug ? brandLogoBySlug?.[productGroup.brand_slug] ?? null : null
            }
            priority={priorityFirst && index === 0}
            headingLevel={headingLevel}
            productGroup={productGroup}
          />}
        </div>
      ))}
    </div>
  );
}
