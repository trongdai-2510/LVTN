'use client';

import {
  type BrandPageListItem,
  type BrandPageForm,
  type BrandPageDetail,
  type SupportItem,
  type RecordMap,
  BRAND_HERO_BANNER_POSITION,
  type StatItem,
  type SourceItem,
  type SectionId
} from './brandPageShared';

export function derivePageStatus(item: BrandPageListItem): { label: string; tone: 'success' | 'warning' | 'danger' | 'default' } {
  if (!item.page_id) return { label: 'Chưa có nội dung', tone: 'warning' };
  if (item.deleted_at) return { label: 'Lưu trữ', tone: 'default' };
  if (item.publish_status === 'published') return { label: 'Đã xuất bản', tone: 'success' };
  if (item.review_status === 'approved') return { label: 'Đã duyệt, chưa xuất bản', tone: 'warning' };
  return { label: 'Nháp', tone: 'warning' };
}

export function defaultForm(brandId?: string): BrandPageForm {
  return {
    brand_id: brandId ?? '',
    title: '',
    excerpt: '',
    overview_title: 'Tổng quan thương hiệu',
    overview_body: '',
    hero_banner_id: '',
    hero_title_size: 'large',
    hero_excerpt_size: 'large',
    hero_eyebrow_color: '#004AB4',
    hero_title_color: '#0B1C30',
    hero_excerpt_color: '#334155',
    accent_color: '',
    layout_archetype: 'auto',
    support_title: 'Song Thanh hỗ trợ sản phẩm như thế nào',
    support_intro: '',
    support_items: [
      { title: 'Tra cứu mã hàng', description: 'Hỗ trợ kiểm tra thông tin sản phẩm theo nhu cầu thực tế.' },
      { title: 'Tư vấn nhóm sản phẩm', description: 'Gợi ý nhóm sản phẩm phù hợp theo hạng mục sử dụng.' },
      { title: 'Báo giá theo nhu cầu', description: 'Tiếp nhận danh mục và phản hồi theo dữ liệu đang có.' }
    ],
    support_image_file_id: '',
    stats: [],
    sources: [],
    featured_product_group_ids: [],
    cta_title: 'Cần báo giá sản phẩm?',
    cta_description: 'Đội ngũ Song Thanh hỗ trợ kiểm tra mã hàng và tư vấn nhóm sản phẩm phù hợp.',
    cta_button_label: 'Liên hệ nhận báo giá',
    cta_button_url: '/lien-he',
    review_status: 'draft',
    publish_status: 'unpublished',
    seo_title: '',
    seo_description: '',
    seo_og_image_file_id: ''
  };
}

