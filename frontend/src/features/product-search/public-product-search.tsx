'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject
} from 'react';

import { useRouter } from 'next/navigation';

import { MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH } from './publicProductSearchConstants';
import { getPublicProductSearchSuggestions } from '@/lib/api/public-product-groups';
import type { PublicProductSearchSuggestionItem } from '@/types/contracts/public-product-groups';

const MIN_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH = 2;
const DEFAULT_DEBOUNCE_MS = 250;

type UsePublicProductSearchAutocompleteOptions = {
  buildFallbackHref: (query: string) => string;
  debounceMs?: number;
  initialQuery?: string;
  minQueryLength?: number;
  navigate?: (href: string, mode?: 'push' | 'replace') => void;
};

type UsePublicProductSearchAutocompleteResult = {
  closeSuggestions: () => void;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  handleFormSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleInputChange: (value: string) => void;
  handleInputFocus: () => void;
  handleInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  handleSelectSuggestion: (item: PublicProductSearchSuggestionItem) => void;
  handleViewAll: () => void;
  hasResolvedQuery: boolean;
  isLoading: boolean;
  isOpen: boolean;
  query: string;
  suggestions: PublicProductSearchSuggestionItem[];
};

function isVariantSuggestion(
  item: PublicProductSearchSuggestionItem
): item is PublicProductSearchSuggestionItem & {
  type: 'variant';
  model_code: string;
  variant_name: string;
} {
  return item.type === 'variant' && Boolean(item.model_code?.trim());
}

function normalizeModelCodeToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function buildProductSearchSuggestionHref(
  item: PublicProductSearchSuggestionItem
): string {
  const slug = item.group_slug?.trim();
  const groupPath = slug ? `/san-pham/${encodeURIComponent(slug)}` : item.href || '/san-pham';

  if (isVariantSuggestion(item) && slug) {
    return `${groupPath}?variant=${encodeURIComponent(item.model_code.trim())}`;
  }

  return groupPath;
}

function findExactVariantSuggestion(
  items: PublicProductSearchSuggestionItem[],
  query: string
): PublicProductSearchSuggestionItem | null {
  const normalizedQuery = normalizeModelCodeToken(query);
  if (!normalizedQuery) {
    return null;
  }

  return (
    items.find(
      (item) =>
        item.type === 'variant' &&
        item.model_code &&
        normalizeModelCodeToken(item.model_code) === normalizedQuery
    ) ?? null
  );
}

function formatSuggestionTitle(item: PublicProductSearchSuggestionItem): string {
  if (item.type === 'variant') {
    return item.variant_name?.trim() || item.group_name?.trim() || item.title;
  }

  return item.group_name?.trim() || item.title;
}

function normalizeSuggestionName(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi').replace(/\s+/g, ' ').trim();
}

type DisplaySuggestion = {
  item: PublicProductSearchSuggestionItem;
  detail: string | null;
};

function buildDisplaySuggestions(items: PublicProductSearchSuggestionItem[], query: string): DisplaySuggestion[] {
  const groups = new Map(
    items.filter((item) => item.type === 'product_group' && item.group_slug).map((item) => [item.group_slug, item])
  );
  const exactVariant = findExactVariantSuggestion(items, query);
  const mergedCodes = new Map<string, Set<string>>();

  const visible = items.filter((item) => {
    if (item.type === 'product_group' && exactVariant?.group_slug === item.group_slug) return false;
    if (item.type !== 'variant' || !item.group_slug || item === exactVariant) return true;

    const group = groups.get(item.group_slug);
    if (!group || normalizeSuggestionName(formatSuggestionTitle(item)) !== normalizeSuggestionName(formatSuggestionTitle(group))) {
      return true;
    }

    if (item.model_code?.trim()) {
      const codes = mergedCodes.get(item.group_slug) ?? new Set<string>();
      codes.add(item.model_code.trim());
      mergedCodes.set(item.group_slug, codes);
    }
    return false;
  });

  return visible.map((item) => {
    if (item.type === 'variant') {
      const groupName = item.group_name?.trim();
      const nameIsRepeated = normalizeSuggestionName(formatSuggestionTitle(item)) === normalizeSuggestionName(groupName);
      const modelLabel = item.model_code?.trim() ? `Mã ${item.model_code.trim()}` : null;
      return { item, detail: [modelLabel, nameIsRepeated ? null : groupName || item.subtitle].filter(Boolean).join(' · ') || null };
    }
    if (item.type === 'product_group') {
      const codes = mergedCodes.get(item.group_slug ?? '');
      return { item, detail: codes?.size === 1 ? `Mã ${[...codes][0]}` : codes?.size ? `${codes.size} mã phù hợp` : null };
    }
    return { item, detail: getSuggestionTypeLabel(item.type) };
  });
}

