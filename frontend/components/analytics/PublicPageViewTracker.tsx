'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

import { publicFetcher } from '@/lib/api/public-fetcher';

const DEDUPE_WINDOW_MS = 5_000;

export function PublicPageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin-preview')) return;

    const storageKey = `songthanh:page-view:${pathname}`;
    const now = Date.now();
    const previous = Number(window.sessionStorage.getItem(storageKey) ?? 0);
    if (Number.isFinite(previous) && now - previous < DEDUPE_WINDOW_MS) return;

    window.sessionStorage.setItem(storageKey, String(now));
    void publicFetcher<{ recorded: true; view_count: number }>('/public/site-views', {
      method: 'POST',
      keepalive: true
    }).catch(() => {
      window.sessionStorage.removeItem(storageKey);
    });
  }, [pathname]);

  return null;
}
