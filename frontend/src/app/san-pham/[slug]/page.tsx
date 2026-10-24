import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  buildProductCategoryTree,
  createProductCategoryNodeMap,
  findProductCategoryRoot,
  getPublicProductCategorySlug,
  getProductCategoryPath
} from '@/features/product-categories/product-category-tree';
import { buildProductListingHref } from '@/features/product-categories/product-category-routing';
import { ProductDetailContent } from '@/features/product-detail/ProductDetailContent';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { getPublicProductCategories } from '@/lib/api/public-product-categories';
import { getPublicProductGroupBySlug, getPublicProductGroups } from '@/lib/api/public-product-groups';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { resolvePublicFileSource } from '@/lib/public-file';
import { serializeJsonLd } from '@/lib/seo/json-ld';
import { buildSeoMetadata, toAbsoluteSiteUrl } from '@/lib/seo/metadata';
import { getPublicPrimaryHotline } from '@/features/site-shell/site-shell.public';
import { getPublicBannersForPath } from '@/lib/public-banner-placement';

type ProductDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    variant?: string;
  }>;
};

function plainText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

function truncateAtWord(value: string | null, limit: number): string | null {
  if (!value || value.length <= limit) return value;
  const clipped = value.slice(0, limit - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.7 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

function buildVariantUrl(productUrl: string, variantId: string): string {
  const variantUrl = new URL(productUrl);
  variantUrl.searchParams.set('variant', variantId);
  return variantUrl.toString();
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const detail = await getPublicProductGroupBySlug(slug);
    const group = detail.product_group;
    const brandSuffix = group.brand_name ? ` ${group.brand_name}` : '';
    const title = `${group.name}${brandSuffix} | Song Thanh`;
    const description =
      plainText(group.short_description) ||
      truncateAtWord(plainText(group.detailed_description), 200) ||
      `${group.name}${brandSuffix} — thông số, hình ảnh và báo giá tại Song Thanh.`;
    const ogImage = resolvePublicFileSource(group.thumbnail_file) || undefined;

    return buildSeoMetadata({
      title,
      description,
      path: `/san-pham/${group.slug}`,
      image: ogImage
    });
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) {
      return { title: 'Sản phẩm không tồn tại | Song Thanh' };
    }
    throw error;
  }
}

