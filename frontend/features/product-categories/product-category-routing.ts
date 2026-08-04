import type { PublicProductGroupSort } from '@/types/contracts/public-product-groups';

export const PRODUCT_LISTING_PATH = '/san-pham/danh-sach';
export const DEFAULT_PRODUCT_LISTING_PAGE_SIZE = 10;

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

  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

export function buildProductListingHref(params: BuildProductListingHrefParams = {}): string {
  const searchParams = new URLSearchParams();
  const trimmedQuery = params.q?.trim() ?? '';
  const categorySlugs =
    typeof params.categorySlugs === 'string'
      ? parseCategorySlugList(params.categorySlugs)
      : params.categorySlugs
        ? [...params.categorySlugs]
        : [];
  const specFilters = Array.isArray(params.specFilters)
    ? [...params.specFilters]
    : typeof params.specFilters === 'string'
      ? params.specFilters
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
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
    ? [...params.brands]
    : typeof params.brands === 'string'
      ? parseCategorySlugList(params.brands)
      : [];
  if (brands.length > 0) {
    searchParams.set('brands', brands.join(','));
  }

  const status = Array.isArray(params.status)
    ? [...params.status]
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

  if (typeof params.page === 'number' && params.page > 1) {
    searchParams.set('page', String(params.page));
  }

  if (
    typeof params.pageSize === 'number' &&
    params.pageSize !== DEFAULT_PRODUCT_LISTING_PAGE_SIZE
  ) {
    searchParams.set('page_size', String(params.pageSize));
  }

  const queryString = searchParams.toString();
  return queryString ? `${PRODUCT_LISTING_PATH}?${queryString}` : PRODUCT_LISTING_PATH;
}
