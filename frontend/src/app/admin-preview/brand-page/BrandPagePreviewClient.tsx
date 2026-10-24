'use client';

import { useEffect, useState } from 'react';

import { BrandDetailPage } from '@/features/partners/BrandDetailPage';
import type { PublicBrandDetailResponse } from '@/types/contracts/public-brands';

const PREVIEW_MESSAGE_TYPE = 'song-thanh:brand-page-preview';
const PREVIEW_READY_MESSAGE_TYPE = 'song-thanh:brand-page-preview:ready';

type PreviewMessage = {
  type: typeof PREVIEW_MESSAGE_TYPE;
  payload: PublicBrandDetailResponse;
};

const EMPTY_DRAFT: PublicBrandDetailResponse = {
  brand: {
    id: 'preview-brand',
    name: 'Thương hiệu',
    slug: 'preview',
    description: null,
    website_url: null,
    logo_file_id: null,
    logo_file: null
  },
  brand_page: {
    id: 'preview-brand-page',
    brand_id: 'preview-brand',
    title: 'Trang thương hiệu',
    excerpt: null,
    overview_title: null,
    overview_body: null,
    support_title: null,
    support_intro: null,
    support_items: [],
    support_image_file_id: null,
    support_image_file: null,
    hero_title_size: 'large',
    hero_excerpt_size: 'large',
    hero_eyebrow_color: '#004AB4',
    hero_title_color: '#0B1C30',
    hero_excerpt_color: '#334155',
    accent_color: null,
    layout_archetype: 'auto',
    cta_title: null,
    cta_description: null,
    cta_button_label: null,
    cta_button_url: null,
    seo_title: null,
    seo_description: null,
    seo_og_image_file_id: null,
    seo_og_image_file: null
  },
  hero_banner: null,
  verified_stats: [],
  derived_categories: [],
  pinned_products: [],
  sources: []
};

export function BrandPagePreviewClient() {
  const [draft, setDraft] = useState<PublicBrandDetailResponse>(EMPTY_DRAFT);

  useEffect(() => {
    function handleMessage(event: MessageEvent<unknown>) {
      if (event.source !== window.parent || !isAllowedPreviewOrigin(event.origin) || !isPreviewMessage(event.data)) {
        return;
      }

      setDraft(event.data.payload);
    }

    window.addEventListener('message', handleMessage);
    window.parent?.postMessage({ type: PREVIEW_READY_MESSAGE_TYPE }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return <BrandDetailPage brandDetail={draft} />;
}

function isPreviewMessage(value: unknown): value is PreviewMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === PREVIEW_MESSAGE_TYPE &&
    typeof (value as { payload?: unknown }).payload === 'object' &&
    (value as { payload?: unknown }).payload !== null
  );
}

function isAllowedPreviewOrigin(origin: string) {
  if (!origin || origin === window.location.origin) {
    return true;
  }

  const configuredAdminUrl = process.env.NEXT_PUBLIC_ADMIN_SITE_URL;
  if (configuredAdminUrl) {
    try {
      if (origin === new URL(configuredAdminUrl).origin) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return ['http://localhost:3001', 'http://127.0.0.1:3001'].includes(origin);
}
