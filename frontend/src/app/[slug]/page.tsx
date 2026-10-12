import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import {
  buildStaticPageMetadata,
  StaticPageContentPage
} from '@/features/page-content/StaticPageContentPage';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { PublicApiError } from '@/lib/api/public-fetcher';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import {
  emptyPublicBannersForPlacement,
  getPublicBannersForPlacement,
  getPublicBannersForPath,
  type PublicBannerPlacement
} from '@/lib/public-banner-placement';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';

const SLUG_BANNER_PLACEMENTS: Record<string, PublicBannerPlacement> = {
  'chinh-sach-van-chuyen': 'SHIPPING_POLICY_HERO'
};

type StaticPageRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

// Slug hợp lệ: chỉ chữ thường, số, dấu gạch nối; bắt đầu bằng chữ/số.
// Loại ra các request rác (favicon.ico, robots.txt, sitemap.xml, ...) để
// không gọi API thừa rồi vỡ thành 500.
const PUBLIC_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

async function getStaticPage(slug: string): Promise<PublicPageContentDetailResponse['page_content']> {
  // Tiền kiểm tra format — nếu slug không hợp lệ thì coi như không tồn tại,
  // tránh gửi request validation chắc chắn fail xuống backend.
  if (!PUBLIC_SLUG_PATTERN.test(slug)) {
    notFound();
  }

  try {
    const response = await getPublicPageContentBySlug(slug);

    if (response.page_content.content_type !== 'page') {
      notFound();
    }

    return response.page_content;
  } catch (error) {
    // 404: không tìm thấy. 400/VALIDATION_ERROR: slug sai format ngay từ phía
    // backend (vd ký tự lạ). Cả hai đều có ý nghĩa "trang không tồn tại" →
    // trả 404, không leak thành 500.
    if (
      error instanceof PublicApiError &&
      (error.status === 404 || error.status === 400)
    ) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata({ params }: StaticPageRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStaticPage(slug).catch(() => null);

  if (!page) {
    return {
      title: 'Song Thanh'
    };
  }

  return buildStaticPageMetadata(page);
}

export default async function StaticPageRoute({ params }: StaticPageRouteProps) {
  const { slug } = await params;

  const bannerPlacement = SLUG_BANNER_PLACEMENTS[slug];

  const [page, shell, bannerResponse] = await Promise.all([
    getStaticPage(slug),
    getPublicSiteShell().catch(() => null),
    (bannerPlacement
      ? getPublicBannersForPlacement(bannerPlacement)
      : getPublicBannersForPath(`/${slug}`)
    ).catch(() => bannerPlacement ? emptyPublicBannersForPlacement(bannerPlacement) : null)
  ]);

  const banners: PublicBannerListItem[] = bannerResponse?.items ?? [];

  return (
    <>
      {slug !== 'chinh-sach-van-chuyen' && banners.length > 0 ? (
        <HomeHeroBannerCarousel ariaLabel={`Banner trang ${page.title}`} banners={banners} companyInfo={shell?.company_info ?? null} variant="page" />
      ) : null}
      <StaticPageContentPage banners={banners} page={page} shell={shell} slug={slug} />
    </>
  );
}
