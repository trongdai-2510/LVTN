import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ServiceListingPage } from '@/features/services/ServiceListingPage';
import { getPublicPageContentBySlug, getPublicPageContentBySlugOrNull } from '@/lib/api/public-page-contents';
import { getPublicServices } from '@/lib/api/public-services';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { resolvePublicFileSource } from '@/lib/public-file';
import { buildSeoMetadata } from '@/lib/seo/metadata';

export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getPublicPageContentBySlug('dich-vu')
    .then((response) => response.page_content)
    .catch(() => null);

  return buildSeoMetadata({
    title: pageContent?.seo_title?.trim() || pageContent?.title?.trim() || 'Dịch vụ | Song Thanh',
    description:
      pageContent?.seo_description?.trim() ||
      pageContent?.excerpt?.trim() ||
      'Dịch vụ kỹ thuật điện công nghiệp của Song Thanh dành cho công trình và nhà máy.',
    path: '/dich-vu',
    image: resolvePublicFileSource(pageContent?.featured_image)
  });
}

export default async function ServicesRoutePage() {
  const pageContent = await getPublicPageContentBySlugOrNull('dich-vu');
  if (!pageContent) notFound();

  const [servicesResponse, heroBannersResponse, shell] = await Promise.all([
    getPublicServices({ page: 1, page_size: 40 }),
    getPublicBannersForPlacement('SERVICES_HERO').catch(() =>
      emptyPublicBannersForPlacement('SERVICES_HERO')
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
    <ServiceListingPage
      banners={heroBannersResponse.items}
      companyInfo={shell.company_info}
      pageContent={pageContent}
      services={servicesResponse.items}
    />
  );
}
