import Link from 'next/link';
import Image from 'next/image';

import { resolvePublicFileSource } from '@/lib/public-file';

import { buildProductListingHref } from './product-category-routing';
import {
  getPublicProductCategorySlug,
  type ProductCategoryTreeNode
} from './product-category-tree';

type ProductCategoryHierarchyProps = {
  categoryTree: ProductCategoryTreeNode[];
};

function CategoryVisual({ category }: { category: ProductCategoryTreeNode }) {
  const iconSource = resolvePublicFileSource(category.icon_file);

  if (iconSource) {
    return (
      <div className="relative h-[219px] overflow-hidden rounded-t-sm bg-panel">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(239,244,255,0.72),rgba(239,244,255,0.28))]" />
        <div className="relative flex h-full items-center justify-center p-10">
          <Image
            alt={category.name}
            fill
            className="object-contain"
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 33vw"
            src={iconSource}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[219px] overflow-hidden rounded-t-sm bg-panel">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(239,244,255,0.78),rgba(255,255,255,0)),radial-gradient(circle_at_18%_20%,rgba(0,96,230,0.14),transparent_32%),radial-gradient(circle_at_82%_70%,rgba(211,228,254,0.9),transparent_28%)]" />
      <div className="absolute inset-0 opacity-40">
        <span className="absolute left-[12%] top-[22%] h-px w-[56%] bg-primary/10" />
        <span className="absolute bottom-[22%] right-[10%] h-px w-[44%] bg-primary/10" />
        <span className="absolute left-[28%] top-0 h-full w-px bg-primary/10" />
        <span className="absolute right-[22%] top-0 h-full w-px bg-primary/10" />
      </div>
      <div className="relative flex h-full items-center justify-center p-8">
        <div className="flex h-full w-full items-center justify-center rounded-sm border border-white/80 bg-white/70">
          <div className="grid h-[108px] w-[108px] place-items-center rounded-full border border-primary/10 bg-white/90 shadow-soft">
            <div className="grid h-16 w-16 grid-cols-2 gap-2">
              <span className="rounded-[8px] bg-primary/15" />
              <span className="rounded-[8px] bg-primary/10" />
              <span className="rounded-[8px] bg-primary/10" />
              <span className="rounded-[8px] bg-primary/15" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductCategoryHierarchy({
  categoryTree
}: ProductCategoryHierarchyProps) {
  if (categoryTree.length === 0) {
    return (
      <div className="rounded-sm border border-borderSoft/30 bg-white px-8 py-10 shadow-soft">
        <p className="font-display text-[24px] font-extrabold leading-8 text-secondary">
          Danh mục sản phẩm đang cập nhật
        </p>
        <p className="mt-2 max-w-[44ch] text-[15px] leading-6 text-body">
          Vui lòng quay lại sau hoặc sử dụng ô tìm kiếm để tra cứu nhóm sản phẩm phù hợp.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-3">
      {categoryTree.map((parentCategory) => (
        <Link
          className="group block h-full"
          href={buildProductListingHref({ parentSlug: getPublicProductCategorySlug(parentCategory) })}
          key={parentCategory.id}
        >
          <article className="flex min-h-[280px] h-full flex-col overflow-hidden rounded-sm border border-borderSoft/20 bg-white shadow-soft transition group-hover:-translate-y-0.5 group-hover:border-primary/20 md:min-h-[400px] lg:min-h-[502px]">
            <CategoryVisual category={parentCategory} />

            <div className="flex flex-1 flex-col px-8 py-8">
              <div className="space-y-4">
                <h3 className="type-card-title text-secondary transition group-hover:text-primary">
                  {parentCategory.name}
                </h3>

                {parentCategory.description ? (
                  <p className="type-body-sm line-clamp-3 text-body">
                    {parentCategory.description}
                  </p>
                ) : (
                  <div className="min-h-[72px]" />
                )}
              </div>

              <span className="type-button mt-auto inline-flex items-center gap-2 pt-8 font-bold text-primary">
                Xem chi tiết
                <span aria-hidden="true">→</span>
              </span>
            </div>
          </article>
        </Link>
      ))}
    </div>
  );
}
