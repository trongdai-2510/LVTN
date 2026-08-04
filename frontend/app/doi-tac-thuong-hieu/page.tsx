import type { Metadata } from 'next';

import { PartnerListingPage } from '@/features/partners/PartnerListingPage';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug('doi-tac-thuong-hieu')
    .then((response) => response.page_content)
    .catch(() => null);

  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Thương hiệu sản phẩm | Song Thanh',
    description:
      pageContent?.seo_description?.trim() ||
      pageContent?.excerpt?.trim() ||
      'Danh sách thương hiệu sản phẩm trong lĩnh vực thiết bị điện, chiếu sáng, dây cáp và vật tư kỹ thuật tại Song Thanh.',
    path: '/doi-tac-thuong-hieu',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

export default async function PartnersRoutePage() {
  const [brandsResponse, pageContentResponse, heroBannersResponse] = await Promise.all([
    getAllPublicBrands().catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 40, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getPublicPageContentBySlug('doi-tac-thuong-hieu').then((response) => response.page_content).catch(() => null),
    getPublicBannersForPlacement('BRANDS_HERO').catch(() =>
      emptyPublicBannersForPlacement('BRANDS_HERO')
    )
  ]);

  return (
    <PartnerListingPage
      banners={heroBannersResponse.items}
      brands={brandsResponse.items}
      pageContent={pageContentResponse}
    />
  );
}
