'use client';

import { useMemo, useState } from 'react';

import {
  buildProductListingHref,
  DEFAULT_PRODUCT_LISTING_PAGE_SIZE,
  PRODUCT_LISTING_PATH
} from '@/features/product-categories/product-category-routing';
import {
  ProductSearchSuggestionPanel,
  usePublicProductSearchAutocomplete
} from '@/features/product-search/public-product-search';
import type { PublicProductGroupSort } from '@/types/contracts/public-product-groups';

type ProductGroupFiltersProps = {
  currentBrands: string;
  currentCategorySlugs: string;
  currentPageSize: number;
  currentQ: string;
  currentSpecFilters: string;
  currentStatus: string;
  currentSort: PublicProductGroupSort | '';
  isPending: boolean;
  lockedParentCategorySlug: string;
  onNavigate: (href: string, mode?: 'push' | 'replace') => void;
  resultsLabel: string;
};

const SORT_OPTIONS: Array<{ value: PublicProductGroupSort; label: string }> = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'name_asc', label: 'Tên A → Z' },
  { value: 'name_desc', label: 'Tên Z → A' }
];

function getSortLabel(currentSort: PublicProductGroupSort | '') {
  if (currentSort === 'popular') {
    return 'Phổ biến nhất';
  }

  if (currentSort === 'name_asc') {
    return 'Tên A → Z';
  }

  if (currentSort === 'name_desc') {
    return 'Tên Z → A';
  }

  if (currentSort === 'newest' || currentSort === '') {
    return 'Mới nhất';
  }

  return 'Sắp xếp';
}

export function ProductGroupFilters({
  currentBrands,
  currentCategorySlugs,
  currentPageSize,
  currentQ,
  currentSpecFilters,
  currentStatus,
  currentSort,
  isPending,
  lockedParentCategorySlug,
  onNavigate,
  resultsLabel
}: ProductGroupFiltersProps) {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const activeSortLabel = useMemo(() => getSortLabel(currentSort), [currentSort]);

  function buildListingHref({
    q = currentQ,
    sort = currentSort,
    parentCategorySlug = lockedParentCategorySlug,
    categorySlugs = currentCategorySlugs,
    brands = currentBrands,
    status = currentStatus,
    specFilters = currentSpecFilters,
    pageSize = currentPageSize
  }: {
    q?: string;
    sort?: PublicProductGroupSort | '';
    parentCategorySlug?: string;
    categorySlugs?: string;
    brands?: string;
    status?: string;
    specFilters?: string;
    pageSize?: number;
  }) {
    return buildProductListingHref({
      q,
      parentSlug: parentCategorySlug || undefined,
      categorySlugs,
      brands: brands || undefined,
      status: status || undefined,
      specFilters,
      sort,
      pageSize
    });
  }

  const {
    containerRef,
    handleFormSubmit,
    handleInputChange,
    handleInputFocus,
    handleSelectSuggestion,
    hasResolvedQuery,
    isLoading,
    isOpen,
    query,
    suggestions
  } = usePublicProductSearchAutocomplete({
    buildFallbackHref: (nextQuery) =>
      buildListingHref({
        q: nextQuery
      }),
    initialQuery: currentQ,
    navigate: onNavigate
  });

  function handleSortSelect(nextSort: PublicProductGroupSort) {
    if (isPending) {
      return;
    }

    setIsSortMenuOpen(false);
    onNavigate(
      buildListingHref({
        sort: nextSort
      }),
      'replace'
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <form
        action={PRODUCT_LISTING_PATH}
        className="relative w-full max-w-[560px]"
        method="get"
        onSubmit={handleFormSubmit}
      >
        {lockedParentCategorySlug ? <input name="parent" type="hidden" value={lockedParentCategorySlug} /> : null}
        {currentCategorySlugs ? <input name="categories" type="hidden" value={currentCategorySlugs} /> : null}
        {currentBrands ? <input name="brands" type="hidden" value={currentBrands} /> : null}
        {currentStatus ? <input name="status" type="hidden" value={currentStatus} /> : null}
        {currentSpecFilters ? <input name="spec_filters" type="hidden" value={currentSpecFilters} /> : null}
        {currentSort ? <input name="sort" type="hidden" value={currentSort} /> : null}
        {currentPageSize !== DEFAULT_PRODUCT_LISTING_PAGE_SIZE ? (
          <input name="page_size" type="hidden" value={String(currentPageSize)} />
        ) : null}

        <div className="relative" ref={containerRef}>
          <label className="relative block">
            <input
              className="h-[52px] w-full rounded-xs border border-borderSoft bg-white pl-11 pr-4 text-[14px] leading-5 text-secondary outline-none transition focus:border-primary disabled:cursor-wait disabled:bg-subtle disabled:text-body/55 sm:pl-12"
              disabled={isPending}
              name="q"
              onChange={(event) => handleInputChange(event.target.value)}
              onFocus={handleInputFocus}
              placeholder="Tìm theo tên sản phẩm, model hoặc thương hiệu"
              type="search"
              value={query}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-4 inline-flex items-center text-body/70"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8.75 3.75a5 5 0 1 0 0 10a5 5 0 0 0 0-10Zm0 0c2.761 0 5 2.239 5 5m1.036 5.036L16.25 15.25"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
              </svg>
            </span>
          </label>

          <ProductSearchSuggestionPanel
            hasResolvedQuery={hasResolvedQuery}
            isLoading={isLoading}
            isOpen={isOpen}
            onSelectSuggestion={handleSelectSuggestion}
            query={query}
            suggestions={suggestions}
            widthClassName="w-full"
          />
        </div>

        <button className="sr-only" type="submit">
          Tìm kiếm
        </button>
      </form>

      <div className="flex flex-wrap items-start gap-6 lg:justify-end">
        <p className="max-w-[112px] text-[12px] font-semibold leading-4 text-secondary">
          {resultsLabel}
        </p>

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="hidden whitespace-pre text-[10px] font-black uppercase leading-[12px] tracking-[0.08em] text-body/75 lg:inline">
              {'SẮP\nXẾP:'}
            </span>

            <button
              aria-expanded={isSortMenuOpen}
              className="inline-flex min-h-11 min-w-[176px] items-center justify-between gap-3 rounded-xs border border-borderSoft/40 bg-white px-4 text-[14px] font-bold text-primaryStrong transition hover:border-primary/35 disabled:cursor-wait disabled:bg-subtle disabled:text-body/55"
              disabled={isPending}
              onClick={() => setIsSortMenuOpen((currentValue) => !currentValue)}
              type="button"
            >
              <span>{activeSortLabel}</span>
              <svg
                aria-hidden="true"
                className={['h-4 w-4 text-body/65 transition', isSortMenuOpen ? 'rotate-180' : 'rotate-0'].join(' ')}
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 10L12 15L17 10"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
          </div>

          {isSortMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[244px] rounded-sm border border-borderSoft/25 bg-white p-2 shadow-soft">
              <div className="space-y-1">
                {SORT_OPTIONS.map((option) =>
                  <button
                    aria-pressed={currentSort === option.value || (option.value === 'newest' && currentSort === '')}
                    className={[
                      'flex w-full items-center rounded-xs px-3 py-2 text-left text-[13px] font-medium leading-5 transition',
                      isPending
                        ? 'cursor-wait opacity-55'
                        : currentSort === option.value || (option.value === 'newest' && currentSort === '')
                        ? 'bg-primary/8 text-primaryStrong'
                        : 'text-secondary hover:bg-subtle'
                    ].join(' ')}
                    disabled={isPending}
                    key={option.value}
                    onClick={() => handleSortSelect(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
