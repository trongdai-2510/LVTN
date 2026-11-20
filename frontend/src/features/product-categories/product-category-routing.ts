import type { PublicProductGroupSort } from '@/types/contracts/public-product-groups';
import { MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH } from '@/features/product-search/publicProductSearchConstants';

export const PRODUCT_LISTING_PATH = '/san-pham/danh-sach';
export const DEFAULT_PRODUCT_LISTING_PAGE_SIZE = 12;
export const MAX_PRODUCT_LISTING_PAGE_SIZE = 40;
export const MAX_PRODUCT_LISTING_PAGE = 2_147_483_647;
export const MAX_PRODUCT_LISTING_FILTER_TOKENS = 50;

type BuildProductListingHrefParams = {
  q?: string;
  parentSlug?: string;
  categorySlugs?: readonly string[] | string;
  brands?: readonly string[] | string;
  status?: readonly string[] | string;
  specFilters?: readonly string[] | string;
  sort?: PublicProductGroupSort | '';
  page?: number;
  pageSize?: number;
};

export function parseCategorySlugList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))
  ].slice(0, MAX_PRODUCT_LISTING_FILTER_TOKENS);
}

export function normalizeProductListingPageSize(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return DEFAULT_PRODUCT_LISTING_PAGE_SIZE;
  }

  // Full pages fill the catalogue's 2-, 3- and 4-column layouts.
  return Math.min(36, Math.max(12, Math.ceil(Math.floor(value) / 12) * 12));
}

export function buildProductListingHref(params: BuildProductListingHrefParams = {}): string {
  const searchParams = new URLSearchParams();
  const trimmedQuery = (params.q?.trim() ?? '').slice(
    0,
    MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH
  );
  const categorySlugs =
    typeof params.categorySlugs === 'string'
      ? parseCategorySlugList(params.categorySlugs)
      : params.categorySlugs
        ? [...params.categorySlugs].slice(0, MAX_PRODUCT_LISTING_FILTER_TOKENS)
        : [];
  const specFilters = Array.isArray(params.specFilters)
    ? [...params.specFilters].slice(0, MAX_PRODUCT_LISTING_FILTER_TOKENS)
    : typeof params.specFilters === 'string'
      ? params.specFilters
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, MAX_PRODUCT_LISTING_FILTER_TOKENS)
      : [];

  if (trimmedQuery) {
    searchParams.set('q', trimmedQuery);
  }

  if (params.parentSlug) {
    searchParams.set('parent', params.parentSlug);
  }

  if (categorySlugs.length > 0) {
    searchParams.set('categories', categorySlugs.join(','));
  }

  const brands = Array.isArray(params.brands)
    ? [...params.brands].slice(0, MAX_PRODUCT_LISTING_FILTER_TOKENS)
    : typeof params.brands === 'string'
      ? parseCategorySlugList(params.brands)
      : [];
  if (brands.length > 0) {
    searchParams.set('brands', brands.join(','));
  }

  const status = Array.isArray(params.status)
    ? [...params.status].slice(0, MAX_PRODUCT_LISTING_FILTER_TOKENS)
    : typeof params.status === 'string'
      ? parseCategorySlugList(params.status)
      : [];
  if (status.length > 0) {
    searchParams.set('status', status.join(','));
  }

  if (specFilters.length > 0) {
    searchParams.set('spec_filters', specFilters.join(','));
  }

  if (params.sort) {
    searchParams.set('sort', params.sort);
  }

  const normalizedPage =
    typeof params.page === 'number' && Number.isFinite(params.page)
      ? Math.min(MAX_PRODUCT_LISTING_PAGE, Math.max(1, Math.floor(params.page)))
      : 1;
  if (normalizedPage > 1) {
    searchParams.set('page', String(normalizedPage));
  }

  const normalizedPageSize = normalizeProductListingPageSize(params.pageSize);
  if (normalizedPageSize !== DEFAULT_PRODUCT_LISTING_PAGE_SIZE) {
    searchParams.set('page_size', String(normalizedPageSize));
  }

  const queryString = searchParams.toString();
  return queryString ? `${PRODUCT_LISTING_PATH}?${queryString}` : PRODUCT_LISTING_PATH;
}
