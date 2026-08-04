import Image from 'next/image';
import Link from 'next/link';

import { ProductGroupList } from '@/features/product-groups/ProductGroupList';
import {
  buildProductListingHref
} from '@/features/product-categories/product-category-routing';
import {
  getPublicProductCategorySlug,
  type ProductCategoryTreeNode
} from '@/features/product-categories/product-category-tree';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type {
  PublicProductBrandFacetOption,
  PublicProductGroupListItem
} from '@/types/contracts/public-product-groups';

const PRODUCT_SECTION_PREVIEW_LIMIT = 10;

export type ProductCategoryProductSection = {
  brands: PublicProductBrandFacetOption[];
  category: ProductCategoryTreeNode;
  products: PublicProductGroupListItem[];
  total: number;
};

export function ProductCategoryProductSections({
  brandDirectory,
  sections
}: {
  brandDirectory: PublicBrandListItem[];
  sections: ProductCategoryProductSection[];
}) {
  if (sections.length === 0) {
    return null;
  }

  const brandDirectoryBySlug = new Map(
    brandDirectory.map((brand) => [brand.slug, brand])
  );

  return (
    <div className="space-y-12">
      {sections.map((section) => {
        const categorySlug = getPublicProductCategorySlug(section.category);
        const categoryHref = buildProductListingHref({ parentSlug: categorySlug });
        const visibleBrands = section.brands.slice(0, 8);
        const visibleProducts = section.products.slice(0, PRODUCT_SECTION_PREVIEW_LIMIT);

        return (
          <section
            className="border-t border-borderSoft/50 pt-9 first:border-t-0 first:pt-0"
            key={section.category.id}
          >
            <div className="flex flex-col items-start gap-3 border-b border-borderSoft pb-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
              <div>
                <h2 className="font-display text-[20px] font-extrabold uppercase leading-7 text-secondary sm:text-[24px] sm:leading-8 md:text-[28px]">
                  {section.category.name}
                </h2>
                <div className="mt-2 h-[3px] w-24 bg-primary" />
              </div>

              <Link
                className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-primary/15 bg-primarySoft/55 px-5 text-[14px] font-bold leading-5 text-primaryStrong shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                href={categoryHref}
              >
                Xem thêm
                <span aria-hidden="true" className="text-[18px] leading-none">→</span>
              </Link>
            </div>

            {visibleBrands.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2 sm:gap-3">
                {visibleBrands.map((brand) => (
                  <BrandLogoLink
                    brand={brand}
                    href={buildProductListingHref({
                      parentSlug: categorySlug,
                      brands: brand.slug
                    })}
                    key={brand.id}
                    publicBrand={brandDirectoryBySlug.get(brand.slug) ?? null}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-6">
              {section.products.length > 0 ? (
                <ProductGroupList productGroups={visibleProducts} columns="five" />
              ) : (
                <div className="rounded-sm border border-dashed border-borderSoft bg-surface px-5 py-8">
                  <h3 className="type-card-title text-secondary">Chưa có nhóm sản phẩm công khai</h3>
                  <p className="mt-2 max-w-[60ch] text-[14px] leading-6 text-body/75">
                    Khi product_group thuộc danh mục này được duyệt và publish, khu vực này sẽ tự cập nhật.
                  </p>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BrandLogoLink({
  brand,
  href,
  publicBrand
}: {
  brand: PublicProductBrandFacetOption;
  href: string;
  publicBrand: PublicBrandListItem | null;
}) {
  const logoSource = resolvePublicFileSource(publicBrand?.logo_file);

  return (
    <Link
      aria-label={`Lọc sản phẩm thương hiệu ${brand.label}`}
      className="group inline-flex h-14 min-w-[96px] items-center justify-center rounded-sm border border-borderSoft/70 bg-white px-3 shadow-[0_1px_2px_rgb(15_23_42_/_0.05)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white hover:shadow-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-w-[116px] sm:px-4"
      href={href}
      title={`${brand.label} (${brand.count})`}
    >
      {logoSource ? (
        <span className="relative block h-8 w-[92px]">
          <Image
            alt={brand.label}
            className="object-contain transition duration-200 group-hover:scale-105"
            fill
            sizes="92px"
            src={logoSource}
          />
        </span>
      ) : (
        <span className="text-[13px] font-bold uppercase leading-5 text-secondary">
          {brand.label}
        </span>
      )}
    </Link>
  );
}
