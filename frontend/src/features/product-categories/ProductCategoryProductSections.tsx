'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { ProductGroupList } from '@/features/product-groups/ProductGroupList';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicProductBrandFacetOption, PublicProductGroupListItem } from '@/types/contracts/public-product-groups';

import { CategoryBrandLink } from './CategoryBrandLink';
import { CATEGORY_PAGE_SIZE, categoryPage } from './categoryBrowse';
import { buildProductListingHref } from './product-category-routing';
import { getPublicProductCategorySlug, type ProductCategoryTreeNode } from './product-category-tree';

export type ProductCategoryProductSection = {
  brands: PublicProductBrandFacetOption[];
  category: ProductCategoryTreeNode;
  products: PublicProductGroupListItem[];
  total: number;
};

const PRODUCT_PREVIEW_LIMIT = 4;

function CategoryPager({
  page,
  pageCount,
  onChange
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Trang danh mục" className="flex items-center gap-2">
      <button
        className="min-h-11 rounded-lg border border-borderBlue bg-white px-3 text-sm font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-40"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        type="button"
      >
        Trước
      </button>
      <span className="min-w-[64px] text-center text-sm tabular-nums text-body">{page} / {pageCount}</span>
      <button
        className="min-h-11 rounded-lg border border-borderBlue bg-white px-3 text-sm font-semibold text-secondary disabled:cursor-not-allowed disabled:opacity-40"
        disabled={page === pageCount}
        onClick={() => onChange(page + 1)}
        type="button"
      >
        Tiếp
      </button>
    </nav>
  );
}

export function ProductCategoryProductSections({
  brandDirectory,
  categoryTree,
  sections
}: {
  brandDirectory: PublicBrandListItem[];
  categoryTree: ProductCategoryTreeNode[];
  sections: ProductCategoryProductSection[];
}) {
  const [page, setPage] = useState(1);
  const [sectionsById, setSectionsById] = useState<Map<string, ProductCategoryProductSection>>(
    () => new Map(sections.map((section) => [section.category.id, section]))
  );
  const [isLoading, setIsLoading] = useState(false);
  const brandsBySlug = useMemo(
    () => new Map(brandDirectory.map((brand) => [brand.slug, brand])),
    [brandDirectory]
  );
  const pageCount = Math.max(1, Math.ceil(categoryTree.length / CATEGORY_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleCategories = useMemo(
    () => categoryPage(categoryTree, currentPage),
    [categoryTree, currentPage]
  );

  useEffect(() => {
    const missingCategories = visibleCategories.filter((category) => !sectionsById.has(category.id));
    if (missingCategories.length === 0) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    void Promise.all(missingCategories.map(async (category) => {
      const response = await getPublicProductGroups({
        category_id: category.id,
        page: 1,
        page_size: PRODUCT_PREVIEW_LIMIT,
        sort: 'popular'
      }, { signal: controller.signal }).catch(() => null);
      return {
        brands: response?.facets.brands ?? [],
        category,
        products: response?.items ?? [],
        total: response?.pagination.total ?? 0
      } satisfies ProductCategoryProductSection;
    })).then((loadedSections) => {
      if (controller.signal.aborted) return;
      setSectionsById((previous) => {
        const next = new Map(previous);
        for (const section of loadedSections) next.set(section.category.id, section);
        return next;
      });
      setIsLoading(false);
    });

    return () => controller.abort();
  }, [sectionsById, visibleCategories]);

  function selectPage(nextPage: number) {
    setPage(nextPage);
    const explorer = document.getElementById('category-explorer');
    if (explorer) {
      window.scrollTo({ top: explorer.getBoundingClientRect().top + window.scrollY - 110, behavior: 'auto' });
    }
  }

  if (categoryTree.length === 0) return null;

  return (
    <div data-product-catalog-layout="paged-categories" data-product-category-explorer="true" id="category-explorer">
      {pageCount > 1 ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-borderBlue pb-4">
          <p className="text-sm text-body/75">{categoryTree.length.toLocaleString('vi-VN')} danh mục</p>
          <CategoryPager onChange={selectPage} page={currentPage} pageCount={pageCount} />
        </div>
      ) : null}

        <div aria-busy={isLoading} className="space-y-12 sm:space-y-16">
          {visibleCategories.map((category) => {
            const section = sectionsById.get(category.id);
            const brands = section?.brands ?? [];
            const products = section?.products ?? [];
            const slug = getPublicProductCategorySlug(category);
            const href = buildProductListingHref({ parentSlug: slug });
            return (
              <section
                aria-labelledby={`category-title-${slug}`}
                className="scroll-mt-28"
                data-product-category-section="true"
                id={`category-${slug}`}
                key={category.id}
              >
                <div className="mb-5 flex flex-col gap-3 border-b border-borderBlue pb-5 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-display text-[26px] font-bold leading-tight text-secondary sm:text-[32px]" id={`category-title-${slug}`}>
                      <Link className="group inline-flex items-center gap-3 hover:text-primaryStrong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href={href}>
                        {category.name}
                        <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1 motion-reduce:transition-none" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
                      </Link>
                    </h2>
                    {category.description?.trim() ? <p className="mt-2 max-w-[75ch] text-[15px] leading-6 text-body">{category.description}</p> : null}
                  </div>
                  {section ? <p className="shrink-0 text-[13px] text-body/75">{section.total.toLocaleString('vi-VN')} sản phẩm</p> : null}
                </div>
                {!section ? (
                  <div className="min-h-[180px] rounded-xl border border-borderBlue bg-white p-5 text-sm text-body/70" role="status">Đang tải sản phẩm trong danh mục...</div>
                ) : (
                  <>
                    {brands.length > 0 ? (
                      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mb-6" data-category-brands="true">
                        <span className="shrink-0 text-[13px] font-semibold text-body">Thương hiệu</span>
                        <div className="flex min-w-0 flex-wrap gap-2">
                          {brands.slice(0, 6).map((brand) => (
                            <CategoryBrandLink
                              brand={brand}
                              href={buildProductListingHref({ parentSlug: slug, brands: brand.slug })}
                              key={brand.id}
                              publicBrand={brandsBySlug.get(brand.slug) ?? null}
                            />
                          ))}
                          {brands.length > 6 ? (
                            <Link className="inline-flex min-h-11 items-center rounded-lg px-2 text-[13px] font-semibold text-primaryStrong hover:underline" href={href}>
                              +{brands.length - 6} thương hiệu
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {products.length > 0 ? (
                      <ProductGroupList columns="four" headingLevel={3} productGroups={products} />
                    ) : (
                      <p className="rounded-xl border border-borderBlue bg-white px-5 py-8 text-[15px] text-body">Sản phẩm trong nhóm này đang được cập nhật.</p>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>

      {pageCount > 1 ? (
        <div className="mt-10 flex justify-center">
          <CategoryPager onChange={selectPage} page={currentPage} pageCount={pageCount} />
        </div>
      ) : null}
    </div>
  );
}
