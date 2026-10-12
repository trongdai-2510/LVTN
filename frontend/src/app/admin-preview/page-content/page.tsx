import type { Metadata } from 'next';

import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicNewsCategories, getPublicNewsList } from '@/lib/api/public-news';
import { getPublicProductCategories } from '@/lib/api/public-product-categories';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { getPublicProjects } from '@/lib/api/public-projects';
import { getPublicServices } from '@/lib/api/public-services';
import { getPublicSiteShell } from '@/lib/api/public-site-shell';
import { emptyPublicBannersForPlacement, getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import { buildProductCategoryTree } from '@/features/product-categories/product-category-tree';
import type { ProductCategoryProductSection } from '@/features/product-categories/ProductCategoryProductSections';
import type { PublicNewsListResponse } from '@/types/contracts/public-news';

import { PageContentPreviewClient } from './PageContentPreviewClient';

export const metadata: Metadata = {
  title: 'Preview noi dung | Song Thanh',
  robots: {
    index: false,
    follow: false
  }
};

export default async function PageContentPreviewRoute() {
  const emptyNews: PublicNewsListResponse = {
    items: [],
    total: 0,
    page: 1,
    limit: 9,
    total_pages: 0,
    category_slug: null
  };
  const [
    brandsResponse,
    servicesResponse,
    projectsResponse,
    productCategoriesResponse,
    newsResponse,
    newsCategoriesResponse,
    aboutBannersResponse,
    productBannersResponse,
    capabilityBannersResponse,
    serviceBannersResponse,
    projectBannersResponse,
    brandBannersResponse,
    newsBannersResponse,
    contactBannersResponse,
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
    getPublicProductCategories().catch(() => ({ items: [] })),
    getPublicNewsList({ page: 1, limit: 9 }).catch(() => emptyNews),
    getPublicNewsCategories().catch(() => ({ items: [] })),
    getPublicBannersForPlacement('ABOUT_HERO').catch(() =>
      emptyPublicBannersForPlacement('ABOUT_HERO')
    ),
    getPublicBannersForPlacement('PRODUCTS_HERO').catch(() =>
      emptyPublicBannersForPlacement('PRODUCTS_HERO')
    ),
    getPublicBannersForPlacement('CAPABILITY_PROFILE_HERO').catch(() =>
      emptyPublicBannersForPlacement('CAPABILITY_PROFILE_HERO')
    ),
    getPublicBannersForPlacement('SERVICES_HERO').catch(() =>
      emptyPublicBannersForPlacement('SERVICES_HERO')
    ),
    getPublicBannersForPlacement('PROJECTS_HERO').catch(() =>
      emptyPublicBannersForPlacement('PROJECTS_HERO')
    ),
    getPublicBannersForPlacement('BRANDS_HERO').catch(() =>
      emptyPublicBannersForPlacement('BRANDS_HERO')
    ),
    getPublicBannersForPlacement('NEWS_HERO').catch(() =>
      emptyPublicBannersForPlacement('NEWS_HERO')
    ),
    getPublicBannersForPlacement('CONTACT_HERO').catch(() =>
      emptyPublicBannersForPlacement('CONTACT_HERO')
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

  const productCategoryTree = buildProductCategoryTree(productCategoriesResponse.items);
  const productSectionResponses = await Promise.all(
    productCategoryTree.map((category) =>
      getPublicProductGroups({
        category_id: category.id,
        page: 1,
        page_size: 10,
        sort: 'popular'
      }).catch(() => null)
    )
  );
  const productSections: ProductCategoryProductSection[] = productCategoryTree.map((category, index) => {
    const response = productSectionResponses[index];
    return {
      brands: response?.facets.brands ?? [],
      category,
      products: response?.items ?? [],
      total: response?.pagination.total ?? 0
    };
  });

  return (
    <PageContentPreviewClient
      supportData={{
        banners: aboutBannersResponse.items,
        brands: brandsResponse.items,
        capabilityBanners: capabilityBannersResponse.items,
        contactBanners: contactBannersResponse.items,
        newsBanners: newsBannersResponse.items,
        newsCategories: newsCategoriesResponse.items,
        newsData: newsResponse,
        productBanners: productBannersResponse.items,
        productCategoryTree,
        productSections,
        projectBanners: projectBannersResponse.items,
        serviceBanners: serviceBannersResponse.items,
        brandBanners: brandBannersResponse.items,
        services: servicesResponse.items,
        projects: projectsResponse.items,
        companyInfo: shell.company_info
      }}
    />
  );
}
