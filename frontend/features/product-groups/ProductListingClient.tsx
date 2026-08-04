'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HtmlContent } from '@/components/content/HtmlContent';
import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { ExtraBlocksRenderer } from '@/features/page-content/ExtraBlocksRenderer';
import { formatPublicCategoryName } from '@/features/product-categories/format-public-category-name';
import {
  buildProductListingHref,
  DEFAULT_PRODUCT_LISTING_PAGE_SIZE,
  parseCategorySlugList,
  PRODUCT_LISTING_PATH
} from '@/features/product-categories/product-category-routing';
import {
  createProductCategoryNodeMap,
  createProductCategorySlugMap,
  findProductCategoryRoot,
  getProductCategoryNodeBySlugOrNull,
  getProductCategoryNodeOrNull,
  getProductCategoryPath,
  getPublicProductCategorySlug,
  isProductCategoryDescendant,
  type ProductCategoryTreeNode
} from '@/features/product-categories/product-category-tree';
import { getPublicProductGroups } from '@/lib/api/public-product-groups';
import { resolvePublicFileSource } from '@/lib/public-file';
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type {
  PublicProductGroupSort,
  PublicProductGroupsResponse
} from '@/types/contracts/public-product-groups';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type { PublicPageContentDetailResponse } from '@/types/contracts/public-page-contents';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

import { ProductGroupFilters } from './ProductGroupFilters';
import { ProductGroupList } from './ProductGroupList';
import {
  ProductListingSidebar,
  type ProductBrandFilterOption,
  type ProductListingSidebarProps
} from './ProductListingSidebar';

const PENDING_FEEDBACK_DELAY_MS = 140;
const PENDING_FEEDBACK_MIN_MS = 180;
const DEFAULT_PAGE_SIZE = DEFAULT_PRODUCT_LISTING_PAGE_SIZE;

type ListingPageHeading = {
  breadcrumbCategories: ProductCategoryTreeNode[];
  description: string;
  title: string;
};

type ListingUrlState = {
  brands: string;
  categorySlugs: string[];
  page: number;
  pageSize: number;
  parentSlug: string;
  q: string;
  sort: PublicProductGroupSort | '';
  specFilters: string;
  status: string;
};

type ProductListingClientProps = {
  brandDirectory: PublicBrandListItem[];
  catalogBanners: PublicBannerListItem[];
  catalogCompanyInfo: PublicCompanyInfo | null;
  catalogPageContent: PublicPageContentDetailResponse['page_content'] | null;
  categoryTree: ProductCategoryTreeNode[];
  initialAvailableChildCategoryCounts: Record<string, number>;
  initialBrandSlug: string;
  initialCategorySlugs: string;
  initialPage: number;
  initialPageSize: number;
  initialParentSlug: string;
  initialProductGroupsResponse: PublicProductGroupsResponse;
  initialQ: string;
  initialSort: PublicProductGroupSort | '';
  initialSpecFilters: string;
  initialStatus: string;
};