export function detailToForm(detail: BrandPageDetail): BrandPageForm {
  const page = detail.brand_page;
  return {
    ...defaultForm(String(page.brand_id ?? '')),
    brand_id: String(page.brand_id ?? ''),
    title: String(page.title ?? ''),
    excerpt: String(page.excerpt ?? ''),
    overview_title: String(page.overview_title ?? ''),
    overview_body: String(page.overview_body ?? ''),
    hero_banner_id: String(page.hero_banner_id ?? ''),
    hero_title_size: normalizeHeroTitleSize(String(page.hero_title_size ?? 'large')),
    hero_excerpt_size: normalizeHeroExcerptSize(String(page.hero_excerpt_size ?? 'large')),
    hero_eyebrow_color: normalizeLegacyHeroColor(String(page.hero_eyebrow_color ?? ''), '#DBEAFE', '#004AB4'),
    hero_title_color: normalizeLegacyHeroColor(String(page.hero_title_color ?? ''), '#F8FAFC', '#0B1C30'),
    hero_excerpt_color: normalizeLegacyHeroColor(String(page.hero_excerpt_color ?? ''), '#F1F5F9', '#334155'),
    accent_color: (page as { accent_color?: unknown }).accent_color
      ? normalizeHexColor(String((page as { accent_color?: unknown }).accent_color), '#2563EB')
      : '',
    layout_archetype: normalizeLayoutArchetype(String((page as { layout_archetype?: unknown }).layout_archetype ?? 'auto')),
    support_title: String(page.support_title ?? ''),
    support_intro: String(page.support_intro ?? ''),
    support_items: Array.isArray(page.support_items) ? page.support_items as SupportItem[] : [],
    support_image_file_id: String(page.support_image_file_id ?? ''),
    stats: detail.stats.map((item) => ({
      value: String(item.value ?? ''),
      label: String(item.label ?? ''),
      note: String(item.note ?? ''),
      source_url: String(item.source_url ?? ''),
      source_file_id: String(item.source_file_id ?? ''),
      is_verified: Boolean(item.is_verified),
      status: item.status === 'inactive' ? 'inactive' : 'active'
    })),
    sources: detail.sources.map((item) => ({
      title: String(item.title ?? ''),
      source_type: normalizeSourceType(String(item.source_type ?? 'other')),
      url: String(item.url ?? ''),
      file_id: String(item.file_id ?? ''),
      description: String(item.description ?? ''),
      status: item.status === 'inactive' ? 'inactive' : 'active'
    })),
    featured_product_group_ids: detail.featured_product_groups.map((item) => String(item.product_group_id ?? '')).filter(Boolean),
    cta_title: String(page.cta_title ?? ''),
    cta_description: String(page.cta_description ?? ''),
    cta_button_label: String(page.cta_button_label ?? ''),
    cta_button_url: String(page.cta_button_url ?? ''),
    review_status: page.review_status === 'approved' || page.review_status === 'pending_review' || page.review_status === 'rejected' ? page.review_status : 'draft',
    publish_status: page.publish_status === 'published' || page.publish_status === 'archived' ? page.publish_status : 'unpublished',
    seo_title: String(page.seo_title ?? ''),
    seo_description: String(page.seo_description ?? ''),
    seo_og_image_file_id: String(page.seo_og_image_file_id ?? '')
  };
}

export function formToPayload(form: BrandPageForm, titleFallback = '', canPrivilegedWorkflow = true) {
  return {
    brand_id: form.brand_id,
    title: form.title.trim() || titleFallback,
    excerpt: nullable(form.excerpt),
    overview_title: nullable(form.overview_title),
    overview_body: nullable(form.overview_body),
    hero_banner_id: nullable(form.hero_banner_id),
    hero_title_size: form.hero_title_size,
    hero_excerpt_size: form.hero_excerpt_size,
    hero_eyebrow_color: nullable(normalizeHexColor(form.hero_eyebrow_color, '#004AB4')),
    hero_title_color: nullable(normalizeHexColor(form.hero_title_color, '#0B1C30')),
    hero_excerpt_color: nullable(normalizeHexColor(form.hero_excerpt_color, '#334155')),
    accent_color: form.accent_color.trim() ? normalizeHexColor(form.accent_color, '#2563EB') : null,
    layout_archetype: form.layout_archetype,
    support_title: nullable(form.support_title),
    support_intro: nullable(form.support_intro),
    support_items: form.support_items.filter((item) => item.title.trim() || item.description.trim()),
    support_image_file_id: nullable(form.support_image_file_id),
    stats: form.stats
      .filter((item) => item.value.trim() || item.label.trim())
      .map((item, index) => ({ ...item, source_url: nullable(item.source_url), source_file_id: nullable(item.source_file_id), sort_order: index })),
    sources: form.sources
      .filter((item) => item.title.trim() && (item.url.trim() || item.file_id.trim()))
      .map((item, index) => ({ ...item, url: nullable(item.url), file_id: nullable(item.file_id), description: nullable(item.description), sort_order: index })),
    featured_product_group_ids: form.featured_product_group_ids,
    cta_title: nullable(form.cta_title),
    cta_description: nullable(form.cta_description),
    cta_button_label: nullable(form.cta_button_label),
    cta_button_url: nullable(form.cta_button_url),
    ...(canPrivilegedWorkflow ? { review_status: form.review_status, publish_status: form.publish_status } : {}),
    seo_title: nullable(form.seo_title),
    seo_description: nullable(form.seo_description),
    seo_og_image_file_id: nullable(form.seo_og_image_file_id)
  };
}

