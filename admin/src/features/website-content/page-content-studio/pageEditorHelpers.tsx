import { getTemplateBlocks, type PageContentTemplate } from './pageContentTemplates';
import {
  type PageTemplateZone,
  type RecordMap,
  type PageContentPreviewDraft,
  type PageReviewStatus,
  type PagePublishStatus,
  type PageWorkflowAction
} from './pageEditorShared';

export function getTemplateZones(template: PageContentTemplate): PageTemplateZone[] {
  const templateBlocks = getTemplateBlocks(template);
  if (templateBlocks.length > 0) {
    return templateBlocks.map((block) => ({
      label: block.title,
      owner: block.ownerLabel,
      href: block.href,
      // The fixed-component card owns the detailed template guidance. Keeping
      // it out of the source map avoids showing the same help text twice.
      description: block.owner === 'template' ? undefined : block.description,
      badge:
        block.owner === 'this_page'
          ? 'Tại đây'
          : block.owner === 'template'
            ? block.ownerLabel === 'Website public'
              ? 'Public'
              : 'Mẫu'
            : undefined,
      tone:
        block.owner === 'this_page'
          ? 'active'
          : block.owner === 'template'
            ? 'info'
            : 'default'
    }));
  }

  const ownIntro = { label: 'Tiêu đề và mô tả', owner: 'Sửa tại màn này' };
  const ownImage = { label: template.imageLabel, owner: 'Sửa tại màn này' };

  if (template.mode === 'about') {
    return [
      { label: 'Hero', owner: 'Sửa ở Banner', href: '/banners' },
      ownIntro,
      { label: 'Nội dung công ty', owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Thông tin liên hệ', owner: 'Sửa ở Cấu hình website', href: '/website-settings' },
      { label: 'Thương hiệu', owner: 'Sửa ở Thương hiệu', href: '/brands' }
    ];
  }
  if (template.mode === 'services') {
    return [
      { label: 'Hero', owner: 'Sửa ở Banner', href: '/banners?position=dich-vu' },
      ownIntro,
      { label: 'Lời giới thiệu', owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Danh sách dịch vụ', owner: 'Sửa ở Dịch vụ', href: '/services' },
      { label: 'CTA liên hệ', owner: 'Sửa ở Cấu hình website', href: '/website-settings' }
    ];
  }
  if (template.mode === 'projects') {
    return [
      ownIntro,
      { label: 'Lời dẫn', owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Danh sách dự án', owner: 'Sửa ở Dự án', href: '/projects' }
    ];
  }
  if (template.mode === 'brands') {
    return [
      ownIntro,
      { label: template.bodyLabel, owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Logo và trạng thái', owner: 'Sửa ở Thương hiệu', href: '/brands' }
    ];
  }
  if (template.mode === 'contact') {
    return [
      { label: 'Hero', owner: 'Sửa ở Banner', href: '/banners?position=lien-he' },
      ownIntro,
      { label: template.bodyLabel, owner: 'Sửa tại màn này' },
      ownImage,
      { label: 'Hotline, email, địa chỉ', owner: 'Sửa ở Cấu hình website', href: '/website-settings' },
      { label: 'Form khách gửi', owner: 'Xem ở Yêu cầu liên hệ', href: '/contacts' }
    ];
  }
  return [
    ownIntro,
    { label: template.bodyLabel, owner: 'Trang này' },
    ownImage
  ];
}

export function extractPublicItems(data: unknown): RecordMap[] {
  if (!data || typeof data !== 'object') return [];
  const items = (data as RecordMap).items;
  return Array.isArray(items) ? (items as RecordMap[]) : [];
}

export function extractPublicTotal(data: unknown): number {
  const items = extractPublicItems(data);
  if (!data || typeof data !== 'object') return items.length;
  const pagination = (data as RecordMap).pagination;
  if (!pagination || typeof pagination !== 'object') return items.length;
  const total = (pagination as RecordMap).total;
  return typeof total === 'number' && Number.isSafeInteger(total) && total >= 0
    ? total
    : items.length;
}

export function extractCompanyInfo(data: unknown): RecordMap | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as RecordMap;
  const companyInfo = record.company_info ?? record.settings;
  return companyInfo && typeof companyInfo === 'object' && !Array.isArray(companyInfo)
    ? (companyInfo as RecordMap)
    : null;
}

export function getText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

export function toDateTimeLocalValue(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') {
    return '';
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 16);
    }
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
  } catch {
    return value.slice(0, 16);
  }
}

export function buildPreviewDraft(
  form: Record<string, string>,
  record: RecordMap,
  template: PageContentTemplate,
  publicPath: string
): PageContentPreviewDraft {
  const featuredImageId = getText(form.featured_image_file_id);
  const contentType = (form.content_type || template.contentType) === 'news' ? 'news' : 'page';
  const now = new Date().toISOString();

  return {
    id: getText(record.id) || 'preview',
    title: getText(form.title) || template.shortLabel,
    slug: getText(form.slug),
    content_type: contentType,
    excerpt: getText(form.excerpt) || null,
    content_html: form.content_html?.trim() ? form.content_html : null,
    featured_image_file_id: featuredImageId || null,
    featured_image: featuredImageId
      ? {
          id: featuredImageId,
          original_filename: 'Preview image',
          mime_type: 'image/*',
          url: `/public/files/${encodeURIComponent(featuredImageId)}`
        }
      : null,
    seo_title: getText(form.seo_title) || null,
    seo_description: getText(form.seo_description) || null,
    extra_blocks: parsePreviewExtraBlocks(form.extra_blocks),
    published_at: getText(form.published_at) || null,
    created_at: getText(record.created_at) || now,
    updated_at: getText(record.updated_at) || now,
    preview_mode: template.mode,
    public_path: publicPath
  };
}

function parsePreviewExtraBlocks(value: string | undefined): PageContentPreviewDraft['extra_blocks'] {
  if (!value) return { blocks: [], layout: null };
  try {
    const parsed = JSON.parse(value) as {
      blocks?: unknown;
      layout?: { sections?: unknown };
    };
    const sections = Array.isArray(parsed?.layout?.sections)
      ? parsed.layout.sections
          .filter(
            (entry): entry is Record<string, unknown> =>
              Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
          )
          .map((entry) => ({
            id: typeof entry.id === 'string' ? entry.id : '',
            visible: entry.visible !== false
          }))
          .filter((entry) => Boolean(entry.id))
      : [];
    return {
      blocks: Array.isArray(parsed?.blocks) ? parsed.blocks : [],
      layout: sections.length > 0 ? { sections } : null
    };
  } catch {
    return { blocks: [], layout: null };
  }
}

export function toPageReviewStatus(value: string | undefined): PageReviewStatus {
  if (value === 'pending_review' || value === 'approved' || value === 'rejected') {
    return value;
  }
  return 'draft';
}

export function toPagePublishStatus(value: string | undefined): PagePublishStatus {
  if (value === 'published' || value === 'archived') return value;
  return 'unpublished';
}

export function applyPageWorkflowAction(
  current: Record<string, string>,
  action: PageWorkflowAction
): Record<string, string> {
  switch (action) {
    case 'submit_review':
      return { ...current, review_status: 'pending_review', publish_status: 'unpublished' };
    case 'reject':
      return { ...current, review_status: 'rejected', publish_status: 'unpublished' };
    case 'publish':
      return { ...current, review_status: 'approved', publish_status: 'published' };
    case 'unpublish':
      return { ...current, publish_status: 'unpublished' };
  }
}
