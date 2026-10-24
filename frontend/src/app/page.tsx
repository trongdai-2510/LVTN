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
import { selectHomeBannerSource } from '@/lib/homeBannerSelection';
import {
  emptyPublicBannersForPlacement,
  getPublicBannersForPlacement
} from '@/lib/public-banner-placement';
import { sortProductCategories } from '@/features/product-categories/product-category-tree';
import type {
  FeaturedProductsSectionConfig,
  HeroSectionConfig,
  HomeSectionType,
  ProjectsSectionConfig,
  PublicHomeLayoutResponse,
  PublicHomeSection,
  ServicesSectionConfig,
  TrustStripSectionConfig
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
  const layout = await getPublicHomePage();

  const heroSection = findSection(layout, 'hero');
  const heroConfig = configOf<HeroSectionConfig>(heroSection);
  const heroSource = selectHomeBannerSource(heroConfig);
  let heroFetch;
  switch (heroSource.mode) {
    case 'ids':
      heroFetch = getPublicBanners({ ids: heroSource.ids });
      break;
    case 'position':
      heroFetch = getPublicBanners({ position: heroSource.position });
      break;
    case 'none':
      heroFetch = Promise.resolve(emptyPublicBannersForPlacement('HOME_HERO'));
      break;
    default:
      heroFetch = getPublicBannersForPlacement('HOME_HERO');
  }

  const companyOverviewSection = findSection(layout, 'company_overview');
  const companyOverviewSlug =
    configOf<{ page_content_slug: string }>(companyOverviewSection)?.page_content_slug ||
    'gioi-thieu';
  const featuredConfig = configOf<FeaturedProductsSectionConfig>(findSection(layout, 'featured_products'));
  const servicesConfig = configOf<ServicesSectionConfig>(findSection(layout, 'services'));
  const projectsConfig = configOf<ProjectsSectionConfig>(findSection(layout, 'projects'));
  const trustStripSection = findSection(layout, 'trust_strip');
  const autoTrustEnabled = trustStripSection?.enabled && configOf<TrustStripSectionConfig>(trustStripSection)?.mode !== 'manual';
  const featuredIds = featuredConfig?.mode === 'manual' ? featuredConfig.product_group_ids : null;
  const serviceIds = servicesConfig?.mode === 'manual' ? servicesConfig.service_ids : null;
  const projectIds = projectsConfig?.mode === 'manual' ? projectsConfig.project_ids : null;

  const [
    categoriesResult,
    productGroupsResult,
    servicesResponse,
    projectsResponse,
    brandsResponse,
    heroBannersResponse,
    companyAboutPage,
    shell,
    manualServiceTotal,
    manualProjectTotal
  ] = await Promise.all([
    getPublicProductCategories()
      .then((response) => ({ response, unavailable: false }))
      .catch(() => ({ response: null, unavailable: true })),
    (featuredIds?.length === 0
      ? Promise.resolve({ response: null, unavailable: false })
      : getPublicProductGroups({
          ids: featuredIds?.join(','),
          page: 1,
          page_size: featuredIds ? featuredIds.length : (featuredConfig?.item_limit ?? 8),
          sort: featuredConfig?.sort ?? 'popular'
        })
          .then((response) => ({ response, unavailable: false }))
          .catch(() => ({ response: null, unavailable: true }))),
    (serviceIds?.length === 0
      ? Promise.resolve({ items: [], pagination: { page: 1, page_size: 1, total: 0, page_count: 1 }, filters: { q: null } })
      : getPublicServices({
          ids: serviceIds?.join(','),
          page: 1,
          page_size: serviceIds ? serviceIds.length : (servicesConfig?.item_limit ?? 4)
        })
    ).catch(() => ({
      items: [],
      pagination: { page: 1, page_size: 4, total: 0, page_count: 1 },
      filters: { q: null }
    })),
    (projectIds?.length === 0
      ? Promise.resolve({ items: [], pagination: { page: 1, page_size: 1, total: 0, page_count: 1 }, filters: { q: null } })
      : getPublicProjects({
          ids: projectIds?.join(','),
          page: 1,
          page_size: projectIds ? projectIds.length : (projectsConfig?.item_limit ?? 12)
        })
    ).catch(() => ({
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
    })),
    autoTrustEnabled && serviceIds !== null
      ? getPublicServices({ page: 1, page_size: 1 }).then((response) => response.pagination.total).catch(() => 0)
      : Promise.resolve(null),
    autoTrustEnabled && projectIds !== null
      ? getPublicProjects({ page: 1, page_size: 1 }).then((response) => response.pagination.total).catch(() => 0)
      : Promise.resolve(null)
  ]);
  const rootCategories = sortProductCategories(
    (categoriesResult.response?.items ?? []).filter((category) => category.parent_id === null)
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
                unavailable={categoriesResult.unavailable}
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
                featuredProducts={productGroupsResult.response?.items ?? []}
                unavailable={productGroupsResult.unavailable}
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
                brandCount={brandsResponse.pagination.total}
                projectCount={projectIds !== null ? (manualProjectTotal ?? 0) : projectsResponse.pagination.total}
                serviceCount={serviceIds !== null ? (manualServiceTotal ?? 0) : servicesResponse.pagination.total}
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