export function buildBrandPagePreviewDraft(
  form: BrandPageForm,
  brand: RecordMap | null,
  banners: RecordMap[],
  products: RecordMap[],
  record: BrandPageDetail | null,
  previewFileUrls: Record<string, string>
): RecordMap {
  const safeBrand = brand ?? {};
  const selectedBanner = banners.find((item) => String(item.id ?? '') === form.hero_banner_id);
  const selectedProducts = form.featured_product_group_ids
    .map((idValue) => products.find((item) => String(item.id ?? '') === idValue))
    .filter((item): item is RecordMap => Boolean(item))
    .filter((item) => item.status === 'active' && item.review_status === 'approved' && item.publish_status === 'published');

  return {
    brand: {
      id: String(safeBrand.id ?? form.brand_id ?? 'preview-brand'),
      name: String(safeBrand.name ?? 'Thương hiệu'),
      slug: String(safeBrand.slug ?? 'preview'),
      description: nullableTextFromUnknown(safeBrand.description),
      website_url: nullableTextFromUnknown(safeBrand.website_url),
      logo_file_id: nullableTextFromUnknown(safeBrand.logo_file_id),
      logo_file: previewFile(nullableTextFromUnknown(safeBrand.logo_file_id), 'Logo thương hiệu', previewFileUrls)
    },
    brand_page: {
      id: String(record?.brand_page?.id ?? 'preview-brand-page'),
      brand_id: form.brand_id || String(safeBrand.id ?? 'preview-brand'),
      title: form.title.trim() || String(safeBrand.name ?? 'Trang thương hiệu'),
      excerpt: nullable(form.excerpt),
      overview_title: nullable(form.overview_title),
      overview_body: nullable(form.overview_body),
      support_title: nullable(form.support_title),
      support_intro: nullable(form.support_intro),
      support_items: form.support_items.filter((item) => item.title.trim() || item.description.trim()),
      support_image_file_id: nullable(form.support_image_file_id),
      support_image_file: previewFile(nullable(form.support_image_file_id), 'Ảnh minh họa', previewFileUrls),
      hero_title_size: form.hero_title_size,
      hero_excerpt_size: form.hero_excerpt_size,
      hero_eyebrow_color: normalizeHexColor(form.hero_eyebrow_color, '#004AB4'),
      hero_title_color: normalizeHexColor(form.hero_title_color, '#0B1C30'),
      hero_excerpt_color: normalizeHexColor(form.hero_excerpt_color, '#334155'),
      accent_color: form.accent_color.trim() ? normalizeHexColor(form.accent_color, '#2563EB') : null,
      layout_archetype: form.layout_archetype,
      cta_title: nullable(form.cta_title),
      cta_description: nullable(form.cta_description),
      cta_button_label: nullable(form.cta_button_label),
      cta_button_url: nullable(form.cta_button_url),
      seo_title: nullable(form.seo_title),
      seo_description: nullable(form.seo_description),
      seo_og_image_file_id: nullable(form.seo_og_image_file_id),
      seo_og_image_file: previewFile(nullable(form.seo_og_image_file_id), 'Ảnh chia sẻ', previewFileUrls)
    },
    hero_banner: selectedBanner
      ? {
          id: String(selectedBanner.id ?? form.hero_banner_id),
          position: String(selectedBanner.position ?? BRAND_HERO_BANNER_POSITION),
          title: String(selectedBanner.title ?? form.title ?? ''),
          description: nullableTextFromUnknown(selectedBanner.description),
          display_mode: selectedBanner.display_mode === 'image_only' ? 'image_only' : 'content_overlay',
          image_file_id: String(selectedBanner.image_file_id ?? ''),
          image_file: previewFile(nullableTextFromUnknown(selectedBanner.image_file_id), 'Ảnh banner', previewFileUrls),
          image_mobile_file_id: nullableTextFromUnknown(selectedBanner.image_mobile_file_id),
          image_mobile_file: previewFile(nullableTextFromUnknown(selectedBanner.image_mobile_file_id), 'Ảnh banner mobile', previewFileUrls),
          link_type: normalizeBannerLinkType(selectedBanner.link_type),
          link_target: nullableTextFromUnknown(selectedBanner.link_target),
          cta_buttons: Array.isArray(selectedBanner.cta_buttons) ? selectedBanner.cta_buttons : null
        }
      : null,
    verified_stats: form.stats
      .filter((item) => item.status === 'active' && item.value.trim() && item.label.trim() && hasUsableStatSource(item))
      .map((item, index) => ({
        id: `preview-stat-${index}`,
        value: item.value.trim(),
        label: item.label.trim(),
        note: nullable(item.note),
        sort_order: index
      })),
    derived_categories: [],
    pinned_products: selectedProducts.map((product, index) => ({
      id: String(product.id ?? `preview-product-${index}`),
      name: String(product.name ?? ''),
      slug: String(product.slug ?? ''),
      category_id: String(product.category_id ?? ''),
      category_name: nullableTextFromUnknown(product.category_name),
      category_level_1_id: nullableTextFromUnknown(product.category_level_1_id),
      category_level_1_name: nullableTextFromUnknown(product.category_level_1_name),
      category_level_2_id: nullableTextFromUnknown(product.category_level_2_id),
      category_level_2_name: nullableTextFromUnknown(product.category_level_2_name),
      brand_id: form.brand_id || nullableTextFromUnknown(product.brand_id),
      brand_slug: nullableTextFromUnknown(safeBrand.slug) ?? nullableTextFromUnknown(product.brand_slug),
      brand_name: nullableTextFromUnknown(safeBrand.name) ?? nullableTextFromUnknown(product.brand_name),
      short_description: nullableTextFromUnknown(product.short_description),
      detailed_description: nullableTextFromUnknown(product.detailed_description),
      thumbnail_file_id: nullableTextFromUnknown(product.thumbnail_file_id),
      thumbnail_file: previewFile(nullableTextFromUnknown(product.thumbnail_file_id), 'Ảnh sản phẩm', previewFileUrls),
      review_status: 'approved',
      publish_status: 'published',
      status: 'active',
      sort_order: Number(product.sort_order ?? index),
      variant_count: Number(product.variant_count ?? 0),
      document_count: Number(product.document_count ?? 0)
    })),
    sources: form.sources
      .filter((item) => item.status === 'active' && item.title.trim() && (item.url.trim() || item.file_id.trim()))
      .map((item, index) => ({
        id: `preview-source-${index}`,
        title: item.title.trim(),
        source_type: item.source_type,
        url: nullable(item.url),
        file_id: nullable(item.file_id),
        file: previewFile(nullable(item.file_id), 'Tệp nguồn', previewFileUrls),
        description: nullable(item.description),
        sort_order: index
      }))
  };
}

