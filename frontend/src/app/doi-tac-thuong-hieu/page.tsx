import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PartnerListingPage } from '@/features/partners/PartnerListingPage';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicPageContentBySlug, getPublicPageContentBySlugOrNull } from '@/lib/api/public-page-contents';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';

type BrandDirectoryContent = PublicPageContentDetailResponse['page_content'];

function normalizeLegacyBrandCopy(page: BrandDirectoryContent | null): BrandDirectoryContent | null {
  if (!page) return null;

  // Chỉ thay những câu mẫu cũ; sửa riêng từng trường trong admin vẫn được đưa ra website.
  return {
    ...page,
    title: page.title.trim() === 'Thương hiệu đối tác' ? 'Thương hiệu sản phẩm' : page.title,
    excerpt: page.excerpt?.trim() === 'Các thương hiệu thiết bị điện công nghiệp Song Thanh phân phối chính hãng cho công trình và doanh nghiệp.'
      ? null : page.excerpt,
    seo_title: page.seo_title?.trim() === 'Thương hiệu đối tác | Song Thanh' ? null : page.seo_title,
    seo_description: page.seo_description?.trim() === 'Danh sách thương hiệu thiết bị điện công nghiệp Song Thanh phân phối chính hãng.'
      ? null : page.seo_description
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug('doi-tac-thuong-hieu')
    .then((response) => response.page_content)
    .catch(() => null);
  const publicCopy = normalizeLegacyBrandCopy(pageContent);

  return buildSeoMetadata({
    title: publicCopy?.seo_title?.trim() || publicCopy?.title?.trim() || 'Thương hiệu sản phẩm | Song Thanh',
    description:
      publicCopy?.seo_description?.trim() ||
      publicCopy?.excerpt?.trim() ||
      'Danh sách thương hiệu sản phẩm trong lĩnh vực thiết bị điện, chiếu sáng, dây cáp và vật tư kỹ thuật tại Song Thanh.',
    path: '/doi-tac-thuong-hieu',
    image: resolvePublicFileSource(publicCopy?.featured_image)
  });
}

export default async function PartnersRoutePage() {
  const pageContent = await getPublicPageContentBySlugOrNull('doi-tac-thuong-hieu');
  if (!pageContent) notFound();

  const [brandsResponse, heroBannersResponse] = await Promise.all([
    getAllPublicBrands(),
    getPublicBannersForPlacement('BRANDS_HERO').catch(() =>
      emptyPublicBannersForPlacement('BRANDS_HERO')
    )
  ]);

  return (
    <PartnerListingPage
      banners={heroBannersResponse.items}
      brands={brandsResponse.items}
      pageContent={normalizeLegacyBrandCopy(pageContent)}
    />
  );
}
