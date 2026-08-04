'use client';

import dynamic from 'next/dynamic';

import { useSiteShell } from '@/features/site-shell/SiteShellProvider';

const DeferredQuoteRequestModal = dynamic(
  () => import('./QuoteRequestModal').then((module) => module.QuoteRequestModal),
  {
    loading: () => null,
    ssr: false
  }
);

export function LazyQuoteRequestModal() {
  const { is_quote_modal_open } = useSiteShell();

  if (!is_quote_modal_open) {
    return null;
  }

  return <DeferredQuoteRequestModal />;
}