export function ProductListingClient({
  brandDirectory,
  catalogBanners,
  catalogCompanyInfo,
  catalogPageContent,
  categoryTree,
  initialAvailableChildCategoryCounts,
  initialBrandSlug,
  initialCategorySlugs,
  initialPage,
  initialPageSize,
  initialParentSlug,
  initialProductGroupsResponse,
  initialQ,
  initialSort,
  initialSpecFilters,
  initialStatus
}: ProductListingClientProps) {
  const router = useRouter();
  const categoryNodeMap = useMemo(() => createProductCategoryNodeMap(categoryTree), [categoryTree]);
  const categorySlugMap = useMemo(() => createProductCategorySlugMap(categoryTree), [categoryTree]);
  const initialListingState = useMemo<ListingUrlState>(
    () => ({
      brands: initialBrandSlug,
      categorySlugs: parseCategorySlugList(initialCategorySlugs),
      page: initialPage,
      pageSize: initialPageSize,
      parentSlug: initialParentSlug,
      q: initialQ,
      sort: initialSort,
      specFilters: initialSpecFilters,
      status: initialStatus
    }),
    [
      initialBrandSlug,
      initialCategorySlugs,
      initialPage,
      initialPageSize,
      initialParentSlug,
      initialQ,
      initialSort,
      initialSpecFilters,
      initialStatus
    ]
  );
  const initialListingSignature = useMemo(
    () =>
      buildProductListingHref({
        q: initialListingState.q,
        parentSlug: initialListingState.parentSlug || undefined,
        categorySlugs: initialListingState.categorySlugs,
        brands: initialListingState.brands || undefined,
        status: initialListingState.status || undefined,
        specFilters: initialListingState.specFilters,
        sort: initialListingState.sort,
        page: initialListingState.page,
        pageSize: initialListingState.pageSize
      }),
    [initialListingState]
  );
  const lastInitialListingSignatureRef = useRef(initialListingSignature);
  const [listingState, setListingState] = useState<ListingUrlState>(() => initialListingState);
  const [productGroupsResponse, setProductGroupsResponse] = useState(initialProductGroupsResponse);
  const [availableChildCategoryCounts, setAvailableChildCategoryCounts] = useState(
    initialAvailableChildCategoryCounts
  );
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pendingHrefRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showPendingFeedback, setShowPendingFeedback] = useState(false);
  const feedbackShownAtRef = useRef(0);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listingContext = useMemo(
    () =>
      getCanonicalListingContext({
        categoryNodeMap,
        categorySlugMap,
        parentSlug: listingState.parentSlug,
        categorySlugs: listingState.categorySlugs
      }),
    [categoryNodeMap, categorySlugMap, listingState.categorySlugs, listingState.parentSlug]
  );
  const lockedParentCategory = listingContext.lockedParentCategory;
  const lockedParentCategoryId = lockedParentCategory?.id ?? '';
  const lockedParentCategorySlug = lockedParentCategory
    ? getPublicProductCategorySlug(lockedParentCategory)
    : '';
  const selectedCategoryIds = listingContext.normalizedCategoryIds;
  const currentCategorySlugsParam = listingContext.normalizedCategorySlugs.join(',');
  const currentBrandSlug = parseCategorySlugList(listingState.brands)[0] ?? '';
  const brandDirectoryBySlug = useMemo(
    () => new Map(brandDirectory.map((brand) => [brand.slug, brand])),
    [brandDirectory]
  );
  const selectedBrand = currentBrandSlug
    ? brandDirectoryBySlug.get(currentBrandSlug) ?? null
    : null;
  const brandLogoBySlug = useMemo(
    () =>
      brandDirectory.reduce<Record<string, string | null>>((map, brand) => {
        map[brand.slug] = resolvePublicFileSource(brand.logo_file);
        return map;
      }, {}),
    [brandDirectory]
  );
  const brandFilterOptions = useMemo<ProductBrandFilterOption[]>(() => {
    const nextOptions = productGroupsResponse.facets.brands.map((brandOption) => {
      const publicBrand = brandDirectoryBySlug.get(brandOption.slug);

      return {
        ...brandOption,
        description: publicBrand?.description ?? null,
        has_detail_page: publicBrand?.has_detail_page ?? false,
        logo_file: publicBrand?.logo_file ?? null
      };
    });

    // Giữ nguyên thứ tự facet (theo số lượng) — không đẩy hãng đang chọn lên đầu.
    if (
      selectedBrand &&
      !nextOptions.some((brandOption) => brandOption.slug === selectedBrand.slug)
    ) {
      nextOptions.push({
        id: selectedBrand.id,
        slug: selectedBrand.slug,
        label: selectedBrand.name,
        count: productGroupsResponse.pagination.total,
        description: selectedBrand.description,
        has_detail_page: selectedBrand.has_detail_page,
        logo_file: selectedBrand.logo_file
      });
    }

    return nextOptions;
  }, [
    brandDirectoryBySlug,
    productGroupsResponse.facets.brands,
    productGroupsResponse.pagination.total,
    selectedBrand
  ]);
  const currentSpecFiltersParam = parseSpecFilterTokenList(listingState.specFilters).join(',');
  const effectiveCategoryFilterId = lockedParentCategoryId
    ? selectedCategoryIds.length > 0
      ? selectedCategoryIds.join(',')
      : lockedParentCategoryId
    : selectedCategoryIds.join(',');
  const pageHeading = useMemo(
    () =>
      buildListingPageHeading({
        categoryNodeMap,
        lockedParentCategory,
        selectedCategories: sortCategoryNodes(
          selectedCategoryIds
            .map((categoryId) => getProductCategoryNodeOrNull(categoryNodeMap, categoryId))
            .filter((category): category is ProductCategoryTreeNode => Boolean(category))
        )
      }),
    [categoryNodeMap, lockedParentCategory, selectedCategoryIds]
  );
  const currentHref = useMemo(
    () =>
      buildProductListingHref({
        q: listingState.q,
        parentSlug: lockedParentCategorySlug || undefined,
        categorySlugs: currentCategorySlugsParam,
        brands: currentBrandSlug || undefined,
        status: listingState.status || undefined,
        specFilters: currentSpecFiltersParam,
        sort: listingState.sort,
        page: listingState.page,
        pageSize: listingState.pageSize
      }),
    [
      currentBrandSlug,
      currentCategorySlugsParam,
      currentSpecFiltersParam,
      listingState.page,
      listingState.pageSize,
      listingState.q,
      listingState.sort,
      listingState.status,
      lockedParentCategorySlug
    ]
  );
  const showCatalogContent =
    !lockedParentCategory &&
    selectedCategoryIds.length === 0 &&
    !currentBrandSlug &&
    !listingState.q.trim() &&
    !listingState.status &&
    !currentSpecFiltersParam;
  // Lọc thuần theo thương hiệu (chưa chọn danh mục) → tiêu đề nói rõ thương hiệu
  // thay vì "Danh mục sản phẩm" chung chung, để trang không lệch với nội dung đang xem.
  const isBrandOnlyContext =
    Boolean(selectedBrand) && !lockedParentCategory && selectedCategoryIds.length === 0;
  const headingTitle = isBrandOnlyContext
    ? `Sản phẩm ${selectedBrand!.name}`
    : showCatalogContent && catalogPageContent?.title?.trim()
      ? catalogPageContent.title.trim()
      : pageHeading.title;
  const headingDescription = isBrandOnlyContext
    ? selectedBrand!.description?.trim() ||
      `Các nhóm sản phẩm ${selectedBrand!.name} đang được Song Thanh phân phối, cập nhật công khai theo dữ liệu mới nhất.`
    : showCatalogContent && catalogPageContent?.excerpt?.trim()
      ? catalogPageContent.excerpt.trim()
      : pageHeading.description;
  const showCatalogHero = showCatalogContent && catalogBanners.length > 0;
  const showCatalogExtraBlocks =
    showCatalogContent && (catalogPageContent?.extra_blocks?.blocks ?? []).length > 0;

  useEffect(() => {
    const browserHref = normalizeClientHref(`${window.location.pathname}${window.location.search}`);
    if (browserHref.startsWith(PRODUCT_LISTING_PATH) && browserHref !== currentHref) {
      window.history.replaceState(null, '', currentHref);
    }
  }, [currentHref]);

  const isUpdating = Boolean(pendingHref);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (lastInitialListingSignatureRef.current === initialListingSignature) {
      return;
    }

    lastInitialListingSignatureRef.current = initialListingSignature;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pendingHrefRef.current = null;
    setPendingHref(null);

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    setShowPendingFeedback(false);
    setListingState(initialListingState);
    setProductGroupsResponse(initialProductGroupsResponse);
    setAvailableChildCategoryCounts(initialAvailableChildCategoryCounts);
  }, [
    initialAvailableChildCategoryCounts,
    initialListingSignature,
    initialListingState,
    initialProductGroupsResponse
  ]);

  useEffect(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    if (isUpdating) {
      if (showPendingFeedback) {
        return undefined;
      }

      feedbackTimerRef.current = setTimeout(() => {
        feedbackShownAtRef.current = Date.now();
        setShowPendingFeedback(true);
      }, PENDING_FEEDBACK_DELAY_MS);

      return () => {
        if (feedbackTimerRef.current) {
          clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = null;
        }
      };
    }

    if (!showPendingFeedback) {
      return undefined;
    }

    const elapsedTime = Date.now() - feedbackShownAtRef.current;
    const remainingTime = Math.max(0, PENDING_FEEDBACK_MIN_MS - elapsedTime);

    feedbackTimerRef.current = setTimeout(() => {
      setShowPendingFeedback(false);
      feedbackTimerRef.current = null;
    }, remainingTime);

    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [isUpdating, showPendingFeedback]);

  useEffect(() => {
    function handlePopState() {
      void loadListingFromHref(normalizeClientHref(window.location.href), { updateHistory: false });
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  });

  function buildCurrentListingHref({
    q = listingState.q,
    parentSlug = lockedParentCategorySlug,
    categorySlugs = currentCategorySlugsParam,
    brands = currentBrandSlug,
    status = listingState.status,
    specFilters = currentSpecFiltersParam,
    sort = listingState.sort,
    page = listingState.page,
    pageSize = listingState.pageSize
  }: {
    q?: string;
    parentSlug?: string;
    categorySlugs?: string;
    brands?: string;
    status?: string;
    specFilters?: string;
    sort?: PublicProductGroupSort | '';
    page?: number;
    pageSize?: number;
  }) {
    return buildProductListingHref({
      q,
      parentSlug: parentSlug || undefined,
      categorySlugs,
      brands: brands || undefined,
      status: status || undefined,
      specFilters,
      sort,
      page,
      pageSize
    });
  }

  function handleNavigate(href: string, mode: 'push' | 'replace' = 'push') {
    const normalizedHref = normalizeClientHref(href);

    if (!normalizedHref.startsWith(PRODUCT_LISTING_PATH)) {
      router.push(href, { scroll: false });
      return;
    }

    void loadListingFromHref(normalizedHref, { historyMode: mode, updateHistory: true });
  }

  async function loadListingFromHref(
    href: string,
    options: { historyMode?: 'push' | 'replace'; updateHistory: boolean }
  ) {
    const nextState = parseListingUrlState(href);
    const nextContext = getCanonicalListingContext({
      categoryNodeMap,
      categorySlugMap,
      parentSlug: nextState.parentSlug,
      categorySlugs: nextState.categorySlugs
    });
    const nextParentCategoryId = nextContext.lockedParentCategory?.id ?? '';
    const nextParentCategorySlug = nextContext.lockedParentCategory
      ? getPublicProductCategorySlug(nextContext.lockedParentCategory)
      : '';
    const nextCategorySlugsParam = nextContext.normalizedCategorySlugs.join(',');
    const nextBrandSlug = parseCategorySlugList(nextState.brands)[0] ?? '';
    const nextSpecFiltersParam = parseSpecFilterTokenList(nextState.specFilters).join(',');
    const nextEffectiveCategoryFilterId = nextParentCategoryId
      ? nextContext.normalizedCategoryIds.length > 0
        ? nextContext.normalizedCategoryIds.join(',')
        : nextParentCategoryId
      : nextContext.normalizedCategoryIds.join(',');
    const canonicalHref = buildProductListingHref({
      q: nextState.q,
      parentSlug: nextParentCategorySlug || undefined,
      categorySlugs: nextCategorySlugsParam,
      brands: nextBrandSlug || undefined,
      status: nextState.status || undefined,
      specFilters: nextSpecFiltersParam,
      sort: nextState.sort,
      page: nextState.page,
      pageSize: nextState.pageSize
    });

    if (canonicalHref === currentHref && !options.updateHistory) {
      return;
    }

    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    pendingHrefRef.current = canonicalHref;
    setPendingHref(canonicalHref);

    try {
      const productGroupsPromise = getPublicProductGroups(
        {
          q: nextState.q || undefined,
          category_id: nextEffectiveCategoryFilterId || undefined,
          brands: nextBrandSlug || undefined,
          status: nextState.status || undefined,
          spec_filters: nextSpecFiltersParam || undefined,
          sort: nextState.sort || undefined,
          page: nextState.page,
          page_size: nextState.pageSize
        },
        { signal: abortController.signal }
      );
      const childCategoryFacetPromise = nextParentCategoryId
        ? getPublicProductGroups(
            {
              q: nextState.q || undefined,
              category_id: nextParentCategoryId,
              brands: nextBrandSlug || undefined,
              status: nextState.status || undefined,
              spec_filters: nextSpecFiltersParam || undefined,
              page: 1,
              page_size: 1
            },
            { signal: abortController.signal }
          ).catch(() => null)
        : Promise.resolve(null);
      const [nextProductGroupsResponse, nextChildCategoryFacetResponse] = await Promise.all([
        productGroupsPromise,
        childCategoryFacetPromise
      ]);

      if (abortController.signal.aborted) {
        return;
      }

      const committedState: ListingUrlState = {
        ...nextState,
        brands: nextBrandSlug,
        categorySlugs: nextContext.normalizedCategorySlugs,
        page: nextProductGroupsResponse.pagination.page,
        pageSize: nextProductGroupsResponse.pagination.page_size,
        parentSlug: nextParentCategorySlug,
        specFilters: nextSpecFiltersParam
      };
      const committedHref = buildProductListingHref({
        q: committedState.q,
        parentSlug: committedState.parentSlug || undefined,
        categorySlugs: committedState.categorySlugs,
        brands: committedState.brands || undefined,
        status: committedState.status || undefined,
        specFilters: committedState.specFilters,
        sort: committedState.sort,
        page: committedState.page,
        pageSize: committedState.pageSize
      });

      setListingState(committedState);
      setProductGroupsResponse(nextProductGroupsResponse);
      setAvailableChildCategoryCounts(
        mapChildCategoryFacetCounts(
          nextChildCategoryFacetResponse?.facets.child_categories ??
            nextProductGroupsResponse.facets.child_categories
        )
      );

      if (options.updateHistory && window.location.pathname + window.location.search !== committedHref) {
        if (options.historyMode === 'replace') {
          window.history.replaceState(null, '', committedHref);
        } else {
          window.history.pushState(null, '', committedHref);
        }
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Failed to update product listing filters.', error);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
        pendingHrefRef.current = null;
        setPendingHref(null);
      }
    }
  }

  return (
    <div className="bg-subtle">
      {showCatalogHero ? (
        <HomeHeroBannerCarousel
          ariaLabel="Banner trang sản phẩm"
          banners={catalogBanners}
          companyInfo={catalogCompanyInfo}
          variant="page"
        />
      ) : null}

      <section className={showCatalogHero ? 'pt-8' : 'pt-10'}>
        <Container className="space-y-8">
          <nav className="type-caption flex flex-wrap items-center gap-2 text-body/60">
            <Link href="/">Trang chủ</Link>
            <span>/</span>
            <button
              className="inline-flex min-h-11 items-center transition hover:text-primaryStrong"
              onClick={() => handleNavigate(PRODUCT_LISTING_PATH)}
              type="button"
            >
              Sản phẩm
            </button>
            {isBrandOnlyContext ? (
              <>
                <span>/</span>
                <span className="font-bold text-primaryStrong">{selectedBrand!.name}</span>
              </>
            ) : null}
            {pageHeading.breadcrumbCategories.map((category, index, categories) => {
              const isCurrent = index === categories.length - 1;
              const rootCategory = findProductCategoryRoot(categoryNodeMap, category.id);
              const href =
                !isCurrent && rootCategory
                  ? buildProductListingHref(
                      category.parent_id
                        ? {
                            parentSlug: getPublicProductCategorySlug(rootCategory),
                            categorySlugs: [getPublicProductCategorySlug(category)]
                          }
                        : { parentSlug: getPublicProductCategorySlug(category) }
                    )
                  : undefined;
              const label = formatPublicCategoryName(category.name) ?? category.name;

              return (
                <div className="contents" key={`${label}:${index}`}>
                  <span>/</span>
                  {href ? (
                    <button
                      className="inline-flex min-h-11 items-center text-body/75 transition hover:text-primaryStrong"
                      onClick={() => handleNavigate(href)}
                      type="button"
                    >
                      {label}
                    </button>
                  ) : (
                    <span className={isCurrent ? 'font-bold text-primaryStrong' : 'text-body/75'}>
                      {label}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="space-y-3 border-l-4 border-primary pl-5">
            <h1 className="type-page-title-compact text-secondary">{headingTitle}</h1>
            {headingDescription ? (
              <p className="type-body-lg max-w-[920px] text-body">{headingDescription}</p>
            ) : null}
            {showCatalogContent && catalogPageContent?.content_html ? (
              <HtmlContent className="max-w-[920px]" sanitizedHtml={catalogPageContent.content_html} />
            ) : null}
          </div>
        </Container>
      </section>

      <section className="pb-20 pt-8">
        <Container className="space-y-10">
          <div className="grid gap-6 lg:gap-10 lg:grid-cols-[288px_minmax(0,1032px)]">
            <aside className="relative hidden lg:block" aria-busy={isUpdating}>
              <ProductListingSidebar
                availableChildCategoryCounts={availableChildCategoryCounts}
                brandOptions={brandFilterOptions}
                categoryTree={categoryTree}
                currentBrandSlug={currentBrandSlug}
                currentPageSize={listingState.pageSize}
                currentQ={listingState.q}
                currentSpecFilters={currentSpecFiltersParam}
                currentStatus={listingState.status}
                currentSort={listingState.sort}
                initialSelectedCategoryIds={selectedCategoryIds}
                isPending={isUpdating}
                lockedParentCategoryId={lockedParentCategoryId}
                lockedParentCategorySlug={lockedParentCategorySlug}
                onNavigate={handleNavigate}
                specFacetGroups={productGroupsResponse.facets.specs}
                statusOptions={productGroupsResponse.facets.status}
              />
              {showPendingFeedback ? <SidebarPendingOverlay /> : null}
            </aside>

            <MobileFilterDrawer
              availableChildCategoryCounts={availableChildCategoryCounts}
              brandOptions={brandFilterOptions}
              categoryTree={categoryTree}
              currentBrandSlug={currentBrandSlug}
              currentPageSize={listingState.pageSize}
              currentQ={listingState.q}
              currentSpecFilters={currentSpecFiltersParam}
              currentStatus={listingState.status}
              currentSort={listingState.sort}
              initialSelectedCategoryIds={selectedCategoryIds}
              isPending={isUpdating}
              lockedParentCategoryId={lockedParentCategoryId}
              lockedParentCategorySlug={lockedParentCategorySlug}
              onNavigate={handleNavigate}
              specFacetGroups={productGroupsResponse.facets.specs}
              statusOptions={productGroupsResponse.facets.status}
            />

            <div className="space-y-6 lg:space-y-8">
              <ProductGroupFilters
                currentBrands={currentBrandSlug}
                currentCategorySlugs={currentCategorySlugsParam}
                currentPageSize={listingState.pageSize}
                currentQ={listingState.q}
                currentSpecFilters={currentSpecFiltersParam}
                currentStatus={listingState.status}
                currentSort={listingState.sort}
                isPending={isUpdating}
                lockedParentCategorySlug={lockedParentCategorySlug}
                onNavigate={handleNavigate}
                resultsLabel={`Hiển thị ${productGroupsResponse.items.length} trên ${productGroupsResponse.pagination.total} sản phẩm`}
              />

              <div className="relative min-h-[400px]" aria-busy={isUpdating}>
                <div
                  className={[
                    'transition-opacity duration-200',
                    showPendingFeedback ? 'pointer-events-none opacity-70' : 'opacity-100'
                  ].join(' ')}
                >
                  <ProductGroupList
                    brandLogoBySlug={brandLogoBySlug}
                    columns="three"
                    productGroups={productGroupsResponse.items}
                  />
                  {productGroupsResponse.pagination.page_count > 1 ? (
                    <PaginationControls
                      buildHref={buildCurrentListingHref}
                      currentPage={productGroupsResponse.pagination.page}
                      onNavigate={handleNavigate}
                      pageCount={productGroupsResponse.pagination.page_count}
                    />
                  ) : null}
                </div>

                {showPendingFeedback ? <PendingOverlay /> : null}
              </div>
            </div>
          </div>
        </Container>
      </section>
      {showCatalogExtraBlocks ? (
        <ExtraBlocksRenderer blocks={catalogPageContent?.extra_blocks ?? null} containerSize="wide" />
      ) : null}
    </div>
  );
}

function parsePositiveNumber(value: string | null | undefined, fallback: number) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function normalizeProductGroupSort(value: string | null | undefined): PublicProductGroupSort | '' {
  return value === 'newest' ||
    value === 'popular' ||
    value === 'name_asc' ||
    value === 'name_desc'
    ? value
    : '';
}

function normalizeProductGroupStatus(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return parseCategorySlugList(value).includes('contact') ? 'contact' : '';
}

function parseSpecFilterTokenList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function parseListingUrlState(href: string): ListingUrlState {
  const url = new URL(href, 'http://songthanh.local');

  return {
    brands: parseCategorySlugList(url.searchParams.get('brands') ?? undefined)[0] ?? '',
    categorySlugs: parseCategorySlugList(url.searchParams.get('categories') ?? undefined),
    page: parsePositiveNumber(url.searchParams.get('page'), 1),
    pageSize: parsePositiveNumber(url.searchParams.get('page_size'), DEFAULT_PAGE_SIZE),
    parentSlug: url.searchParams.get('parent') ?? '',
    q: url.searchParams.get('q')?.trim() ?? '',
    sort: normalizeProductGroupSort(url.searchParams.get('sort')),
    specFilters: parseSpecFilterTokenList(url.searchParams.get('spec_filters') ?? undefined).join(','),
    status: normalizeProductGroupStatus(url.searchParams.get('status'))
  };
}

function normalizeClientHref(href: string): string {
  try {
    const url = new URL(href, 'http://songthanh.local');
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

function getCanonicalListingContext(params: {
  categoryNodeMap: Map<string, ProductCategoryTreeNode>;
  categorySlugMap: Map<string, ProductCategoryTreeNode>;
  parentSlug: string;
  categorySlugs: string[];
}): {
  lockedParentCategory: ProductCategoryTreeNode | null;
  normalizedCategoryIds: string[];
  normalizedCategorySlugs: string[];
} {
  const { categoryNodeMap, categorySlugMap, parentSlug, categorySlugs } = params;
  const explicitParentCandidate = parentSlug
    ? getProductCategoryNodeBySlugOrNull(categorySlugMap, parentSlug)
    : null;
  const explicitParent =
    explicitParentCandidate && !explicitParentCandidate.parent_id ? explicitParentCandidate : null;
  const parsedCategories = categorySlugs
    .map((slug) => getProductCategoryNodeBySlugOrNull(categorySlugMap, slug))
    .filter((category): category is ProductCategoryTreeNode => Boolean(category));

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

    return {
      lockedParentCategory: explicitParent,
      normalizedCategoryIds: descendantCategories.map((category) => category.id),
      normalizedCategorySlugs
    };
  }

  if (parsedCategories.length === 0) {
    return {
      lockedParentCategory: null,
      normalizedCategoryIds: [],
      normalizedCategorySlugs: []
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
      normalizedCategorySlugs
    };
  }

  const normalizedCategories = sortCategoryNodes(parsedCategories);
  const normalizedCategorySlugs = normalizedCategories.map((category) =>
    getPublicProductCategorySlug(category)
  );

  return {
    lockedParentCategory: null,
    normalizedCategoryIds: normalizedCategories.map((category) => category.id),
    normalizedCategorySlugs
  };
}

function sortCategoryNodes(nodes: readonly ProductCategoryTreeNode[]): ProductCategoryTreeNode[] {
  return [...nodes].sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }

    return left.name.localeCompare(right.name, 'vi', { sensitivity: 'base' });
  });
}

function buildListingPageHeading(params: {
  categoryNodeMap: Map<string, ProductCategoryTreeNode>;
  lockedParentCategory: ProductCategoryTreeNode | null;
  selectedCategories: ProductCategoryTreeNode[];
}): ListingPageHeading {
  const { categoryNodeMap, lockedParentCategory, selectedCategories } = params;
  const selectedSingleCategory = selectedCategories.length === 1 ? selectedCategories[0] : null;

  if (lockedParentCategory) {
    if (selectedSingleCategory) {
      return {
        title: `${lockedParentCategory.name} / ${
          formatPublicCategoryName(selectedSingleCategory.name) ?? selectedSingleCategory.name
        }`,
        description:
          selectedSingleCategory.description?.trim() ||
          lockedParentCategory.description?.trim() ||
          '',
        breadcrumbCategories: [lockedParentCategory, selectedSingleCategory]
      };
    }

    return {
      title: lockedParentCategory.name,
      description: lockedParentCategory.description?.trim() || '',
      breadcrumbCategories: [lockedParentCategory]
    };
  }

  if (selectedSingleCategory) {
    const breadcrumbCategories = getProductCategoryPath(categoryNodeMap, selectedSingleCategory.id);
    const rootCategory = breadcrumbCategories[0] ?? null;

    return {
      title: formatPublicCategoryName(selectedSingleCategory.name) ?? selectedSingleCategory.name,
      description:
        selectedSingleCategory.description?.trim() ||
        (rootCategory && rootCategory.id !== selectedSingleCategory.id
          ? rootCategory.description?.trim() || ''
          : ''),
      breadcrumbCategories
    };
  }

  return {
    title: 'Danh mục sản phẩm',
    description: '',
    breadcrumbCategories: []
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

function getPaginationPages(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4];
  }

  if (currentPage >= pageCount - 2) {
    return [pageCount - 3, pageCount - 2, pageCount - 1, pageCount];
  }

  return [currentPage - 1, currentPage, currentPage + 1];
}

function PaginationControls({
  buildHref,
  currentPage,
  onNavigate,
  pageCount
}: {
  buildHref: (params: { page?: number }) => string;
  currentPage: number;
  onNavigate: (href: string, mode?: 'push' | 'replace') => void;
  pageCount: number;
}) {
  const paginationPages = getPaginationPages(currentPage, pageCount);
  const firstPaginationPage = paginationPages[0] ?? 1;
  const lastPaginationPage = paginationPages[paginationPages.length - 1] ?? 1;
  const showLeadingEllipsis = firstPaginationPage > 1;
  const showTrailingEllipsis = lastPaginationPage < pageCount;

  const showCompactPagination = pageCount > 5;
  const visiblePageNumbers = showCompactPagination
    ? paginationPages.slice(0, 3)
    : paginationPages;
  const hasExtraPages = showCompactPagination && paginationPages.length > 3;

  return (
    <div className="flex justify-center pt-4">
      <div className="inline-flex flex-wrap items-center justify-center gap-1">
        <PaginationButton
          ariaLabel="Trang trước"
          disabled={currentPage <= 1}
          href={buildHref({ page: currentPage - 1 })}
          onNavigate={onNavigate}
        >
          <PaginationArrowIcon direction="left" />
        </PaginationButton>

        <PaginationButton
          disabled={currentPage <= 1}
          href={buildHref({ page: currentPage - 1 })}
          onNavigate={onNavigate}
          wide
          className="hidden sm:inline-flex"
        >
          Trước
        </PaginationButton>

        {showLeadingEllipsis ? (
          <>
            <PaginationButton
              ariaLabel="Trang 1"
              href={buildHref({ page: 1 })}
              onNavigate={onNavigate}
            >
              1
            </PaginationButton>
            <span className="type-caption flex h-11 w-8 items-center justify-center text-body/55 sm:h-10 sm:min-w-7 sm:px-1">
              ...
            </span>
          </>
        ) : null}

        {visiblePageNumbers.map((pageNumber) => (
          <PaginationButton
            active={pageNumber === currentPage}
            ariaLabel={`Trang ${pageNumber}`}
            href={buildHref({ page: pageNumber })}
            key={pageNumber}
            onNavigate={onNavigate}
          >
            {pageNumber}
          </PaginationButton>
        ))}

        {hasExtraPages && !showLeadingEllipsis ? (
          <span className="type-caption flex h-11 w-8 items-center justify-center text-body/55 sm:h-10 sm:min-w-7 sm:px-1">
            ...
          </span>
        ) : null}

        {showTrailingEllipsis ? (
          <>
            <span className="type-caption flex h-11 w-8 items-center justify-center text-body/55 sm:h-10 sm:min-w-7 sm:px-1">
              ...
            </span>
            <PaginationButton
              ariaLabel={`Trang ${pageCount}`}
              href={buildHref({ page: pageCount })}
              onNavigate={onNavigate}
            >
              {pageCount}
            </PaginationButton>
          </>
        ) : null}

        <PaginationButton
          ariaLabel="Trang sau"
          disabled={currentPage >= pageCount}
          href={buildHref({ page: currentPage + 1 })}
          onNavigate={onNavigate}
          wide
          className="hidden sm:inline-flex"
        >
          Sau
        </PaginationButton>

        <PaginationButton
          ariaLabel="Trang sau"
          disabled={currentPage >= pageCount}
          href={buildHref({ page: currentPage + 1 })}
          onNavigate={onNavigate}
        >
          <PaginationArrowIcon direction="right" />
        </PaginationButton>
      </div>
    </div>
  );
}

function PaginationButton({
  active = false,
  ariaLabel,
  children,
  className: extraClassName = '',
  disabled = false,
  href,
  onNavigate,
  wide = false
}: {
  active?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  href: string;
  onNavigate: (href: string, mode?: 'push' | 'replace') => void;
  wide?: boolean;
}) {
  const className = [
    'type-caption flex h-11 items-center justify-center rounded-xs transition sm:h-10',
    wide ? 'min-w-11 px-3 font-bold sm:min-w-10 sm:px-3' : 'w-11 sm:w-10',
    active
      ? 'bg-primaryStrong font-bold text-white'
      : disabled
        ? 'border border-borderSoft/25 bg-white text-body/35'
        : 'border border-borderSoft/35 bg-white font-medium text-body hover:border-primary hover:text-primary',
    extraClassName
  ].filter(Boolean).join(' ');

  if (disabled) {
    return (
      <span aria-hidden="true" className={className}>
        {children}
      </span>
    );
  }

  return (
    <button
      aria-current={active ? 'page' : undefined}
      aria-label={ariaLabel}
      className={className}
      onClick={() => onNavigate(href)}
      type="button"
    >
      {children}
    </button>
  );
}

function PaginationArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d={direction === 'left' ? 'M10 3.5L5.5 8L10 12.5' : 'M6 3.5L10.5 8L6 12.5'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function SidebarPendingOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-end"
    >
      <div className="inline-flex items-center gap-2 rounded-xs border border-borderSoft/70 bg-white/95 px-3 py-2 text-[12px] font-semibold text-secondary shadow-soft">
        <Spinner />
        <span>Đang lọc...</span>
      </div>
    </div>
  );
}

function PendingOverlay() {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-10 flex justify-center bg-white/35 pt-12 backdrop-blur-[1px]"
    >
      <div className="inline-flex items-center gap-2.5 rounded-sm border border-borderSoft bg-white px-5 py-3 shadow-action">
        <Spinner />
        <span className="type-body-sm font-semibold text-secondary">
          Đang lọc sản phẩm...
        </span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="2.5"
      />
      <path
        d="M21 12a9 9 0 00-9-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function MobileFilterDrawer(props: ProductListingSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasActiveFilters = props.initialSelectedCategoryIds.length > 0 || Boolean(props.currentBrandSlug) || Boolean(props.currentStatus) || Boolean(props.currentSpecFilters);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const activeFilterCount =
    props.initialSelectedCategoryIds.length +
    (props.currentBrandSlug ? 1 : 0) +
    (props.currentStatus ? 1 : 0) +
    (props.currentSpecFilters ? props.currentSpecFilters.split(',').filter(Boolean).length : 0);

  return (
    <div className="lg:hidden">
      <button
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xs border border-borderSoft bg-white px-4 text-sm font-semibold text-secondary shadow-soft transition-colors hover:bg-subtle"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <FilterIcon />
        <span>Bộ lọc</span>
        {activeFilterCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-4 text-white">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      <div
        aria-hidden={!isOpen}
        className={[
          'fixed inset-0 z-50 transition-opacity duration-300',
          isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        ].join(' ')}
      >
        <div
          aria-hidden
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />

        <div
          className={[
            'fixed inset-y-0 right-0 flex w-[min(92vw,400px)] flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out',
            isOpen ? 'translate-x-0' : 'translate-x-full'
          ].join(' ')}
          role="dialog"
          aria-modal="true"
          aria-label="Bộ lọc sản phẩm"
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.05em] text-secondary">
              Bộ lọc
            </h2>
            <button
              aria-label="Đóng bộ lọc"
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-text transition-colors hover:bg-subtle hover:text-primary"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <ProductListingSidebar
              availableChildCategoryCounts={props.availableChildCategoryCounts}
              brandOptions={props.brandOptions}
              categoryTree={props.categoryTree}
              currentBrandSlug={props.currentBrandSlug}
              currentPageSize={props.currentPageSize}
              currentQ={props.currentQ}
              currentSpecFilters={props.currentSpecFilters}
              currentStatus={props.currentStatus}
              currentSort={props.currentSort}
              initialSelectedCategoryIds={props.initialSelectedCategoryIds}
              isPending={props.isPending}
              lockedParentCategoryId={props.lockedParentCategoryId}
              lockedParentCategorySlug={props.lockedParentCategorySlug}
              onNavigate={(href) => { props.onNavigate(href); setIsOpen(false); }}
              specFacetGroups={props.specFacetGroups}
              statusOptions={props.statusOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
