import Link from 'next/link';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { PageSectionLayout } from '@/features/page-content/PageSectionLayout';
import { hasMeaningfulPublicContent } from '@/features/page-content/contentQuality';
import { ProductCategoryHierarchy } from '@/features/product-categories/ProductCategoryHierarchy';
import {
  ProductCategoryProductSections,
  type ProductCategoryProductSection
} from '@/features/product-categories/ProductCategoryProductSections';
import type { ProductCategoryTreeNode } from '@/features/product-categories/product-category-tree';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicExtraBlocksPayload } from '@/types/contracts/public-page-contents';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

type ProductLandingViewProps = {
  banners: PublicBannerListItem[];
  brandDirectory: PublicBrandListItem[];
  categoryTree: ProductCategoryTreeNode[];
  companyInfo: PublicCompanyInfo | null;
  contentHtml: string | null | undefined;
  excerpt: string | null | undefined;
  extraBlocks: PublicExtraBlocksPayload | null | undefined;
  sections: ProductCategoryProductSection[];
  title: string;
};

export function ProductLandingView({
  banners,
  brandDirectory,
  categoryTree,
  companyInfo,
  contentHtml,
  excerpt,
  extraBlocks,
  sections,
  title
}: ProductLandingViewProps) {
  const hasBanners = banners.length > 0;
  const hasExtraBlocks = (extraBlocks?.blocks ?? []).length > 0;

  return (
    <div className="bg-panel">
      <div className="border-b border-borderBlue bg-white">
        <Container className="py-4 sm:py-5" size="wide">
          <nav aria-label="Breadcrumb" className="type-caption flex items-center gap-2 text-body/75">
            <Link className="transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="/">
              Trang chủ
            </Link>
            <span aria-hidden="true" className="text-body/40">/</span>
            <span aria-current="page" className="font-bold text-primaryStrong">Sản phẩm</span>
          </nav>
        </Container>
      </div>

      <PageSectionLayout
        blocks={extraBlocks}
        defaults={['products-hero', 'products-catalog', 'products-supporting']}
        required={['products-catalog']}
        sections={{
          'products-hero': hasBanners ? (
            <section aria-label="Chiến dịch sản phẩm" className="border-b border-borderBlue bg-[#eaf2fd]">
              <Container size="wide">
                <div data-product-campaign-frame="true">
                  <HomeHeroBannerCarousel
                    ariaLabel="Banner trang sản phẩm"
                    banners={banners}
                    companyInfo={companyInfo}
                    variant="page"
                  />
                </div>
              </Container>
            </section>
          ) : null,
          'products-catalog': (
            <section className="bg-panel pb-16 pt-9 sm:pt-12 lg:pb-20 lg:pt-14">
              <Container className="space-y-9 lg:space-y-12" size="wide">
                <header
                  className="flex flex-col justify-between gap-6 border-b border-borderBlue pb-7 lg:flex-row lg:items-end lg:gap-12"
                  data-product-landing-header="true"
                >
                  <div className="min-w-0">
                    <h1 className="type-page-title text-secondary">{title}</h1>
                    {excerpt?.trim() ? (
                      <p className="mt-3 max-w-[70ch] type-body-lg text-body">{excerpt}</p>
                    ) : null}
                  </div>
                  <Link
                    className="type-button inline-flex min-h-11 shrink-0 items-center gap-2 self-start border-b border-primaryStrong font-bold text-primaryStrong transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:self-auto"
                    href="/san-pham/danh-sach"
                  >
                    Xem tất cả sản phẩm <span aria-hidden="true">→</span>
                  </Link>
                </header>

                {sections.length > 0 ? (
                  <ProductCategoryProductSections brandDirectory={brandDirectory} categoryTree={categoryTree} sections={sections} />
                ) : (
                  <ProductCategoryHierarchy categoryTree={categoryTree} />
                )}
                {hasMeaningfulPublicContent(contentHtml) ? (
                  <div className="border-t border-borderBlue pt-6 text-body" data-product-editorial-copy="true">
                    <SanitizedHtmlContent
                      className="max-w-[80ch] [&_h2]:text-[20px] [&_p]:text-[15px]"
                      html={contentHtml}
                    />
                  </div>
                ) : null}
              </Container>
            </section>
          ),
          'products-supporting': hasExtraBlocks ? (
            <ExtraBlocksRenderer blocks={extraBlocks ?? null} containerSize="wide" />
          ) : null
        }}
      />
    </div>
  );
}
