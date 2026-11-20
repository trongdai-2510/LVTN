'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { BookOpen, Boxes, Search, Sparkles } from '@/components/icons';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';

export type RecordMap = Record<string, unknown>;

export type BrandPageListItem = {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_status: 'active' | 'inactive';
  brand_deleted_at: string | null;
  brand_logo_file_id: string | null;
  brand_website_url: string | null;
  page_id: string | null;
  title: string | null;
  review_status: string | null;
  publish_status: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  active_product_group_count: number;
  pinned_product_count: number;
  missing_source_stat_count: number;
};

export type BrandPageDetail = {
  brand_page: RecordMap;
  brand: RecordMap;
  stats: RecordMap[];
  sources: RecordMap[];
  featured_product_groups: RecordMap[];
  dependency_counts: RecordMap;
};

export type BrandPageForm = {
  brand_id: string;
  title: string;
  excerpt: string;
  overview_title: string;
  overview_body: string;
  hero_banner_id: string;
  hero_title_size: 'medium' | 'large' | 'xlarge';
  hero_excerpt_size: 'medium' | 'large';
  hero_eyebrow_color: string;
  hero_title_color: string;
  hero_excerpt_color: string;
  accent_color: string;
  layout_archetype: 'auto' | 'international' | 'domestic' | 'minimal';
  support_title: string;
  support_intro: string;
  support_items: SupportItem[];
  support_image_file_id: string;
  stats: StatItem[];
  sources: SourceItem[];
  featured_product_group_ids: string[];
  cta_title: string;
  cta_description: string;
  cta_button_label: string;
  cta_button_url: string;
  review_status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  publish_status: 'unpublished' | 'published' | 'archived';
  seo_title: string;
  seo_description: string;
  seo_og_image_file_id: string;
};

export type SupportItem = { title: string; description: string };

export type StatItem = {
  value: string;
  label: string;
  note: string;
  source_url: string;
  source_file_id: string;
  is_verified: boolean;
  status: 'active' | 'inactive';
};

export type SourceItem = {
  title: string;
  source_type: 'website' | 'catalogue' | 'certificate' | 'other';
  url: string;
  file_id: string;
  description: string;
  status: 'active' | 'inactive';
};

export type ReferenceState = {
  loading: boolean;
  brands: RecordMap[];
  banners: RecordMap[];
  products: RecordMap[];
};

export type ProductBrowserState = {
  loading: boolean;
  items: RecordMap[];
  suggestions: RecordMap[];
  publicTotal: number;
  page: number;
  pageCount: number;
  total: number;
};

export const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export const BRAND_PAGE_PREVIEW_ROUTE = `${PUBLIC_SITE_BASE_URL}/admin-preview/brand-page`;

export const BRAND_PAGE_PREVIEW_MESSAGE_TYPE = 'song-thanh:brand-page-preview';

export const BRAND_PAGE_PREVIEW_READY_MESSAGE_TYPE = 'song-thanh:brand-page-preview:ready';

export const BRAND_HERO_BANNER_POSITION = 'brand-hero';

export const PRODUCT_BROWSER_PAGE_SIZE = 12;

export type SectionId =
  | 'section-hero'
  | 'section-overview'
  | 'section-stats'
  | 'section-support'
  | 'section-products'
  | 'section-sources'
  | 'section-cta'
  | 'section-seo';

export const SECTIONS: ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: ComponentType<{ className?: string }>;
  activeClass: string;
}> = [
  { id: 'section-hero', label: 'Nhận diện', icon: Sparkles, activeClass: 'border-primary bg-primarySoft text-primaryStrong' },
  { id: 'section-overview', label: 'Giới thiệu', icon: BookOpen, activeClass: 'border-primary bg-primarySoft text-primaryStrong' },
  { id: 'section-products', label: 'Sản phẩm & tài liệu', icon: Boxes, activeClass: 'border-primary bg-primarySoft text-primaryStrong' },
  { id: 'section-seo', label: 'Xuất bản', icon: Search, activeClass: 'border-primary bg-primarySoft text-primaryStrong' }
];

export function workspaceForSection(sectionId: SectionId): SectionId {
  if (sectionId === 'section-stats' || sectionId === 'section-support') {
    return 'section-overview';
  }
  if (sectionId === 'section-sources') {
    return 'section-products';
  }
  if (sectionId === 'section-cta') {
    return 'section-seo';
  }
  return sectionId;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);
  return authState;
}
