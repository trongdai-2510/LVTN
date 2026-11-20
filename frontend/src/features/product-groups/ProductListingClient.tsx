'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Container } from '@/components/ui/Container';
import { HomeHeroBannerCarousel } from '@/features/home/HomeHeroBannerCarousel';
import { formatPublicCategoryName } from '@/features/product-categories/format-public-category-name';
import {
  buildProductListingHref,
  DEFAULT_PRODUCT_LISTING_PAGE_SIZE,
  normalizeProductListingPageSize,
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
import type { PublicBrandListItem } from '@/types/contracts/public-brands';
import type { PublicBannerListItem } from '@/types/contracts/public-banners';
import type {
  PublicProductGroupSort,
  PublicProductGroupsResponse
} from '@/types/contracts/public-product-groups';

import { ProductGroupFilters } from './ProductGroupFilters';
import { ProductGroupList } from './ProductGroupList';
import { ProductCategoryNav } from './ProductCategoryNav';
import {
  ProductListingSidebar,
  type ProductBrandFilterOption,
  type ProductListingSidebarProps
} from './ProductListingSidebar';

const PENDING_FEEDBACK_DELAY_MS = 400;
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
  banners: PublicBannerListItem[];
  brandDirectory: PublicBrandListItem[];
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
  banners,
  brandDirectory,
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
  const [failedRequest, setFailedRequest] = useState<{
    href: string;
    options: { historyMode?: 'push' | 'replace'; updateHistory: boolean };
  } | null>(null);
  const [availableChildCategoryCounts, setAvailableChildCategoryCounts] = useState(
    initialAvailableChildCategoryCounts
  );
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [showPendingFeedback, setShowPendingFeedback] = useState(false);
  const [filterPanel, setFilterPanel] = useState<'categories' | 'other' | null>(null);
  const [categoryPanelScope, setCategoryPanelScope] = useState<'all' | 'overflow'>('all');
  const controlsRef = useRef<HTMLDivElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadFromHistoryRef = useRef<(href: string) => void>(() => {});
  useEffect(() => {
    if (!filterPanel) return;
    function handlePointerDown(event: PointerEvent) {
      if (!controlsRef.current?.contains(event.target as Node)) setFilterPanel(null);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setFilterPanel(null);
      const focusTarget = filterPanel === 'categories'
        ? categoryPanelScope === 'overflow' ? null : categoryTriggerRef
        : filterTriggerRef;
      if (categoryPanelScope === 'overflow' && filterPanel === 'categories') {
        controlsRef.current?.querySelector<HTMLButtonElement>('[data-category-more]')?.focus();
      } else {
        focusTarget?.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [categoryPanelScope, filterPanel]);
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
  const selectedBrandSlugs = useMemo(() => parseCategorySlugList(listingState.brands), [listingState.brands]);
  const currentBrandSlug = selectedBrandSlugs.join(',');
  const brandDirectoryBySlug = useMemo(
    () => new Map(brandDirectory.map((brand) => [brand.slug, brand])),
    [brandDirectory]
  );
  const selectedBrand = selectedBrandSlugs.length === 1
    ? brandDirectoryBySlug.get(selectedBrandSlugs[0]) ?? null
    : null;
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
    for (const selectedSlug of selectedBrandSlugs) {
      const brand = brandDirectoryBySlug.get(selectedSlug);
      if (!brand || nextOptions.some((brandOption) => brandOption.slug === selectedSlug)) continue;
      nextOptions.push({
        id: brand.id,
        slug: brand.slug,
        label: brand.name,
        count: productGroupsResponse.pagination.total,
        description: brand.description,
        has_detail_page: brand.has_detail_page,
        logo_file: brand.logo_file
      });
    }

    return nextOptions;
  }, [
    brandDirectoryBySlug,
    productGroupsResponse.facets.brands,
    productGroupsResponse.pagination.total,
    selectedBrandSlugs
  ]);
  const currentSpecFiltersParam = parseSpecFilterTokenList(listingState.specFilters).join(',');
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
  const isUnfilteredCatalog =
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
    : isUnfilteredCatalog
      ? 'Tất cả sản phẩm'
      : listingState.q.trim() && pageHeading.breadcrumbCategories.length === 0
        ? 'Kết quả sản phẩm'
        : pageHeading.title;
  const headingDescription = isBrandOnlyContext
    ? selectedBrand!.description?.trim() || ''
    : pageHeading.description;
  const activeFilters = [
    ...(listingState.q.trim() ? [{ key: 'query', label: `“${listingState.q.trim()}”`, href: buildCurrentListingHref({ q: '', page: 1 }) }] : []),
    ...(lockedParentCategory ? [{
      key: `parent:${lockedParentCategorySlug}`,
      label: formatPublicCategoryName(lockedParentCategory.name) ?? lockedParentCategory.name,
      href: buildCurrentListingHref({ parentSlug: '', categorySlugs: '', page: 1 })
    }] : []),
    ...selectedBrandSlugs.map((slug) => ({
      key: `brand:${slug}`,
      label: brandDirectoryBySlug.get(slug)?.name ?? slug,
      href: buildCurrentListingHref({ brands: selectedBrandSlugs.filter((item) => item !== slug).join(','), page: 1 })
    })),
    ...listingContext.normalizedCategorySlugs.map((slug) => {
      const category = categorySlugMap.get(slug);
      return {
        key: `category:${slug}`,
        label: category ? formatPublicCategoryName(category.name) ?? category.name : slug,
        href: buildCurrentListingHref({
          categorySlugs: listingContext.normalizedCategorySlugs.filter((item) => item !== slug).join(','),
          page: 1
        })
      };
    }),
    ...(listingState.status ? [{ key: 'status', label: listingState.status === 'has_price' ? 'Có giá công khai' : 'Liên hệ báo giá', href: buildCurrentListingHref({ status: '', page: 1 }) }] : []),
    ...parseSpecFilterTokenList(currentSpecFiltersParam).map((token) => ({
      key: `spec:${token}`,
      label: productGroupsResponse.facets.specs.flatMap((group) => group.options).find((option) => option.token === token)?.label ?? token,
      href: buildCurrentListingHref({ specFilters: parseSpecFilterTokenList(currentSpecFiltersParam).filter((item) => item !== token).join(','), page: 1 })
    }))
  ];
  const activeFacetCount = activeFilters.filter((filter) => filter.key !== 'query').length;

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
    setPendingHref(null);

    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }

    setShowPendingFeedback(false);
    setListingState(initialListingState);
    setProductGroupsResponse(initialProductGroupsResponse);
    setFailedRequest(null);
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
      feedbackTimerRef.current = setTimeout(() => {
        setShowPendingFeedback(true);
      }, PENDING_FEEDBACK_DELAY_MS);
    } else {
      setShowPendingFeedback(false);
    }

    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = null;
      }
    };
  }, [isUpdating]);

  useEffect(() => {
    function handlePopState() {
      loadFromHistoryRef.current(normalizeClientHref(window.location.href));
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

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
    const nextBrandSlug = parseCategorySlugList(nextState.brands).join(',');
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

    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setPendingHref(canonicalHref);
    setFailedRequest(null);

    try {
      const productQuery = {
        q: nextState.q || undefined,
        category_id: nextEffectiveCategoryFilterId || undefined,
        brands: nextBrandSlug || undefined,
        status: nextState.status || undefined,
        spec_filters: nextSpecFiltersParam || undefined,
        sort: nextState.sort || undefined,
        page: nextState.page,
        page_size: nextState.pageSize
      };
      const productGroupsPromise = getPublicProductGroups(
        productQuery,
        { signal: abortController.signal }
      );
      const childCategoryFacetPromise = nextParentCategoryId && nextContext.normalizedCategoryIds.length > 0
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
      let [nextProductGroupsResponse, nextChildCategoryFacetResponse] = await Promise.all([
        productGroupsPromise,
        childCategoryFacetPromise
      ]);

      if (abortController.signal.aborted) {
        return;
      }

      if (nextState.page > nextProductGroupsResponse.pagination.page_count) {
        nextProductGroupsResponse = await getPublicProductGroups(
          { ...productQuery, page: nextProductGroupsResponse.pagination.page_count },
          { signal: abortController.signal }
        );
        if (abortController.signal.aborted) return;
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
        setFailedRequest({ href: canonicalHref, options });
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
        setPendingHref(null);
      }
    }
  }

  loadFromHistoryRef.current = (href) => {
    void loadListingFromHref(href, { updateHistory: false });
  };

  const filterProps: Omit<ProductListingSidebarProps, 'panel' | 'onlyOverflowCategories'> = {
    availableChildCategoryCounts,
    brandOptions: brandFilterOptions,
    categoryTree,
    currentBrandSlug,
    currentPageSize: listingState.pageSize,
    currentQ: listingState.q,
    currentSpecFilters: currentSpecFiltersParam,
    currentStatus: listingState.status,
    currentSort: listingState.sort,
    initialSelectedCategoryIds: selectedCategoryIds,
    isPending: isUpdating,
    lockedParentCategoryId,
    lockedParentCategorySlug,
    onClose: () => setFilterPanel(null),
    onNavigate: (href) => {
      handleNavigate(href);
      if (filterPanel === 'categories') setFilterPanel(null);
    },
    resultCount: productGroupsResponse.pagination.total,
    specFacetGroups: productGroupsResponse.facets.specs,
    statusOptions: productGroupsResponse.facets.status
  };

  return (
    <div className="bg-[#f8fafd]">
      <section className="border-b border-[#dce6f1] bg-[linear-gradient(115deg,#f1f7ff_0%,#ffffff_62%)]" data-product-listing-heading="true">
        <Container className="py-4 sm:py-5" size="wide">
          <nav aria-label="Breadcrumb" className="type-caption flex flex-wrap items-center gap-2 text-body/70">
            <Link className="transition-colors hover:text-primaryStrong" href="/">Trang chủ</Link>
            <span aria-hidden="true">/</span>
            <Link className="transition-colors hover:text-primaryStrong" href="/san-pham">Sản phẩm</Link>
            {isBrandOnlyContext ? (
              <>
                <span aria-hidden="true">/</span>
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
                  <span aria-hidden="true">/</span>
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

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="min-w-0 max-w-[860px]">
              <h1 className="text-balance font-display text-[30px] font-bold leading-[1.16] tracking-[-0.025em] text-secondary sm:text-[40px]">
                {headingTitle}
              </h1>
              {headingDescription ? (
                <p className="mt-1 line-clamp-1 max-w-[75ch] text-[14px] leading-6 text-body/70">
                  {headingDescription}
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-[13px] font-medium text-body/70 lg:pb-1">
              <span className="font-display text-[23px] font-semibold tabular-nums text-secondary">{productGroupsResponse.pagination.total.toLocaleString('vi-VN')}</span>{' '}
              sản phẩm
            </p>
          </div>
        </Container>
      </section>

      {banners.length > 0 && listingState.page === 1 && !listingState.q && !listingState.parentSlug && listingState.categorySlugs.length === 0 && !listingState.brands && !listingState.status && !listingState.specFilters ? (
        <HomeHeroBannerCarousel ariaLabel="Banner danh sách sản phẩm" banners={banners} companyInfo={null} variant="listing" />
      ) : null}

      <section className="border-b border-borderSoft/60 pb-20 pt-5 sm:pt-6">
        <Container size="wide">
          <div className="min-w-0 space-y-5 lg:space-y-6">
              <div ref={controlsRef}>
              <ProductGroupFilters
                categoryNav={<ProductCategoryNav
                  categories={categoryTree}
                  selectedCategoryId={lockedParentCategoryId}
                  isMoreOpen={filterPanel === 'categories' && categoryPanelScope === 'overflow'}
                  onChoose={(category) => {
                    setFilterPanel(null);
                    handleNavigate(buildProductListingHref({
                      q: listingState.q.trim() || undefined,
                      parentSlug: category ? getPublicProductCategorySlug(category) : undefined,
                      sort: listingState.sort,
                      pageSize: listingState.pageSize
                    }));
                  }}
                  onMore={() => {
                    setCategoryPanelScope('overflow');
                    setFilterPanel((current) => current === 'categories' && categoryPanelScope === 'overflow' ? null : 'categories');
                  }}
                />}
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
                onCloseFilterPanel={() => setFilterPanel(null)}
                filterControl={<div className="flex w-full items-center gap-2 lg:w-auto">
                  <button
                    aria-label="Danh mục"
                    aria-controls="product-filter-panel"
                    aria-expanded={filterPanel === 'categories'}
                    className={filterPanel === 'categories' ? 'inline-flex h-12 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-xl border border-primaryStrong bg-[#eaf3ff] px-1.5 text-[12px] font-semibold text-primaryStrong sm:px-3 sm:text-sm lg:hidden' : 'inline-flex h-12 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-xl border border-[#d9e4f0] bg-white px-1.5 text-[12px] font-semibold text-secondary transition-colors hover:border-primary/50 hover:bg-[#f8fbff] sm:px-3 sm:text-sm lg:hidden'}
                    onClick={() => {
                      setCategoryPanelScope('all');
                      setFilterPanel((current) => current === 'categories' && categoryPanelScope === 'all' ? null : 'categories');
                    }}
                    ref={categoryTriggerRef}
                    type="button"
                  ><span className="min-[360px]:hidden">Nhóm</span><span className="hidden min-[360px]:inline">Danh mục</span></button>
                  <button
                    aria-controls="product-filter-panel"
                    aria-expanded={filterPanel === 'other'}
                    className={['inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 text-[13px] font-semibold transition-colors sm:gap-2 sm:px-3.5 sm:text-sm lg:min-w-[116px]', filterPanel === 'other' ? 'border-primaryStrong bg-primaryStrong text-white' : activeFacetCount > 0 ? 'border-primaryStrong/50 bg-[#eaf3ff] text-primaryStrong hover:bg-[#deecff]' : 'border-primaryStrong/35 bg-[#f1f7ff] text-primaryStrong hover:border-primaryStrong hover:bg-[#eaf3ff]'].join(' ')}
                    onClick={() => setFilterPanel((current) => current === 'other' ? null : 'other')}
                    ref={filterTriggerRef}
                    type="button"
                  ><span className="hidden sm:inline"><FilterIcon /></span><span>Lọc</span>{activeFacetCount > 0 ? <span aria-label={`${activeFacetCount} điều kiện đang áp dụng`} className={['inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold', filterPanel === 'other' ? 'bg-white text-primaryStrong' : 'bg-primaryStrong text-white'].join(' ')}>{activeFacetCount}</span> : null}</button>
                </div>}
                filterPanel={filterPanel ? <ProductListingSidebar {...filterProps} onlyOverflowCategories={filterPanel === 'categories' && categoryPanelScope === 'overflow'} panel={filterPanel} /> : null}
              />
              </div>

              {activeFilters.length > 0 && !filterPanel ? (
                <div aria-label="Bộ lọc đang dùng" className="flex flex-wrap items-center gap-2" data-active-filters="true">
                  <span className="mr-1 text-xs font-semibold text-slate-500">Đang lọc</span>
                  {activeFilters.map((filter) => (
                    <button
                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#cbdff3] bg-white px-3 text-xs font-semibold text-secondary transition-colors hover:border-primary hover:text-primary"
                      disabled={isUpdating}
                      key={filter.key}
                      onClick={() => handleNavigate(filter.href)}
                      title={`Bỏ lọc ${filter.label}`}
                      type="button"
                    >
                      {filter.label} <span aria-hidden="true" className="text-primary">×</span>
                    </button>
                  ))}
                  <button
                    className="min-h-9 px-2 text-xs font-semibold text-primary hover:underline"
                    disabled={isUpdating}
                    onClick={() => handleNavigate(buildProductListingHref({ sort: listingState.sort, pageSize: listingState.pageSize }))}
                    type="button"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              ) : null}

              <div className="relative min-h-[400px]" aria-busy={isUpdating}>
                {showPendingFeedback ? <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-[#dceafa]" role="status" aria-label="Đang cập nhật sản phẩm"><span className="block h-full w-1/3 animate-pulse bg-primary motion-reduce:animate-none" /></div> : null}
                {failedRequest ? (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-error/30 bg-white px-4 py-3 text-sm text-secondary" role="alert">
                    <span>Không cập nhật được kết quả. Danh sách bên dưới là lần tải trước.</span>
                    <button
                      className="min-h-11 rounded-sm px-3 font-semibold text-primary hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => void loadListingFromHref(failedRequest.href, failedRequest.options)}
                      type="button"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : null}
                <div>
                  <ProductGroupList
                    columns="catalog"
                    headingLevel={2}
                    priorityFirst
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

              </div>
          </div>
        </Container>
      </section>
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

  const selected = parseCategorySlugList(value);
  return selected.includes('has_price') ? 'has_price' : selected.includes('contact') ? 'contact' : '';
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
    brands: parseCategorySlugList(url.searchParams.get('brands') ?? undefined).join(','),
    categorySlugs: parseCategorySlugList(url.searchParams.get('categories') ?? undefined),
    page: parsePositiveNumber(url.searchParams.get('page'), 1),
    pageSize: normalizeProductListingPageSize(parsePositiveNumber(url.searchParams.get('page_size'), DEFAULT_PAGE_SIZE)),
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
    return [1, 2, 3];
  }

  if (currentPage >= pageCount - 2) {
    return [pageCount - 2, pageCount - 1, pageCount];
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

  return (
    <nav aria-label="Phân trang sản phẩm" className="flex justify-center pt-4">
      <div className="inline-flex flex-wrap items-center justify-center gap-1">
        <PaginationButton
          ariaLabel="Trang trước"
          disabled={currentPage <= 1}
          href={buildHref({ page: currentPage - 1 })}
          onNavigate={onNavigate}
        >
          <PaginationArrowIcon direction="left" />
        </PaginationButton>

        {showLeadingEllipsis ? (
          <span className="hidden items-center gap-1 sm:inline-flex">
            <PaginationButton
              ariaLabel="Trang 1"
              href={buildHref({ page: 1 })}
              onNavigate={onNavigate}
            >
              1
            </PaginationButton>
            <span aria-hidden="true" className="type-caption flex h-11 w-6 items-center justify-center text-body">
              ...
            </span>
          </span>
        ) : null}

        {paginationPages.map((pageNumber) => (
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

        {showTrailingEllipsis ? (
          <span className="hidden items-center gap-1 sm:inline-flex">
            <span aria-hidden="true" className="type-caption flex h-11 w-6 items-center justify-center text-body">
              ...
            </span>
            <PaginationButton
              ariaLabel={`Trang ${pageCount}`}
              href={buildHref({ page: pageCount })}
              onNavigate={onNavigate}
            >
              {pageCount}
            </PaginationButton>
          </span>
        ) : null}

        <PaginationButton
          ariaLabel="Trang sau"
          disabled={currentPage >= pageCount}
          href={buildHref({ page: currentPage + 1 })}
          onNavigate={onNavigate}
        >
          <PaginationArrowIcon direction="right" />
        </PaginationButton>
      </div>
    </nav>
  );
}

function PaginationButton({
  active = false,
  ariaLabel,
  children,
  disabled = false,
  href,
  onNavigate
}: {
  active?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
  disabled?: boolean;
  href: string;
  onNavigate: (href: string, mode?: 'push' | 'replace') => void;
}) {
  const className = [
    'type-caption flex h-11 min-w-11 items-center justify-center rounded-xs px-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    active
      ? 'bg-primaryStrong font-bold text-white'
      : disabled
        ? 'border border-borderSoft/25 bg-white text-body/35'
        : 'border border-borderSoft/35 bg-white font-medium text-body hover:border-primary hover:text-primary'
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

function FilterIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}
