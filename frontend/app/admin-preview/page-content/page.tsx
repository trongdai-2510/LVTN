import type { Metadata } from 'next';

import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicProjects } from '@/lib/api/public-projects';
import { getPublicServices } from '@/lib/api/public-services';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';

import { PageContentPreviewClient } from './PageContentPreviewClient';

export const metadata: Metadata = {
  title: 'Preview noi dung | Song Thanh',
  robots: {
    index: false,
    follow: false
  }
};

export default async function PageContentPreviewRoute() {
  const [
    brandsResponse,
    servicesResponse,
    projectsResponse,
    aboutBannersResponse,
    serviceBannersResponse,
    brandBannersResponse,
    shell
  ] = await Promise.all([
    getAllPublicBrands().catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 40, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getPublicServices({ page: 1, page_size: 40 }).catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 40, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getPublicProjects({ page: 1, page_size: 40 }).catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 40, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getPublicBannersForPlacement('ABOUT_HERO').catch(() =>
      emptyPublicBannersForPlacement('ABOUT_HERO')
    ),
    getPublicBannersForPlacement('SERVICES_HERO').catch(() =>
      emptyPublicBannersForPlacement('SERVICES_HERO')
    ),
    getPublicBannersForPlacement('BRANDS_HERO').catch(() =>
      emptyPublicBannersForPlacement('BRANDS_HERO')
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
    <PageContentPreviewClient
      supportData={{
        banners: aboutBannersResponse.items,
        brands: brandsResponse.items,
        serviceBanners: serviceBannersResponse.items,
        brandBanners: brandBannersResponse.items,
        services: servicesResponse.items,
        projects: projectsResponse.items,
        companyInfo: shell.company_info
      }}
    />
  );
}
