import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  buildProductCategoryTree,
  createProductCategoryNodeMap,
  createProductCategorySlugMap,
  findProductCategoryRoot,
  getProductCategoryNodeBySlugOrNull,
  getProductCategoryNodeOrNull,
  getPublicProductCategorySlug,
  isProductCategoryDescendant,
  type ProductCategoryTreeNode
} from '@/features/product-categories/product-category-tree';
import {
  buildProductListingHref,
  DEFAULT_PRODUCT_LISTING_PAGE_SIZE,
  MAX_PRODUCT_LISTING_PAGE,
  MAX_PRODUCT_LISTING_FILTER_TOKENS,
  MAX_PRODUCT_LISTING_PAGE_SIZE,
  normalizeProductListingPageSize,
  parseCategorySlugList
} from '@/features/product-categories/product-category-routing';
import { MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH } from '@/features/product-search/publicProductSearchConstants';
import { ProductListingClient } from '@/features/product-groups/ProductListingClient';
import { getAllPublicBrands } from '@/lib/api/public-brands';
import { getPublicProductCategories } from '@/lib/api/public-product-categories';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { getPublicBannersForPlacement } from '@/lib/public-banner-placement';
import type {
  PublicProductGroupSort,
  PublicProductGroupsResponse
} from '@/types/contracts/public-product-groups';

export const metadata: Metadata = {
  title: 'Danh sách sản phẩm | Song Thanh',
  description: 'Tìm kiếm và lọc nhóm sản phẩm thiết bị điện, chiếu sáng và vật tư kỹ thuật tại Song Thanh.',
  alternates: { canonical: '/san-pham/danh-sach' },
  openGraph: {
    type: 'website',
    url: '/san-pham/danh-sach',
    title: 'Danh sách sản phẩm | Song Thanh',
    description: 'Tìm kiếm và lọc nhóm sản phẩm thiết bị điện, chiếu sáng và vật tư kỹ thuật tại Song Thanh.'
  }
};

type ProductListingPageProps = {
  searchParams?: Promise<{
    q?: string;
    parent?: string;
    categories?: string;
    parent_category_id?: string;
    category_ids?: string;
    category_id?: string;
    brands?: string;
    status?: string;
    spec_filters?: string;
    sort?: string;
    page?: string;
    page_size?: string;
  }>;
};

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number
) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return Math.min(maximum, Math.floor(parsedValue));
}

function normalizeProductGroupSort(value: string | undefined): PublicProductGroupSort | '' {
  return value === 'newest' ||
    value === 'popular' ||
    value === 'name_asc' ||
    value === 'name_desc'
    ? value
    : '';
}

function normalizeProductGroupStatus(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const selected = parseCategorySlugList(value);
  return selected.includes('has_price') ? 'has_price' : selected.includes('contact') ? 'contact' : '';
}

function parseCategoryIdList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))
  ].slice(0, MAX_PRODUCT_LISTING_FILTER_TOKENS);
}

function parseSpecFilterTokenList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [
    ...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))
  ].slice(0, MAX_PRODUCT_LISTING_FILTER_TOKENS);
}

function sortCategoryNodes(nodes: readonly ProductCategoryTreeNode[]): ProductCategoryTreeNode[] {
  return [...nodes].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.name.localeCompare(right.name, 'vi', { sensitivity: 'base' });
  });
}

