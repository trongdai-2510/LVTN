import type { Metadata } from 'next';

import { getPublicBanners } from '@/lib/api/public-banners';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { DEFAULT_HOME_LAYOUT, getPublicHomePage } from '@/lib/api/public-home-page';
import { getPublicPageContentBySlug } from '@/lib/api/public-page-contents';
import { getPublicProductCategories } from '@/lib/api/public-product-categories';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { getPublicProjects } from '@/lib/api/public-projects';
import { getPublicServices } from '@/lib/api/public-services';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import {
  emptyPublicBannersForPlacement,
  getPublicBannersForPlacement
} from '@/lib/public-banner-placement';
import { sortProductCategories } from '@/features/product-categories/product-category-tree';
import type {
  HeroSectionConfig,
  HomeSectionType,
  PublicHomeLayoutResponse,
  PublicHomeSection
} from '@/types/contracts/public-home-page';
import {
  HomeCompanyOverviewSection,
  HomeContactCtaSection,
  HomeFeaturedProductsSection,
  HomeHeroSection,
  HomePartnersSection,
  HomeProductCategoriesSection,
  HomeProjectsSection,
  HomeServicesSection,
  HomeTrustStripSection
} from '@/features/home/HomeVisualSections';

const HOME_FEATURED_PRODUCT_PAGE_SIZE = 8;
const HOME_BRAND_PAGE_SIZE = 40;

export async function generateMetadata(): Promise<Metadata> {
  const layout = await getPublicHomePage().catch(() => DEFAULT_HOME_LAYOUT);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://songthanhelectric.com.vn').replace(/\/$/, '');
  const title = layout.seo?.title?.trim() || 'Song Thanh - Thiết bị điện và chiếu sáng';
  const description = layout.seo?.description?.trim() ||
    'Song Thanh cung cấp thông tin thiết bị điện, chiếu sáng, thương hiệu, dự án và dịch vụ kỹ thuật.';
  return {
    title,
    description,
    alternates: { canonical: siteUrl },
    openGraph: { type: 'website', url: siteUrl, title, description },
    twitter: { card: 'summary_large_image', title, description }
  };
}

function findSection(
  layout: PublicHomeLayoutResponse,
  type: HomeSectionType
): PublicHomeSection | null {
  return layout.sections.find((section) => section.section_type === type) ?? null;
}

function configOf<T>(section: PublicHomeSection | null): T | undefined {
  if (!section) return undefined;
  return section.config as unknown as T;
}

export default async function HomePage() {
  const layout = await getPublicHomePage().catch(() => DEFAULT_HOME_LAYOUT);

  const heroSection = findSection(layout, 'hero');
  const heroConfig = configOf<HeroSectionConfig>(heroSection);
  const heroFetch =
    heroConfig?.mode === 'manual' && heroConfig.banner_ids.length > 0
      ? getPublicBanners({ ids: heroConfig.banner_ids })
      : getPublicBannersForPlacement('HOME_HERO');

  const companyOverviewSection = findSection(layout, 'company_overview');
  const companyOverviewSlug =
    configOf<{ page_content_slug: string }>(companyOverviewSection)?.page_content_slug ||
    'gioi-thieu';

  const [
    categoriesResponse,
    productGroupsResponse,
    servicesResponse,
    projectsResponse,
    brandsResponse,
    heroBannersResponse,
    companyAboutPage,
    shell
  ] = await Promise.all([
    getPublicProductCategories().catch(() => ({ items: [] })),
    getPublicProductGroups({ page: 1, page_size: HOME_FEATURED_PRODUCT_PAGE_SIZE, sort: 'popular' }).catch(() => ({
      items: [],
      pagination: { page: 1, page_size: HOME_FEATURED_PRODUCT_PAGE_SIZE, total: 0, page_count: 1 },
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
    })),
    getPublicServices({ page: 1, page_size: 4 }).catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 4, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getPublicProjects({ page: 1, page_size: 12 }).catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 12, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    getAllPublicBrands().catch(() => ({
      items: [],
      pagination: { page: 1, page_size: HOME_BRAND_PAGE_SIZE, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    heroFetch.catch(() => emptyPublicBannersForPlacement('HOME_HERO')),
    getPublicPageContentBySlug(companyOverviewSlug)
      .then((response) => response.page_content)
      .catch(() => null),
    getPublicSiteShell().catch(() => ({
      company_info: null,
      social_links: [],
      header_menu: null,
      footer_quick_menu: null,
      footer_support_menu: null,
      footer_legal_menu: null
    }))
  ]);
  const rootCategories = sortProductCategories(
    categoriesResponse.items.filter((category) => category.parent_id === null)
  );

  const visibleSections = layout.sections
    .filter((section) => section.enabled)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {visibleSections.map((section) => {
        switch (section.section_type) {
          case 'hero':
            return (
              <HomeHeroSection
                key={section.id}
                banners={heroBannersResponse.items}
                companyInfo={shell.company_info}
              />
            );
          case 'product_categories':
            return (
              <HomeProductCategoriesSection
                key={section.id}
                categories={rootCategories}
                titleOverride={section.title_override}
                config={configOf(section)}
              />
            );
          case 'company_overview':
            return (
              <HomeCompanyOverviewSection
                key={section.id}
                companyInfo={shell.company_info}
                pageContent={companyAboutPage}
                titleOverride={section.title_override}
                config={configOf(section)}
              />
            );
          case 'featured_products':
            return (
              <HomeFeaturedProductsSection
                brands={brandsResponse.items}
                key={section.id}
                featuredProducts={productGroupsResponse.items}
                titleOverride={section.title_override}
                config={configOf(section)}
              />
            );
          case 'services':
            return (
              <HomeServicesSection
                key={section.id}
                services={servicesResponse.items}
                config={configOf(section)}
              />
            );
          case 'projects':
            return (
              <HomeProjectsSection
                key={section.id}
                projects={projectsResponse.items}
                titleOverride={section.title_override}
                config={configOf(section)}
              />
            );
          case 'brands':
            return (
              <HomePartnersSection
                key={section.id}
                brands={brandsResponse.items}
                config={configOf(section)}
              />
            );
          case 'trust_strip':
            return (
              <HomeTrustStripSection
                key={section.id}
                brands={brandsResponse.items}
                projects={projectsResponse.items}
                services={servicesResponse.items}
                config={configOf(section)}
              />
            );
          case 'contact_cta':
            return (
              <HomeContactCtaSection
                key={section.id}
                companyInfo={shell.company_info}
                titleOverride={section.title_override}
                config={configOf(section)}
                variant="light"
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
