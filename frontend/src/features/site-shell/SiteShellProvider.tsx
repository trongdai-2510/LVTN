'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from 'react';

import {
  MAX_QUOTE_QUANTITY,
  parseQuoteRequestQuantity
} from '@/features/quote-request/quantityParser';

const QUOTE_REQUEST_STORAGE_KEY = 'song-thanh:quote-request-items';
export const MAX_QUOTE_REQUEST_ITEM_QUANTITY = MAX_QUOTE_QUANTITY;

type QuoteRequestKind = 'quote' | 'priced' | 'general';

export type QuoteContextItem = {
  product_group_id: string;
  product_variant_id?: string;
  product_name?: string;
  variant_name?: string;
  quantity?: number;
  request_kind?: QuoteRequestKind;
  public_price_amount?: number;
};

export type QuoteRequestItem = QuoteContextItem & {
  key: string;
  quantity: number;
};

type SiteShellContextValue = {
  is_quote_modal_open: boolean;
  quote_modal_opener: HTMLElement | null;
  quote_request_count: number;
  quote_request_items: QuoteRequestItem[];
  openQuoteRequest: (item?: QuoteContextItem | null) => void;
  addQuoteRequestItem: (item: QuoteContextItem) => void;
  removeQuoteRequestItem: (key: string) => void;
  updateQuoteRequestItemQuantity: (key: string, quantity: number) => void;
  clearQuoteRequestItems: () => void;
  closeQuoteRequest: () => void;
};

const SiteShellContext = createContext<SiteShellContextValue | null>(null);

function buildQuoteRequestKey(item: Pick<QuoteContextItem, 'product_group_id' | 'product_variant_id'>) {
  return [item.product_group_id, item.product_variant_id ?? 'group'].join('::');
}

function normalizeQuoteRequestQuantity(quantity: unknown) {
  const parsed = parseQuoteRequestQuantity(quantity);
  return parsed.valid ? parsed.value : 1;
}

function normalizeQuoteRequestItem(item: QuoteContextItem): QuoteRequestItem {
  return {
    key: buildQuoteRequestKey(item),
    product_group_id: item.product_group_id,
    product_variant_id: item.product_variant_id,
    product_name: item.product_name,
    variant_name: item.variant_name,
    request_kind: item.request_kind,
    public_price_amount:
      typeof item.public_price_amount === 'number' &&
      Number.isFinite(item.public_price_amount) && item.public_price_amount > 0
        ? item.public_price_amount
        : undefined,
    quantity: normalizeQuoteRequestQuantity(item.quantity)
  };
}

function mergeQuoteRequestItem(
  currentItems: QuoteRequestItem[],
  item: QuoteContextItem,
  mode: 'preserve' | 'increment'
) {
  const normalizedItem = normalizeQuoteRequestItem(item);
  const existingIndex = currentItems.findIndex(
    (currentItem) => currentItem.key === normalizedItem.key
  );

  if (existingIndex === -1) {
    return [...currentItems, normalizedItem];
  }

  const existingItem = currentItems[existingIndex];
  const nextItem: QuoteRequestItem = {
    ...existingItem,
    ...normalizedItem,
    quantity:
      mode === 'increment'
        ? normalizeQuoteRequestQuantity(
            existingItem.quantity + normalizedItem.quantity
          )
        : existingItem.quantity
  };

  return currentItems.map((currentItem, index) =>
    index === existingIndex ? nextItem : currentItem
  );
}

function readStoredQuoteRequestItems() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedValue = window.sessionStorage.getItem(QUOTE_REQUEST_STORAGE_KEY);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return [];
      }

      const productGroupId =
        'product_group_id' in candidate && typeof candidate.product_group_id === 'string'
          ? candidate.product_group_id
          : null;

      if (!productGroupId) {
        return [];
      }

      return [
        normalizeQuoteRequestItem({
          product_group_id: productGroupId,
          product_variant_id:
            'product_variant_id' in candidate && typeof candidate.product_variant_id === 'string'
              ? candidate.product_variant_id
              : undefined,
          product_name:
            'product_name' in candidate && typeof candidate.product_name === 'string'
              ? candidate.product_name
              : undefined,
          variant_name:
            'variant_name' in candidate && typeof candidate.variant_name === 'string'
              ? candidate.variant_name
              : undefined,
          request_kind:
            'request_kind' in candidate &&
            (
              candidate.request_kind === 'quote' ||
              candidate.request_kind === 'priced' ||
              candidate.request_kind === 'general'
            )
              ? candidate.request_kind
              : undefined,
          public_price_amount:
            'public_price_amount' in candidate && typeof candidate.public_price_amount === 'number'
              ? candidate.public_price_amount
              : undefined,
          quantity: 'quantity' in candidate ? candidate.quantity : 1
        })
      ];
    });
  } catch {
    return [];
  }
}