function getCanonicalListingContext(params: {
  categoryNodeMap: Map<string, ProductCategoryTreeNode>;
  categorySlugMap: Map<string, ProductCategoryTreeNode>;
  legacyCategoryIds: string[];
  legacyParentCategoryId: string;
  parentSlug: string;
  categorySlugs: string[];
}): {
  lockedParentCategory: ProductCategoryTreeNode | null;
  normalizedCategoryIds: string[];
  normalizedCategorySlugs: string[];
  shouldRedirect: boolean;
} {
  const {
    categoryNodeMap,
    categorySlugMap,
    legacyCategoryIds,
    legacyParentCategoryId,
    parentSlug,
    categorySlugs
  } = params;

  const explicitParentCandidate =
    (parentSlug ? getProductCategoryNodeBySlugOrNull(categorySlugMap, parentSlug) : null) ??
    (legacyParentCategoryId
      ? getProductCategoryNodeOrNull(categoryNodeMap, legacyParentCategoryId)
      : null);
  const explicitParent =
    explicitParentCandidate && !explicitParentCandidate.parent_id ? explicitParentCandidate : null;

  const parsedCategoriesFromSlug = categorySlugs
    .map((slug) => getProductCategoryNodeBySlugOrNull(categorySlugMap, slug))
    .filter((category): category is ProductCategoryTreeNode => Boolean(category));
  const parsedCategoriesFromId = legacyCategoryIds
    .map((categoryId) => getProductCategoryNodeOrNull(categoryNodeMap, categoryId))
    .filter((category): category is ProductCategoryTreeNode => Boolean(category));
  const parsedCategories =
    parsedCategoriesFromSlug.length > 0 || categorySlugs.length > 0
      ? parsedCategoriesFromSlug
      : parsedCategoriesFromId;

  if (explicitParent) {
    const descendantCategories = sortCategoryNodes(
      parsedCategories.filter(
        (category) =>
          category.id !== explicitParent.id &&
          isProductCategoryDescendant(categoryNodeMap, category.id, explicitParent.id)
      )
    );
    const normalizedCategorySlugs = descendantCategories.map((category) =>
      getPublicProductCategorySlug(category)
    );
    const explicitParentSlug = getPublicProductCategorySlug(explicitParent);

    return {
      lockedParentCategory: explicitParent,
      normalizedCategoryIds: descendantCategories.map((category) => category.id),
      normalizedCategorySlugs,
      shouldRedirect:
        explicitParentSlug !== parentSlug ||
        normalizedCategorySlugs.join(',') !== categorySlugs.join(',')
    };
  }

  if (parsedCategories.length === 0) {
    return {
      lockedParentCategory: null,
      normalizedCategoryIds: [],
      normalizedCategorySlugs: [],
      shouldRedirect: Boolean(
        parentSlug ||
          legacyParentCategoryId ||
          categorySlugs.length > 0 ||
          legacyCategoryIds.length > 0
      )
    };
  }

  const roots = parsedCategories
    .map((category) => findProductCategoryRoot(categoryNodeMap, category.id))
    .filter((category): category is ProductCategoryTreeNode => Boolean(category));
  const uniqueRootIds = [...new Set(roots.map((rootCategory) => rootCategory.id))];

  if (uniqueRootIds.length === 1) {
    const lockedParentCategory = roots[0] ?? null;
    const descendantCategories = sortCategoryNodes(
      parsedCategories.filter((category) => category.id !== lockedParentCategory?.id)
    );
    const normalizedCategorySlugs = descendantCategories.map((category) =>
      getPublicProductCategorySlug(category)
    );

    return {
      lockedParentCategory,
      normalizedCategoryIds: descendantCategories.map((category) => category.id),
      normalizedCategorySlugs,
      shouldRedirect: true
    };
  }

  const normalizedCategories = sortCategoryNodes(parsedCategories);
  const normalizedCategorySlugs = normalizedCategories.map((category) =>
    getPublicProductCategorySlug(category)
  );

  return {
    lockedParentCategory: null,
    normalizedCategoryIds: normalizedCategories.map((category) => category.id),
    normalizedCategorySlugs,
    shouldRedirect:
      normalizedCategorySlugs.join(',') !== categorySlugs.join(',') ||
      Boolean(parentSlug || legacyParentCategoryId)
  };
}

function mapChildCategoryFacetCounts(
  childCategoryFacets: PublicProductGroupsResponse['facets']['child_categories']
): Record<string, number> {
  return childCategoryFacets.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.category_id] = item.count;
    return accumulator;
  }, {});
}

