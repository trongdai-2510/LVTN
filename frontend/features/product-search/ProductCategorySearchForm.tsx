'use client';

import Link from 'next/link';

import { buildProductListingHref } from '@/features/product-categories/product-category-routing';
import {
  getPublicProductCategorySlug,
  type ProductCategoryTreeNode
} from '@/features/product-categories/product-category-tree';

import {
  ProductSearchSuggestionPanel,
  usePublicProductSearchAutocomplete
} from './public-product-search';

type ProductCategorySearchFormProps = {
  categories: ProductCategoryTreeNode[];
};

function buildFallbackListingHref(query: string): string {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return buildProductListingHref();
  }

  return buildProductListingHref({ q: trimmedQuery });
}

export function ProductCategorySearchForm({
  categories
}: ProductCategorySearchFormProps) {
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
    buildFallbackHref: buildFallbackListingHref
  });

  return (
    <form action="/san-pham/danh-sach" className="space-y-6" method="get" onSubmit={handleFormSubmit}>
      <div className="relative" ref={containerRef}>
        <input
          className="type-input h-[54px] w-full rounded-xs border border-borderSoft bg-white px-12 pr-5 text-secondary outline-none transition focus:border-primary"
          id="q"
          name="q"
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={handleInputFocus}
          placeholder="Tìm sản phẩm, model hoặc thương hiệu"
          type="search"
          value={query}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-4 inline-flex items-center text-body"
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

      <div className="rounded-sm bg-subtle p-4">
        <div className="flex flex-wrap gap-3">
          <Link
            className="type-button inline-flex h-11 items-center rounded-xs bg-primary px-6 text-white shadow-soft"
            href="/san-pham/danh-sach"
          >
            Tất cả sản phẩm
          </Link>
          {categories.map((category) => (
          <Link
            className="type-button inline-flex h-11 items-center rounded-xs bg-white px-6 text-body shadow-soft transition hover:text-primary"
            href={buildProductListingHref({ parentSlug: getPublicProductCategorySlug(category) })}
            key={category.id}
          >
              {category.name}
            </Link>
          ))}
        </div>
      </div>
    </form>
  );
}