export default async function ProductDetailPage({
  params,
  searchParams
}: ProductDetailPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialVariantToken =
    typeof resolvedSearchParams.variant === 'string'
      ? resolvedSearchParams.variant
      : null;
  const detail = await getPublicProductGroupBySlug(slug).catch((error: PublicApiError) => {
    if (error?.status === 404) {
      notFound();
    }

    throw error;
  });

  const [relatedResponse, shell, categoriesResponse, bannerResponse] = await Promise.all([
    detail.product_group.category_id
      ? getPublicProductGroups({
          category_id: detail.product_group.category_id,
          page: 1,
          page_size: 4
        }).catch(() => ({
          items: [],
          pagination: { page: 1, page_size: 4, total: 0, page_count: 1 },
          filters: {
            q: null,
            category_id: detail.product_group.category_id,
            brand_id: null,
            brands: null,
            status: null,
            sort: null,
            spec_filters: []
          },
          facets: {
            brands: [],
            status: [],
            child_categories: [],
            specs: []
          }
        }))
      : Promise.resolve({
          items: [],
          pagination: { page: 1, page_size: 4, total: 0, page_count: 1 },
          filters: {
            q: null,
            category_id: null,
            brand_id: null,
            brands: null,
            status: null,
            sort: null,
            spec_filters: []
          },
          facets: {
            brands: [],
            status: [],
            child_categories: [],
            specs: []
          }
        }),
    getPublicSiteShell().catch(() => ({
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    })),
    getPublicProductCategories().catch(() => ({ items: [] })),
    getPublicBannersForPath(`/san-pham/${slug}`).catch(() => ({ items: [] }))
  ]);

  const relatedItems = relatedResponse.items.filter((item) => item.id !== detail.product_group.id);
  const categoryTree = buildProductCategoryTree(categoriesResponse.items);
  const categoryNodeMap = createProductCategoryNodeMap(categoryTree);
  const categoryPath = getProductCategoryPath(categoryNodeMap, detail.product_group.category_id);
  const rootCategory =
    categoryPath[0] ??
    findProductCategoryRoot(categoryNodeMap, detail.product_group.category_id);
  const categoryBreadcrumbItems =
    categoryPath.length > 0
        ? categoryPath.map((category, index) => ({
            href: buildProductListingHref(
              category.parent_id && rootCategory
              ? {
                  parentSlug: getPublicProductCategorySlug(rootCategory),
                  categorySlugs: [getPublicProductCategorySlug(category)]
                }
              : { parentSlug: getPublicProductCategorySlug(category) }
          ),
          id: category.id,
          label: category.name,
          isCurrent: index === categoryPath.length - 1
        }))
      : detail.product_group.category_name
        ? [
            {
              href: buildProductListingHref(),
              id: detail.product_group.category_id,
              label: detail.product_group.category_name,
              isCurrent: true
            }
          ]
        : [];

  const productUrl = toAbsoluteSiteUrl(`/san-pham/${detail.product_group.slug}`);
  const productImageSource = resolvePublicFileSource(detail.product_group.thumbnail_file);
  const productImage = productImageSource ? toAbsoluteSiteUrl(productImageSource) : null;
  const productDescription =
    plainText(detail.product_group.short_description) ||
    truncateAtWord(plainText(detail.product_group.detailed_description), 300) ||
    detail.product_group.name;
  const pricedVariants = detail.variants.flatMap((variant) => {
    const price = variant.public_price_amount;
    if (
      variant.public_price_mode !== 'public_price' ||
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return [];
    }

    return [{ ...variant, public_price_amount: price }];
  });
  const commonProductProperties = {
    ...(productImage ? { image: productImage } : {}),
    ...(detail.product_group.brand_name
      ? { brand: { '@type': 'Brand', name: detail.product_group.brand_name } }
      : {}),
    ...(detail.product_group.category_name ? { category: detail.product_group.category_name } : {})
  };
  const pricedProductVariants = pricedVariants.map((variant) => {
    const variantUrl = buildVariantUrl(productUrl, variant.id);
    const variantLabel = variant.variant_name?.trim() || variant.model_code?.trim();

    return {
      '@type': 'Product',
      name: variantLabel
        ? `${detail.product_group.name} - ${variantLabel}`
        : detail.product_group.name,
      url: variantUrl,
      ...(variant.model_code ? { model: variant.model_code } : {}),
      ...commonProductProperties,
      description: plainText(variant.detailed_description) || productDescription,
      offers: {
        '@type': 'Offer',
        url: variantUrl,
        priceCurrency: 'VND',
        price: variant.public_price_amount
      }
    };
  });
  const productJsonLd =
    pricedProductVariants.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ProductGroup',
          '@id': `${productUrl}#product-group`,
          name: detail.product_group.name,
          url: productUrl,
          productGroupID: detail.product_group.id,
          ...commonProductProperties,
          description: productDescription,
          hasVariant: pricedProductVariants
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: detail.product_group.name,
          url: productUrl,
          description: productDescription,
          ...(productImage ? { primaryImageOfPage: productImage } : {}),
          ...(detail.product_group.brand_name
            ? { about: { '@type': 'Thing', name: detail.product_group.brand_name } }
            : {})
        };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }}
      />
      {bannerResponse.items.length > 0 ? <HomeHeroBannerCarousel ariaLabel={`Banner sản phẩm ${detail.product_group.name}`} banners={bannerResponse.items} companyInfo={shell.company_info} variant="page" /> : null}
      <ProductDetailContent
        categoryBreadcrumbItems={categoryBreadcrumbItems}
        detail={detail}
        hotline={getPublicPrimaryHotline(shell.company_info)}
        initialVariantToken={initialVariantToken}
        relatedItems={relatedItems}
      />
    </>
  );
}
