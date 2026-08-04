import type { Metadata } from 'next';
import Link from 'next/link';

import { SanitizedHtmlContent } from '@/components/content/SanitizedHtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { ProductCategoryHierarchy } from '@/features/product-categories/ProductCategoryHierarchy';
import {
  ProductCategoryProductSections,
  type ProductCategoryProductSection
} from '@/features/product-categories/ProductCategoryProductSections';
import { buildProductCategoryTree } from '@/features/product-categories/product-category-tree';
import { ProductCategorySearchForm } from '@/features/product-search/ProductCategorySearchForm';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getPublicProductCategories } from '@/lib/api/public-product-categories';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const PRODUCT_PAGE_SLUG = 'san-pham';
const PRODUCT_SECTION_PREVIEW_LIMIT = 10;
const FALLBACK_TITLE = 'Danh mục sản phẩm';
const FALLBACK_EXCERPT =
  'Tra cứu danh mục và nhóm sản phẩm thiết bị điện, vật tư công nghiệp đang được Song Thanh tổ chức cho khách hàng doanh nghiệp và công trình.';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug(PRODUCT_PAGE_SLUG)
    .then((response) => response.page_content)
    .catch(() => null);

  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Sản phẩm | Song Thanh',
    description: pageContent?.seo_description?.trim() || pageContent?.excerpt?.trim() || FALLBACK_EXCERPT,
    path: '/san-pham',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

export default async function ProductCategoryPage() {
  const [categoriesResponse, pageContentResponse, heroBannersResponse, shell, brandsResponse] = await Promise.all([
    getPublicProductCategories().catch(() => ({ items: [] })),
    getPublicPageContentBySlug(PRODUCT_PAGE_SLUG)
      .then((response) => response.page_content)
      .catch(() => null),
    getPublicBannersForPlacement('PRODUCTS_HERO').catch(() =>
      emptyPublicBannersForPlacement('PRODUCTS_HERO')
    ),
    getPublicSiteShell().catch(() => ({
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    })),
    getAllPublicBrands().catch(() => ({ items: [] }))
  ]);
  const categories = categoriesResponse.items;
  const categoryTree = buildProductCategoryTree(categories);
  const productSectionResponses = await Promise.all(
    categoryTree.map((category) =>
      getPublicProductGroups({
        category_id: category.id,
        page: 1,
        page_size: PRODUCT_SECTION_PREVIEW_LIMIT,
        sort: 'popular'
      }).catch(() => null)
    )
  );
  const productSections: ProductCategoryProductSection[] = categoryTree.map((category, index) => {
    const response = productSectionResponses[index];
    return {
      brands: response?.facets.brands ?? [],
      category,
      products: response?.items ?? [],
      total: response?.pagination.total ?? 0
    };
  });
  const title = pageContentResponse?.title?.trim() || FALLBACK_TITLE;
  const excerpt = pageContentResponse?.excerpt?.trim() || FALLBACK_EXCERPT;
  const hasHeroBanners = heroBannersResponse.items.length > 0;
  const hasExtraBlocks = (pageContentResponse?.extra_blocks?.blocks ?? []).length > 0;

  return (
    <div className="bg-panel">
      {hasHeroBanners ? (
        <>
          <Container className="px-6 pt-6 lg:px-8" size="wide">
            <ProductBreadcrumb />
          </Container>
          <HomeHeroBannerCarousel
            ariaLabel="Banner trang sản phẩm"
            banners={heroBannersResponse.items}
            companyInfo={shell.company_info}
            variant="page"
          />
        </>
      ) : null}

      <section className={hasHeroBanners ? 'pt-12 lg:pt-14' : 'pt-12 lg:pt-16'}>
        <Container className="space-y-8">
          {!hasHeroBanners ? <ProductBreadcrumb /> : null}

          <div className="space-y-4 px-6">
            <h1 className="type-page-title text-secondary">{title}</h1>
            <div className="h-[6px] w-24 bg-primary" />
            {excerpt ? <p className="type-body-lg max-w-[860px] text-body">{excerpt}</p> : null}
            {pageContentResponse?.content_html ? (
              <SanitizedHtmlContent
                className="max-w-[860px]"
                html={pageContentResponse.content_html}
              />
            ) : null}
          </div>

          <ProductCategorySearchForm categories={categoryTree} />
        </Container>
      </section>

      <section className="py-8 pb-20">
        <Container className="space-y-8">
          <ProductCategoryProductSections
            brandDirectory={brandsResponse.items}
            sections={productSections}
          />

          {productSections.length === 0 ? (
            <ProductCategoryHierarchy categoryTree={categoryTree} />
          ) : null}
        </Container>
      </section>

      {hasExtraBlocks ? (
        <ExtraBlocksRenderer blocks={pageContentResponse?.extra_blocks ?? null} containerSize="wide" />
      ) : null}
    </div>
  );
}

function ProductBreadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="type-caption flex flex-wrap items-center gap-2 font-medium text-body/70">
      <Link className={`transition-colors hover:text-primary ${FOCUS_RING}`} href="/">
        Trang chủ
      </Link>
      <span aria-hidden="true">/</span>
      <span className="font-bold text-primaryStrong">Sản phẩm</span>
    </nav>
  );
}