export function SiteShellProvider({ children }: PropsWithChildren) {
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteRequestItems, setQuoteRequestItems] = useState<QuoteRequestItem[]>([]);
  const [hasHydratedQuoteRequestItems, setHasHydratedQuoteRequestItems] = useState(false);
  const hasQuoteItemsInteraction = useRef(false);
  const quoteModalOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const storedItems = readStoredQuoteRequestItems();
    setQuoteRequestItems((currentItems) =>
      hasQuoteItemsInteraction.current ? currentItems : storedItems
    );
    setHasHydratedQuoteRequestItems(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedQuoteRequestItems || typeof window === 'undefined') {
      return;
    }

    if (quoteRequestItems.length === 0) {
      window.sessionStorage.removeItem(QUOTE_REQUEST_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(
      QUOTE_REQUEST_STORAGE_KEY,
      JSON.stringify(quoteRequestItems)
    );
  }, [hasHydratedQuoteRequestItems, quoteRequestItems]);

  const addQuoteRequestItem = useCallback((item: QuoteContextItem) => {
    hasQuoteItemsInteraction.current = true;
    setQuoteRequestItems((currentItems) => mergeQuoteRequestItem(currentItems, item, 'increment'));
  }, []);

  const openQuoteRequest = useCallback((item?: QuoteContextItem | null) => {
    quoteModalOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (item) {
      hasQuoteItemsInteraction.current = true;
      setQuoteRequestItems((currentItems) =>
        mergeQuoteRequestItem(currentItems, item, 'preserve')
      );
    }
    setIsQuoteModalOpen(true);
  }, []);

  const removeQuoteRequestItem = useCallback((key: string) => {
    hasQuoteItemsInteraction.current = true;
    setQuoteRequestItems((currentItems) =>
      currentItems.filter((currentItem) => currentItem.key !== key)
    );
  }, []);

  const updateQuoteRequestItemQuantity = useCallback((key: string, quantity: number) => {
    hasQuoteItemsInteraction.current = true;
    setQuoteRequestItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.key === key
          ? { ...currentItem, quantity: normalizeQuoteRequestQuantity(quantity) }
          : currentItem
      )
    );
  }, []);

  const clearQuoteRequestItems = useCallback(() => {
    hasQuoteItemsInteraction.current = true;
    setQuoteRequestItems([]);
  }, []);

  const closeQuoteRequest = useCallback(() => {
    setIsQuoteModalOpen(false);
  }, []);

  const value = useMemo<SiteShellContextValue>(
    () => ({
      is_quote_modal_open: isQuoteModalOpen,
      quote_modal_opener: quoteModalOpenerRef.current,
      quote_request_count: quoteRequestItems.length,
      quote_request_items: quoteRequestItems,
      openQuoteRequest,
      addQuoteRequestItem,
      removeQuoteRequestItem,
      updateQuoteRequestItemQuantity,
      clearQuoteRequestItems,
      closeQuoteRequest
    }),
    [
      addQuoteRequestItem,
      clearQuoteRequestItems,
      closeQuoteRequest,
      isQuoteModalOpen,
      openQuoteRequest,
      quoteRequestItems,
      removeQuoteRequestItem,
      updateQuoteRequestItemQuantity
    ]
  );

  return <SiteShellContext.Provider value={value}>{children}</SiteShellContext.Provider>;
}

export function useSiteShell() {
  const context = useContext(SiteShellContext);

  if (!context) {
    throw new Error('useSiteShell must be used within SiteShellProvider.');
  }

  return context;
}
