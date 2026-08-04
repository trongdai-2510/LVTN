import type { Metadata } from 'next';

import { CompanyAboutPage } from '@/features/company-about/CompanyAboutPage';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const ABOUT_BRAND_PAGE_SIZE = 40;

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug('gioi-thieu')
    .then((response) => response.page_content)
    .catch(() => null);

  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Giới thiệu | Song Thanh',
    description:
      pageContent?.seo_description?.trim() ||
      pageContent?.excerpt?.trim() ||
      'Thông tin doanh nghiệp, năng lực cung cấp và thương hiệu sản phẩm của Song Thanh.',
    path: '/gioi-thieu',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

export default async function AboutRoutePage() {
  const [brandsResponse, pageContentResponse, heroBannersResponse, shell] = await Promise.all([
    getAllPublicBrands().catch(() => ({
      items: [],
      pagination: { page: 1, page_size: ABOUT_BRAND_PAGE_SIZE, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getPublicPageContentBySlug('gioi-thieu')
      .then((response) => response.page_content)
      .catch(() => null),
    getPublicBannersForPlacement('ABOUT_HERO').catch(() =>
      emptyPublicBannersForPlacement('ABOUT_HERO')
    ),
    getPublicSiteShell().catch(() => ({
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    }))
  ]);

  return (
    <CompanyAboutPage
      banners={heroBannersResponse.items}
      brands={brandsResponse.items}
      companyInfo={shell.company_info}
      pageContent={pageContentResponse}
    />
  );
}