export function emptyStat(): StatItem {
  return { value: '', label: '', note: '', source_url: '', source_file_id: '', is_verified: false, status: 'active' };
}

export function emptySource(): SourceItem {
  return { title: '', source_type: 'website', url: '', file_id: '', description: '', status: 'active' };
}

function normalizeSourceType(value: string): SourceItem['source_type'] {
  return value === 'website' || value === 'catalogue' || value === 'certificate' || value === 'other'
    ? value
    : 'other';
}

export function normalizeHeroTitleSize(value: string): BrandPageForm['hero_title_size'] {
  return value === 'medium' || value === 'large' || value === 'xlarge' ? value : 'large';
}

export function normalizeHeroExcerptSize(value: string): BrandPageForm['hero_excerpt_size'] {
  return value === 'medium' || value === 'large' ? value : 'large';
}

export function normalizeLayoutArchetype(value: string): BrandPageForm['layout_archetype'] {
  return value === 'international' || value === 'domestic' || value === 'minimal' ? value : 'auto';
}

export function normalizeHexColor(value: string, fallback: string) {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function normalizeLegacyHeroColor(value: string, previousDefault: string, currentDefault: string) {
  const normalized = normalizeHexColor(value, currentDefault);
  return normalized === previousDefault ? currentDefault : normalized;
}

function nullable(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function nullableTextFromUnknown(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function previewFile(id: string | null, label: string, previewFileUrls: Record<string, string>) {
  const url = id ? previewFileUrls[id] : null;
  return id && url
    ? {
        id,
        original_filename: label,
        mime_type: 'image/*',
        url
      }
    : null;
}

function normalizeBannerLinkType(value: unknown): 'internal' | 'external' | 'anchor' | 'none' {
  return value === 'internal' || value === 'external' || value === 'anchor' || value === 'none'
    ? value
    : 'none';
}

export function collectBrandPagePreviewFileIds(
  form: BrandPageForm,
  brand: RecordMap | null,
  banners: RecordMap[],
  products: RecordMap[]
) {
  const selectedBanner = banners.find((item) => String(item.id ?? '') === form.hero_banner_id);
  const selectedProducts = form.featured_product_group_ids
    .map((idValue) => products.find((item) => String(item.id ?? '') === idValue))
    .filter((item): item is RecordMap => Boolean(item));

  return Array.from(
    new Set(
      [
        nullableTextFromUnknown(brand?.logo_file_id),
        nullable(form.support_image_file_id),
        nullable(form.seo_og_image_file_id),
        nullableTextFromUnknown(selectedBanner?.image_file_id),
        nullableTextFromUnknown(selectedBanner?.image_mobile_file_id),
        ...selectedProducts.map((item) => nullableTextFromUnknown(item.thumbnail_file_id)),
        ...form.sources.map((item) => nullable(item.file_id))
      ].filter((fileId): fileId is string => Boolean(fileId))
    )
  );
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function hasUsableStatSource(item: StatItem) {
  return item.is_verified && (item.source_url.trim() || item.source_file_id.trim());
}

export function buildReadiness(
  form: BrandPageForm,
  brand: RecordMap | null,
  products: RecordMap[],
  usesImageOnlyHero: boolean
) {
  const items = [
    {
      label: 'Đã chọn thương hiệu',
      ok: Boolean(form.brand_id && brand),
      target: 'section-hero' as SectionId
    },
    {
      label: usesImageOnlyHero ? 'Có banner chỉ ảnh' : 'Có tiêu đề ngoài website',
      ok: usesImageOnlyHero ? Boolean(form.hero_banner_id) : Boolean(form.title.trim()),
      target: 'section-hero' as SectionId
    },
    {
      label: 'Thương hiệu đang hoạt động',
      ok: brand ? brand.status === 'active' : false,
      target: 'section-hero' as SectionId
    }
  ];
  const warnings = [
    ...items.filter((item) => !item.ok).map((item) => item.label),
    ...form.stats.filter((stat) => stat.status === 'active' && !hasUsableStatSource(stat)).map((stat) => `${stat.label || stat.value || 'Thông tin'} thiếu nguồn`),
    ...form.featured_product_group_ids
      .filter((idValue) => {
        const product = products.find((item) => String(item.id) === idValue);
        return product && !(product.status === 'active' && product.review_status === 'approved' && product.publish_status === 'published');
      })
      .map(() => 'Sản phẩm ghim chưa đủ điều kiện hiển thị')
  ];
  return { items, warnings };
}

export type BrandPagePublicStatus = 'draft' | 'hidden' | 'published';

type BrandPageComposedStatus = BrandPagePublicStatus | 'archived';

export function composedBrandPageStatus(form: BrandPageForm, archived: boolean): BrandPageComposedStatus {
  if (archived) return 'archived';
  if (form.publish_status === 'published') return 'published';
  if (form.review_status === 'approved') return 'hidden';
  return 'draft';
}

export function applyBrandPagePublicStatus(next: BrandPagePublicStatus): Partial<BrandPageForm> {
  if (next === 'published') {
    return { review_status: 'approved', publish_status: 'published' };
  }
  if (next === 'hidden') {
    return { review_status: 'approved', publish_status: 'unpublished' };
  }
  return { review_status: 'draft', publish_status: 'unpublished' };
}

export function brandPageStatusLabel(status: BrandPageComposedStatus) {
  if (status === 'published') return 'Đã xuất bản';
  if (status === 'hidden') return 'Đã duyệt, đang ẩn';
  if (status === 'archived') return 'Đã lưu trữ';
  return 'Bản nháp';
}

export function brandPageStatusTone(status: BrandPageComposedStatus): 'default' | 'active' | 'inactive' | 'archived' | 'success' | 'warning' | 'info' | 'danger' {
  if (status === 'published') return 'success';
  if (status === 'hidden') return 'warning';
  if (status === 'archived') return 'archived';
  return 'inactive';
}
