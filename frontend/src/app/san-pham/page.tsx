import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  type ProductCategoryProductSection
} from '@/features/product-categories/ProductCategoryProductSections';
import { ProductLandingView } from '@/features/product-categories/ProductLandingView';
import { categoryPage } from '@/features/product-categories/categoryBrowse';
import {
  buildProductCategoryTree
} from '@/features/product-categories/product-category-tree';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicPageContentBySlug, getPublicPageContentBySlugOrNull } from '@/lib/api/public-page-contents';
import { getPublicProductCategories } from '@/lib/api/public-product-categories';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const PRODUCT_PAGE_SLUG = 'san-pham';
const PRODUCT_SECTION_PREVIEW_LIMIT = 4;
const FALLBACK_TITLE = 'Danh mục sản phẩm';
const FALLBACK_EXCERPT =
  'Thiết bị điện và vật tư công nghiệp cho công trình và doanh nghiệp.';

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
  const pageContent = await getPublicPageContentBySlugOrNull(PRODUCT_PAGE_SLUG);
  if (!pageContent) notFound();

  const [categoriesResponse, heroBannersResponse, shell, brandsResponse] = await Promise.all([
    getPublicProductCategories().catch(() => ({ items: [] })),
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
  const initialCategories = categoryPage(categoryTree, 1);
  const productSectionResponses = await Promise.all(
    initialCategories.map((category) =>
      getPublicProductGroups({
        category_id: category.id,
        page: 1,
        page_size: PRODUCT_SECTION_PREVIEW_LIMIT,
        sort: 'popular'
      }).catch(() => null)
    )
  );
  const productSections: ProductCategoryProductSection[] = initialCategories
    .map((category, index) => {
      const response = productSectionResponses[index];
      return {
        brands: response?.facets.brands ?? [],
        category,
        products: response?.items ?? [],
        total: response?.pagination.total ?? 0
      };
    });
  const title = pageContent.title?.trim() || FALLBACK_TITLE;
  const excerpt = pageContent.excerpt?.trim() || '';
  return (
    <ProductLandingView
      banners={heroBannersResponse.items}
      brandDirectory={brandsResponse.items}
      categoryTree={categoryTree}
      companyInfo={shell.company_info}
      contentHtml={pageContent.content_html}
      excerpt={excerpt}
      extraBlocks={pageContent.extra_blocks}
      sections={productSections}
      title={title}
    />
  );
}