function getSuggestionTypeLabel(type: PublicProductSearchSuggestionItem['type']): string {
  switch (type) {
    case 'variant': return 'Model / SKU';
    case 'product_group': return 'Sản phẩm';
    case 'category': return 'Danh mục';
    case 'brand': return 'Thương hiệu';
    case 'service': return 'Dịch vụ';
    case 'project': return 'Dự án';
    case 'news': return 'Tin tức';
    case 'page': return 'Trang thông tin';
  }
}

export function usePublicProductSearchAutocomplete(
  options: UsePublicProductSearchAutocompleteOptions
): UsePublicProductSearchAutocompleteResult {
  const {
    buildFallbackHref,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    initialQuery = '',
    minQueryLength = MIN_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH,
    navigate
  } = options;
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestCounterRef = useRef(0);
  const shouldOpenSuggestionsRef = useRef(false);
  const [query, setQuery] = useState(
    initialQuery.slice(0, MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH)
  );
  const [suggestions, setSuggestions] = useState<PublicProductSearchSuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasResolvedQuery, setHasResolvedQuery] = useState(false);
  const [resolvedQuery, setResolvedQuery] = useState('');

  useEffect(() => {
    setQuery(initialQuery.slice(0, MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH));
  }, [initialQuery]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeSuggestions();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        const focusWasInside = containerRef.current?.contains(document.activeElement);
        if (focusWasInside) containerRef.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
        closeSuggestions();
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < minQueryLength) {
      setSuggestions([]);
      setHasResolvedQuery(false);
      setIsLoading(false);
      setResolvedQuery('');
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestCounterRef.current;
    const timer = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const response = await getPublicProductSearchSuggestions(trimmedQuery, {
          signal: controller.signal
        });

        if (requestId !== requestCounterRef.current || controller.signal.aborted) {
          return;
        }

        setSuggestions(response.items);
        setHasResolvedQuery(true);
        setResolvedQuery(trimmedQuery);
        setIsOpen(shouldOpenSuggestionsRef.current);
      } catch {
        if (requestId !== requestCounterRef.current || controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setHasResolvedQuery(true);
        setResolvedQuery(trimmedQuery);
        setIsOpen(shouldOpenSuggestionsRef.current);
      } finally {
        if (requestId === requestCounterRef.current && !controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [debounceMs, minQueryLength, query]);

  function closeSuggestions() {
    // A resolved request can arrive after the customer has submitted the form
    // or clicked elsewhere. Invalidate it so it cannot reopen a suggestion
    // panel over the newly loaded search results.
    requestCounterRef.current += 1;
    shouldOpenSuggestionsRef.current = false;
    setIsOpen(false);
    setIsLoading(false);
  }

  function handleInputChange(nextValue: string) {
    shouldOpenSuggestionsRef.current = true;
    const boundedValue = nextValue.slice(
      0,
      MAX_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH
    );
    // Invalidate the previous request immediately. The effect cleanup only runs
    // after React renders, leaving a brief window for old results to reappear.
    requestCounterRef.current += 1;
    setSuggestions([]);
    setHasResolvedQuery(false);
    setResolvedQuery('');
    setQuery(boundedValue);

    if (boundedValue.trim().length >= minQueryLength) {
      setIsLoading(true);
      setIsOpen(true);
      return;
    }

    setIsLoading(false);
    setIsOpen(false);
  }

  function handleInputFocus() {
    shouldOpenSuggestionsRef.current = true;
    if (
      query.trim().length >= minQueryLength &&
      (suggestions.length > 0 || hasResolvedQuery || isLoading)
    ) {
      setIsOpen(true);
    }
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowDown' || !isOpen) return;
    const firstSuggestion = containerRef.current?.querySelector<HTMLButtonElement>('[data-product-search-suggestions] button');
    if (firstSuggestion) {
      event.preventDefault();
      firstSuggestion.focus();
    }
  }

  function handleSelectSuggestion(item: PublicProductSearchSuggestionItem) {
    closeSuggestions();
    const href = buildProductSearchSuggestionHref(item);

    if (navigate) {
      navigate(href, 'push');
      return;
    }

    router.push(href);
  }

  function handleViewAll() {
    closeSuggestions();
    const href = buildFallbackHref(query.trim());
    if (navigate) {
      navigate(href, 'replace');
      return;
    }
    router.push(href);
  }

  async function resolveExactVariantSuggestion(
    trimmedQuery: string
  ): Promise<PublicProductSearchSuggestionItem | null> {
    if (trimmedQuery.length < minQueryLength) {
      return null;
    }

    if (resolvedQuery === trimmedQuery) {
      return findExactVariantSuggestion(suggestions, trimmedQuery);
    }

    try {
      const response = await getPublicProductSearchSuggestions(trimmedQuery);
      return findExactVariantSuggestion(response.items, trimmedQuery);
    } catch {
      return null;
    }
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    const exactVariantSuggestion = await resolveExactVariantSuggestion(trimmedQuery);

    if (exactVariantSuggestion) {
      handleSelectSuggestion(exactVariantSuggestion);
      return;
    }

    closeSuggestions();
    const href = buildFallbackHref(trimmedQuery);

    if (navigate) {
      navigate(href, 'replace');
      return;
    }

    router.push(href);
  }

  return {
    closeSuggestions,
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
  };
}

export function ProductSearchSuggestionPanel({
  align = 'left',
  emptyLabel = 'Không tìm thấy kết quả phù hợp.',
  hasResolvedQuery,
  isLoading,
  isOpen,
  onSelectSuggestion,
  onViewAll,
  query,
  suggestions,
  widthClassName = 'w-full'
}: {
  align?: 'left' | 'right';
  emptyLabel?: string;
  hasResolvedQuery: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onSelectSuggestion: (item: PublicProductSearchSuggestionItem) => void;
  onViewAll: () => void;
  query: string;
  suggestions: PublicProductSearchSuggestionItem[];
  widthClassName?: string;
}) {
  const trimmedQuery = query.trim();

  if (!isOpen || trimmedQuery.length < MIN_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH) {
    return null;
  }

  const displaySuggestions = buildDisplaySuggestions(suggestions, trimmedQuery).slice(0, 3);

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;

    event.preventDefault();
    if (event.key === 'ArrowDown') {
      buttons[Math.min(index + 1, buttons.length - 1)]?.focus();
    } else if (index === 0) {
      event.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    } else {
      buttons[index - 1]?.focus();
    }
  }

  return (
    <div
      data-product-search-suggestions="true"
      aria-label="Gợi ý tìm kiếm"
      className={[
        'absolute top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-borderBlue bg-white shadow-xl',
        align === 'right' ? 'right-0' : 'left-0',
        widthClassName
      ].join(' ')}
      onKeyDown={handlePanelKeyDown}
      role="region"
    >
      <div className="border-b border-borderBlue px-4 py-3">
        <p className="truncate text-[13px] font-medium leading-5 text-body">Gợi ý cho <span className="font-semibold text-secondary">“{trimmedQuery}”</span></p>
      </div>
      {isLoading ? (
        <div className="px-4 py-5 text-sm leading-5 text-body" role="status">
          Đang tìm kiếm gợi ý...
        </div>
      ) : displaySuggestions.length > 0 ? (
        <div>
          {displaySuggestions.map(({ item, detail }, index) => (
            <button
              className="group flex min-h-[64px] w-full items-center border-b border-borderBlue/70 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-primarySoft/55 focus-visible:bg-primarySoft/55 focus-visible:outline-none"
              data-product-search-option="true"
              key={`${item.type}:${item.group_slug}:${item.model_code ?? item.group_name}:${index}`}
              onClick={() => onSelectSuggestion(item)}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <span className="min-w-0 flex-1">
                <span className="block line-clamp-2 text-[14px] font-semibold leading-[1.4] text-secondary sm:text-[15px]">
                  {formatSuggestionTitle(item)}
                </span>
                {detail ? <span className="mt-0.5 block line-clamp-1 text-[12px] leading-4 text-body">{detail}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : hasResolvedQuery ? (
        <div className="px-4 py-5 text-sm leading-5 text-body">{emptyLabel}</div>
      ) : null}
      <button
        className="flex min-h-12 w-full items-center justify-between border-t border-borderBlue bg-primarySoft/35 px-4 py-3 text-left text-[13px] font-bold text-primaryStrong transition-colors hover:bg-primarySoft focus-visible:bg-primarySoft focus-visible:outline-none"
        onClick={onViewAll}
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        Xem tất cả kết quả <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
