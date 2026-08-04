'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MutableRefObject
} from 'react';

import { useRouter } from 'next/navigation';

import { getPublicProductSearchSuggestions } from '@/lib/api/public-product-groups';
import type { PublicProductSearchSuggestionItem } from '@/types/contracts/public-product-groups';

export const MIN_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH = 2;
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
  handleSelectSuggestion: (item: PublicProductSearchSuggestionItem) => void;
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

export function normalizeModelCodeToken(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

export function buildProductSearchSuggestionHref(
  item: PublicProductSearchSuggestionItem
): string {
  const slug = item.group_slug?.trim();
  const groupPath = slug ? `/san-pham/${encodeURIComponent(slug)}` : item.href || '/san-pham';

  if (isVariantSuggestion(item) && slug) {
    return `${groupPath}?variant=${encodeURIComponent(item.model_code.trim())}`;
  }

  return groupPath;
}

export function findExactVariantSuggestion(
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
    const variantName = item.variant_name?.trim() || item.group_name?.trim() || item.title;
    const modelCode = item.model_code?.trim();
    return modelCode ? `${variantName} - ${modelCode}` : variantName;
  }

  return item.group_name?.trim() || item.title;
}

function formatSuggestionSubtitle(item: PublicProductSearchSuggestionItem): string {
  return item.type === 'variant' ? item.group_name?.trim() || item.subtitle || 'Sản phẩm' : 'Nhóm sản phẩm';
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
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<PublicProductSearchSuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasResolvedQuery, setHasResolvedQuery] = useState(false);
  const [resolvedQuery, setResolvedQuery] = useState('');

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeSuggestions();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
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
        setIsOpen(true);
      } catch {
        if (requestId !== requestCounterRef.current || controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setHasResolvedQuery(true);
        setResolvedQuery(trimmedQuery);
        setIsOpen(true);
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
    setIsOpen(false);
    setIsLoading(false);
  }

  function handleInputChange(nextValue: string) {
    setQuery(nextValue);

    if (nextValue.trim().length >= minQueryLength) {
      setIsOpen(true);
      return;
    }

    setIsOpen(false);
  }

  function handleInputFocus() {
    if (
      query.trim().length >= minQueryLength &&
      (suggestions.length > 0 || hasResolvedQuery || isLoading)
    ) {
      setIsOpen(true);
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
    handleSelectSuggestion,
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
  query: string;
  suggestions: PublicProductSearchSuggestionItem[];
  widthClassName?: string;
}) {
  const trimmedQuery = query.trim();

  if (!isOpen || trimmedQuery.length < MIN_PUBLIC_PRODUCT_SEARCH_QUERY_LENGTH) {
    return null;
  }

  return (
    <div
      className={[
        'absolute top-[calc(100%+8px)] z-30 overflow-hidden rounded-sm border border-[#D7E3FA] bg-white shadow-soft',
        align === 'right' ? 'right-0' : 'left-0',
        widthClassName
      ].join(' ')}
    >
      {isLoading ? (
        <div className="px-4 py-3 text-[13px] leading-5 text-body/70">
          Đang tìm kiếm gợi ý...
        </div>
      ) : suggestions.length > 0 ? (
        <div className="max-h-[360px] overflow-y-auto py-1">
          {suggestions.map((item, index) => (
            <button
              className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition hover:bg-[#F6FAFF]"
              key={`${item.type}:${item.group_slug}:${item.model_code ?? item.group_name}:${index}`}
              onClick={() => onSelectSuggestion(item)}
              onMouseDown={(event) => event.preventDefault()}
              type="button"
            >
              <span className="text-[13px] font-semibold leading-5 text-secondary">
                {formatSuggestionTitle(item)}
              </span>
              <span className="text-[12px] leading-4 text-body/68">
                {formatSuggestionSubtitle(item)}
              </span>
            </button>
          ))}
        </div>
      ) : hasResolvedQuery ? (
        <div className="px-4 py-3 text-[13px] leading-5 text-body/70">{emptyLabel}</div>
      ) : null}
    </div>
  );
}
