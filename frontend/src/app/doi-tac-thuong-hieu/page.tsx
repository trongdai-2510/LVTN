import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PartnerListingPage } from '@/features/partners/PartnerListingPage';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicPartners } from '@/lib/api/publicPartners';
import { getPublicPageContentBySlug, getPublicPageContentBySlugOrNull } from '@/lib/api/public-page-contents';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug('doi-tac-thuong-hieu')
    .then((response) => response.page_content)
    .catch(() => null);
  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Thương hiệu và đối tác | Song Thanh',
    description:
      pageContent?.seo_description?.trim() ||
      pageContent?.excerpt?.trim() ||
      'Danh sách thương hiệu sản phẩm và đối tác của Song Thanh.',
    path: '/doi-tac-thuong-hieu',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

export default async function PartnersRoutePage() {
  const pageContent = await getPublicPageContentBySlugOrNull('doi-tac-thuong-hieu');
  if (!pageContent) notFound();

  const [brandsResponse, partnersResponse, heroBannersResponse] = await Promise.all([
    getAllPublicBrands(),
    getPublicPartners(),
    getPublicBannersForPlacement('BRANDS_HERO').catch(() =>
      emptyPublicBannersForPlacement('BRANDS_HERO')
    )
  ]);

  return (
    <PartnerListingPage
      banners={heroBannersResponse.items}
      brands={brandsResponse.items}
      partners={partnersResponse.items}
      pageContent={pageContent}
    />
  );
}
