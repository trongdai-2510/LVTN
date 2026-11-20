'use client';

import { useState, type ReactNode } from 'react';

import {
  buildProductListingHref,
  DEFAULT_PRODUCT_LISTING_PAGE_SIZE,
  PRODUCT_LISTING_PATH
} from '@/features/product-categories/product-category-routing';
import {
  ProductSearchSuggestionPanel,
  usePublicProductSearchAutocomplete
} from '@/features/product-search/public-product-search';
import { MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH } from '@/features/product-search/publicProductSearchConstants';
import type { PublicProductGroupSort } from '@/types/contracts/public-product-groups';
import { getProductGroupSortLabel, PRODUCT_GROUP_SORT_OPTIONS } from './productGroupSort';

type ProductGroupFiltersProps = {
  categoryNav?: ReactNode;
  currentBrands: string;
  currentCategorySlugs: string;
  currentPageSize: number;
  currentQ: string;
  currentSpecFilters: string;
  currentStatus: string;
  currentSort: PublicProductGroupSort | '';
  isPending: boolean;
  lockedParentCategorySlug: string;
  filterControl?: ReactNode;
  filterPanel?: ReactNode;
  onCloseFilterPanel?: () => void;
  onNavigate: (href: string, mode?: 'push' | 'replace') => void;
};

export function ProductGroupFilters({
  categoryNav,
  currentBrands,
  currentCategorySlugs,
  currentPageSize,
  currentQ,
  currentSpecFilters,
  currentStatus,
  currentSort,
  isPending,
  lockedParentCategorySlug,
  filterControl,
  filterPanel,
  onCloseFilterPanel,
  onNavigate
}: ProductGroupFiltersProps) {
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const activeSortLabel = getProductGroupSortLabel(currentSort);

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
    handleInputKeyDown,
    handleSelectSuggestion,
    handleViewAll,
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
    navigate: (href) => onNavigate(href, 'push')
  });

  function handleSortSelect(nextSort: PublicProductGroupSort | '') {
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
    <div className={['relative rounded-2xl border bg-white p-3 transition-colors lg:p-3.5', filterPanel ? 'border-[#b9d3ed]' : 'border-[#dbe5f1]'].join(' ')}>
      {categoryNav}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3">
      <div className="flex min-w-0 w-full items-center gap-2 lg:flex-1">
      <form
        action={PRODUCT_LISTING_PATH}
        className="relative w-full"
        data-product-search-resolved={hasResolvedQuery}
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
              className="h-12 w-full rounded-xl border border-[#d9e4f0] bg-[#f8fafd] pl-11 pr-4 text-[15px] leading-5 text-secondary outline-none transition focus:border-primaryStrong focus:bg-white focus:ring-2 focus:ring-primary/10 sm:pl-12"
              maxLength={MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH}
              name="q"
              onChange={(event) => handleInputChange(event.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={handleInputKeyDown}
              placeholder="Tìm sản phẩm, thương hiệu"
              aria-label="Tìm sản phẩm hoặc thương hiệu"
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
            onViewAll={handleViewAll}
            query={query}
            suggestions={suggestions}
            widthClassName="w-full"
          />
        </div>

        <button className="sr-only" type="submit">
          Tìm kiếm
        </button>
      </form>
      </div>

      <div className="flex items-center gap-2 lg:shrink-0">
        {filterControl ? <div className="min-w-0 flex-1 lg:flex-none">{filterControl}</div> : null}
        <div className="relative min-w-[108px] flex-1 sm:min-w-[126px] lg:w-[174px] lg:flex-none">
          <div>
            <button
              aria-expanded={isSortMenuOpen}
              aria-label={`Sắp xếp: ${activeSortLabel}`}
              className="inline-flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-[#d9e4f0] bg-white px-3 text-secondary transition hover:border-primary/45 hover:bg-[#f8fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-wait disabled:bg-subtle disabled:text-body/55"
              disabled={isPending}
              onClick={() => { onCloseFilterPanel?.(); setIsSortMenuOpen((currentValue) => !currentValue); }}
              type="button"
            >
              <span className="flex min-w-0 flex-col items-start leading-tight"><span className="text-[10px] font-medium text-body/65">Sắp xếp</span><span className="truncate text-[13px] font-semibold sm:text-[14px]">{activeSortLabel}</span></span>
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
            <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[244px] rounded-xl border border-[#d9e4f0] bg-white p-2 shadow-soft">
              <div className="space-y-1">
                {PRODUCT_GROUP_SORT_OPTIONS.map((option) =>
                  <button
                    aria-pressed={currentSort === option.value}
                    className={[
                      'flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-[13px] font-medium leading-5 transition',
                      isPending
                        ? 'cursor-wait opacity-55'
                        : currentSort === option.value
                        ? 'bg-primary/8 text-primaryStrong'
                        : 'text-secondary hover:bg-subtle'
                    ].join(' ')}
                    disabled={isPending}
                    key={option.value || 'priority'}
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
      {filterPanel ? (
        <div
          className="mt-3 w-full border-t border-borderBlue pt-3"
          id="product-filter-panel"
        >{filterPanel}</div>
      ) : null}
    </div>
  );
}