export default async function ProductListingPage({ searchParams }: ProductListingPageProps) {
  const params = (await searchParams) ?? {};
  const currentQ =
    typeof params.q === 'string'
      ? params.q.slice(0, MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH)
      : '';
  const currentParentSlug = typeof params.parent === 'string' ? params.parent.trim() : '';
  const currentCategorySlugs = typeof params.categories === 'string' ? params.categories : '';
  const legacyParentCategoryId =
    typeof params.parent_category_id === 'string' ? params.parent_category_id : '';
  const legacyCategoryIds =
    typeof params.category_ids === 'string'
      ? params.category_ids
      : typeof params.category_id === 'string'
        ? params.category_id
        : '';
  const currentBrandSlug = parseCategorySlugList(
    typeof params.brands === 'string' ? params.brands : ''
  ).join(',');
  const currentStatus = normalizeProductGroupStatus(
    typeof params.status === 'string' ? params.status : undefined
  );
  const currentSpecFilters = typeof params.spec_filters === 'string' ? params.spec_filters : '';
  const currentSort = normalizeProductGroupSort(
    typeof params.sort === 'string' ? params.sort : undefined
  );
  const currentPage = parsePositiveInteger(
    params.page,
    1,
    MAX_PRODUCT_LISTING_PAGE
  );
  const currentPageSize = normalizeProductListingPageSize(parsePositiveInteger(
    params.page_size,
    DEFAULT_PRODUCT_LISTING_PAGE_SIZE,
    MAX_PRODUCT_LISTING_PAGE_SIZE
  ));
  const showListingBanners = currentPage === 1 && !currentQ && !currentParentSlug && !currentCategorySlugs && !legacyParentCategoryId && !legacyCategoryIds && !currentBrandSlug && !currentStatus && !currentSpecFilters;
  const listingBannersPromise = showListingBanners
    ? getPublicBannersForPlacement('PRODUCT_LISTING_HERO').catch(() => ({ items: [] }))
    : Promise.resolve({ items: [] });
  const shouldNormalizePagination =
    params.page !== (currentPage === 1 ? undefined : String(currentPage)) ||
    params.page_size !== (currentPageSize === DEFAULT_PRODUCT_LISTING_PAGE_SIZE ? undefined : String(currentPageSize));

  // Brand links arrive without category filters. Start their product request
  // alongside the directory data so the transition does not wait for two API rounds.
  const unscopedProductsPromise =
    !currentParentSlug && !currentCategorySlugs && !legacyParentCategoryId && !legacyCategoryIds
      ? getPublicProductGroups({
          q: currentQ || undefined,
          brands: currentBrandSlug || undefined,
          status: currentStatus || undefined,
          spec_filters: parseSpecFilterTokenList(currentSpecFilters).join(',') || undefined,
          sort: currentSort || undefined,
          page: currentPage,
          page_size: currentPageSize
        })
      : null;
  const [categoriesResponse, brandsResponse] = await Promise.all([
    getPublicProductCategories().catch(() => ({ items: [] })),
    getAllPublicBrands().catch(() => ({ items: [] }))
  ]);
  const categoryTree = buildProductCategoryTree(categoriesResponse.items);
  const categoryNodeMap = createProductCategoryNodeMap(categoryTree);
  const categorySlugMap = createProductCategorySlugMap(categoryTree);
  const canonicalListingContext = getCanonicalListingContext({
    categoryNodeMap,
    categorySlugMap,
    legacyCategoryIds: parseCategoryIdList(legacyCategoryIds).filter((categoryId) =>
      categoryNodeMap.has(categoryId)
    ),
    legacyParentCategoryId,
    parentSlug: currentParentSlug,
    categorySlugs: parseCategorySlugList(currentCategorySlugs)
  });
  const lockedParentCategory = canonicalListingContext.lockedParentCategory;
  const lockedParentCategoryId = lockedParentCategory?.id ?? '';
  const lockedParentCategorySlug = lockedParentCategory
    ? getPublicProductCategorySlug(lockedParentCategory)
    : '';
  const initialSelectedCategoryIds = canonicalListingContext.normalizedCategoryIds;
  const currentCategorySlugsParam = canonicalListingContext.normalizedCategorySlugs.join(',');

  if (canonicalListingContext.shouldRedirect || shouldNormalizePagination) {
    redirect(
      buildProductListingHref({
        q: currentQ,
        parentSlug: lockedParentCategorySlug || undefined,
        categorySlugs: canonicalListingContext.normalizedCategorySlugs,
        brands: currentBrandSlug || undefined,
        status: currentStatus || undefined,
        specFilters: currentSpecFilters,
        sort: currentSort,
        page: currentPage,
        pageSize: currentPageSize
      })
    );
  }

  const currentSpecFilterTokens = parseSpecFilterTokenList(currentSpecFilters);
  const currentSpecFiltersParam = currentSpecFilterTokens.join(',');
  const effectiveCategoryFilterId = lockedParentCategoryId
    ? initialSelectedCategoryIds.length > 0
      ? initialSelectedCategoryIds.join(',')
      : lockedParentCategoryId
    : initialSelectedCategoryIds.join(',');
  const productGroupsResponsePromise = unscopedProductsPromise ?? getPublicProductGroups({
    q: currentQ || undefined,
    category_id: effectiveCategoryFilterId || undefined,
    brands: currentBrandSlug || undefined,
    status: currentStatus || undefined,
    spec_filters: currentSpecFiltersParam || undefined,
    sort: currentSort || undefined,
    page: currentPage,
    page_size: currentPageSize
  });
  const childCategoryFacetResponsePromise = lockedParentCategoryId && initialSelectedCategoryIds.length > 0
    ? getPublicProductGroups({
        q: currentQ || undefined,
        category_id: lockedParentCategoryId,
        brands: currentBrandSlug || undefined,
        status: currentStatus || undefined,
        spec_filters: currentSpecFiltersParam || undefined,
        page: 1,
        page_size: 1
      }).catch(() => null)
    : Promise.resolve(null);
  const [loadedProductGroupsResponse, childCategoryFacetResponse, listingBannersResponse] = await Promise.all([
    productGroupsResponsePromise,
    childCategoryFacetResponsePromise,
    listingBannersPromise
  ]);
  const productGroupsResponse = loadedProductGroupsResponse;
  if (currentPage > productGroupsResponse.pagination.page_count) {
    redirect(buildProductListingHref({
      q: currentQ,
      parentSlug: lockedParentCategorySlug || undefined,
      categorySlugs: canonicalListingContext.normalizedCategorySlugs,
      brands: currentBrandSlug || undefined,
      status: currentStatus || undefined,
      specFilters: currentSpecFiltersParam,
      sort: currentSort,
      page: productGroupsResponse.pagination.page_count,
      pageSize: currentPageSize
    }));
  }
  const availableChildCategoryCounts = mapChildCategoryFacetCounts(
    childCategoryFacetResponse?.facets.child_categories ??
      productGroupsResponse.facets.child_categories
  );
  return (
    <ProductListingClient
      banners={listingBannersResponse.items}
      brandDirectory={brandsResponse.items}
      categoryTree={categoryTree}
      initialAvailableChildCategoryCounts={availableChildCategoryCounts}
      initialBrandSlug={currentBrandSlug}
      initialCategorySlugs={currentCategorySlugsParam}
      initialPage={productGroupsResponse.pagination.page}
      initialPageSize={productGroupsResponse.pagination.page_size}
      initialParentSlug={lockedParentCategorySlug}
      initialProductGroupsResponse={productGroupsResponse}
      initialQ={currentQ}
      initialSort={currentSort}
      initialSpecFilters={currentSpecFiltersParam}
      initialStatus={currentStatus}
    />
  );
}
