import type React from 'react';
import { Badge } from '@/components/ui/Badge';
import { type PageContentTemplate } from './pageContentTemplates';

export type RecordMap = Record<string, unknown>;

export type FormErrors = Record<string, string>;

export type ContentPendingAction = {
  action: 'archive' | 'restore';
};

export type PageReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export type PagePublishStatus = 'unpublished' | 'published' | 'archived';

export type PageWorkflowAction = 'submit_review' | 'reject' | 'publish' | 'unpublish';

export type PageSnapshotState = {
  loading: boolean;
  error: string;
  companyInfo: RecordMap | null;
  banners: RecordMap[];
  productBanners: RecordMap[];
  capabilityBanners: RecordMap[];
  serviceBanners: RecordMap[];
  projectBanners: RecordMap[];
  brandBanners: RecordMap[];
  contactBanners: RecordMap[];
  newsBanners: RecordMap[];
  brands: RecordMap[];
  productCategories: RecordMap[];
  productGroups: RecordMap[];
  services: RecordMap[];
  projects: RecordMap[];
  brandCount: number;
  productCategoryCount: number;
  productGroupCount: number;
  serviceCount: number;
  projectCount: number;
};

export type PageTemplateZone = {
  label: string;
  owner: string;
  href?: string;
  badge?: string;
  tone?: React.ComponentProps<typeof Badge>['tone'];
  description?: string;
};

export type PageContentPreviewDraft = {
  id: string;
  title: string;
  slug: string;
  content_type: 'page' | 'news';
  excerpt: string | null;
  content_html: string | null;
  featured_image_file_id: string | null;
  featured_image: {
    id: string;
    original_filename: string;
    mime_type: string;
    url: string;
  } | null;
  seo_title: string | null;
  seo_description: string | null;
  extra_blocks: {
    blocks: unknown[];
    layout: { sections: Array<{ id: string; visible: boolean }> } | null;
  };
  published_at: string | null;
  created_at: string;
  updated_at: string;
  preview_mode: PageContentTemplate['mode'];
  public_path: string;
};

export const FORM_ID = 'page-content-editor-form';

export const PUBLIC_SITE_BASE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export const PAGE_CONTENT_PREVIEW_ROUTE = `${PUBLIC_SITE_BASE_URL}/admin-preview/page-content`;

export const PAGE_CONTENT_PREVIEW_MESSAGE_TYPE = 'song-thanh:page-content-preview';

export const PAGE_CONTENT_PREVIEW_READY_MESSAGE_TYPE = 'song-thanh:page-content-preview:ready';

export const EDITOR_TARGET_EVENT = 'songthanh:editor-target';

export const FIELD_TARGETS: Record<string, string> = {
  title: '#page-content-title',
  slug: '#page-content-slug',
  excerpt: '#page-content-excerpt',
  content_html: '#page-section-body',
  featured_image_file_id: '#page-section-media',
  extra_blocks: '#page-section-blocks',
  seo_title: '#page-content-seo-title',
  seo_description: '#page-content-seo-description',
  seo_og_image_file_id: '#page-section-seo',
  news_category_id: '#page-content-news-category',
  published_at: '#page-content-published-at'
};

export function revealEditorTarget(target: string) {
  if (typeof document === 'undefined') return;
  const selector = target === 'form' ? `#${FORM_ID}` : target;
  const reveal = () => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return false;
    document
      .querySelectorAll<HTMLElement>('[data-editor-attention="true"]')
      .forEach((current) => current.removeAttribute('data-editor-attention'));
    const attentionTarget =
      element.closest<HTMLElement>('[data-field]') ??
      element.closest<HTMLElement>('[data-editor-section]') ??
      element;
    const scrollTarget =
      element.closest<HTMLElement>('[data-editor-section]') ?? attentionTarget;
    attentionTarget.setAttribute('data-editor-attention', 'true');
    const commandBar = document.querySelector<HTMLElement>('[data-page-commandbar="true"]');
    const sectionNav = document.querySelector<HTMLElement>('[data-page-editor-sections="true"]');
    const topbarHeight = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--topbar-height')
    ) || 64;
    const stickyOffset =
      window.innerWidth >= 1024
        ? (commandBar?.offsetHeight ?? 0) + 16
        : (sectionNav?.offsetHeight ?? 0) + 16;
    const nextScrollTop =
      window.scrollY + scrollTarget.getBoundingClientRect().top - topbarHeight - stickyOffset;
    window.scrollTo({ top: Math.max(0, nextScrollTop), behavior: 'auto' });
    const focusTarget = element.matches('input, textarea, select, button, [contenteditable="true"]')
      ? element
      : element.querySelector<HTMLElement>('[contenteditable="true"]') ??
        element.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])'
        );
    window.setTimeout(() => {
      focusTarget?.focus({ preventScroll: true });
    }, 250);
    window.setTimeout(() => attentionTarget.removeAttribute('data-editor-attention'), 2600);
    window.dispatchEvent(new CustomEvent(EDITOR_TARGET_EVENT, { detail: { target: selector } }));
    window.history.replaceState(null, '', selector);
    return true;
  };

  if (reveal()) return;
  if (selector.startsWith('#page-content-seo-')) {
    const seoToggle = document.querySelector<HTMLButtonElement>('#page-section-seo > button');
    if (seoToggle?.getAttribute('aria-expanded') === 'false') seoToggle.click();
    window.setTimeout(reveal, 80);
  }
}
