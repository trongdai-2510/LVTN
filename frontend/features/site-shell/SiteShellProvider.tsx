'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

const QUOTE_REQUEST_STORAGE_KEY = 'song-thanh:quote-request-items';

export type QuoteRequestKind = 'quote' | 'priced' | 'general';

export type QuoteContextItem = {
  product_group_id: string;
  product_variant_id?: string;
  product_name?: string;
  variant_name?: string;
  quantity?: number;
  request_kind?: QuoteRequestKind;
};

export type QuoteRequestItem = QuoteContextItem & {
  key: string;
  quantity: number;
};

type SiteShellContextValue = {
  is_quote_modal_open: boolean;
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

function normalizeQuantity(quantity: unknown) {
  const numericQuantity = Number(quantity);

  if (!Number.isFinite(numericQuantity) || numericQuantity < 1) {
    return 1;
  }

  return Math.floor(numericQuantity);
}

function normalizeQuoteRequestItem(item: QuoteContextItem): QuoteRequestItem {
  return {
    key: buildQuoteRequestKey(item),
    product_group_id: item.product_group_id,
    product_variant_id: item.product_variant_id,
    product_name: item.product_name,
    variant_name: item.variant_name,
    request_kind: item.request_kind,
    quantity: normalizeQuantity(item.quantity)
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
        ? existingItem.quantity + normalizedItem.quantity
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

  useEffect(() => {
    setQuoteRequestItems(readStoredQuoteRequestItems());
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
    setQuoteRequestItems((currentItems) => mergeQuoteRequestItem(currentItems, item, 'increment'));
  }, []);

  const openQuoteRequest = useCallback((item?: QuoteContextItem | null) => {
    if (item) {
      setQuoteRequestItems((currentItems) =>
        mergeQuoteRequestItem(currentItems, item, 'preserve')
      );
    }

    setIsQuoteModalOpen(true);
  }, []);

  const removeQuoteRequestItem = useCallback((key: string) => {
    setQuoteRequestItems((currentItems) =>
      currentItems.filter((currentItem) => currentItem.key !== key)
    );
  }, []);

  const updateQuoteRequestItemQuantity = useCallback((key: string, quantity: number) => {
    setQuoteRequestItems((currentItems) =>
      currentItems.map((currentItem) =>
        currentItem.key === key
          ? { ...currentItem, quantity: normalizeQuantity(quantity) }
          : currentItem
      )
    );
  }, []);

  const clearQuoteRequestItems = useCallback(() => {
    setQuoteRequestItems([]);
  }, []);

  const closeQuoteRequest = useCallback(() => {
    setIsQuoteModalOpen(false);
  }, []);

  const value = useMemo<SiteShellContextValue>(
    () => ({
      is_quote_modal_open: isQuoteModalOpen,
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
