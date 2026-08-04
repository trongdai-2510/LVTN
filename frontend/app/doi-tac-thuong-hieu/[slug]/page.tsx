import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BrandDetailPage } from '@/features/partners/BrandDetailPage';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { getPublicBrandBySlug } from '@/lib/api/public-brands';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

type BrandDetailRoutePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params
}: BrandDetailRoutePageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const brandDetail = await getPublicBrandBySlug(slug);
    const seoTitle =
      brandDetail.brand_page.seo_title?.trim() ||
      brandDetail.brand_page.title ||
      `${brandDetail.brand.name} | Song Thanh`;
    const seoDescription =
      brandDetail.brand_page.seo_description?.trim() ||
      brandDetail.brand_page.excerpt?.trim() ||
      brandDetail.brand.description?.trim() ||
      `Thông tin sản phẩm ${brandDetail.brand.name} tại Song Thanh.`;
    const ogImage =
      resolvePublicFileSource(brandDetail.brand_page.seo_og_image_file) ||
      resolvePublicFileSource(brandDetail.hero_banner?.image_file) ||
      resolvePublicFileSource(brandDetail.brand.logo_file) ||
      undefined;

    return buildSeoMetadata({
      title: seoTitle,
      description: seoDescription,
      path: `/doi-tac-thuong-hieu/${brandDetail.brand.slug}`,
      image: ogImage
    });
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) {
      return {
        title: 'Thương hiệu không tồn tại | Song Thanh'
      };
    }

    throw error;
  }
}

export default async function BrandDetailRoutePage({
  params
}: BrandDetailRoutePageProps) {
  const { slug } = await params;

  try {
    const brandDetail = await getPublicBrandBySlug(slug);
    const brandProductsResponse = await getPublicProductGroups({
      brands: brandDetail.brand.slug,
      page: 1,
      page_size: 12,
      sort: 'popular'
    }).catch(() => ({ items: [] }));

    return (
      <BrandDetailPage
        brandDetail={brandDetail}
        brandProducts={brandProductsResponse.items}
      />
    );
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
}
