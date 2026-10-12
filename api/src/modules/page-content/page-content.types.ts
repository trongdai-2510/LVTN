export const PAGE_CONTENT_TABLE = 'page_content';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';

export const PAGE_CONTENT_FILE_USAGE_ENTITY_TYPE = 'page_content';
export const PAGE_CONTENT_FEATURED_IMAGE_FIELD_NAME = 'featured_image_file_id';
export const PAGE_CONTENT_OG_IMAGE_FIELD_NAME = 'seo_og_image_file_id';
export const PAGE_CONTENT_CONTENT_HTML_FIELD_NAME = 'content_html';
export const PAGE_CONTENT_EXTRA_BLOCK_FIELD_PREFIX = 'extra_blocks.';

export const PAGE_CONTENT_REVIEW_STATUSES = ['draft', 'pending_review', 'approved', 'rejected'] as const;
export const PAGE_CONTENT_PUBLISH_STATUSES = ['unpublished', 'published', 'archived'] as const;
export const PAGE_CONTENT_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const PAGE_CONTENT_TYPES = ['page', 'news'] as const;

export type PageContentReviewStatus = (typeof PAGE_CONTENT_REVIEW_STATUSES)[number];
export type PageContentPublishStatus = (typeof PAGE_CONTENT_PUBLISH_STATUSES)[number];
export type PageContentDeletedScope = (typeof PAGE_CONTENT_DELETED_SCOPES)[number];
export type PageContentType = (typeof PAGE_CONTENT_TYPES)[number];

/**
 * Khối phụ admin tự quản lý — render trên trang website giữa body và CTA cuối.
 * Schema được validate ở app layer (page-content.guardrails.ts), DB chỉ lưu JSONB raw.
 *
 * Block types hiện hỗ trợ:
 *   - bullet_list: { title?, items: [{ text, link? }] }
 *   - card_grid:   { title?, columns?: 2|3|4, items: [{ title, description?, link? }] }
 *
 * Link shape (optional trên mọi item): { label?: string, target: string }
 */
export interface ExtraBlocksPayload {
  blocks: ExtraBlockItem[];
  layout?: PageContentLayout | null;
}

export interface PageContentLayout {
  sections: PageContentLayoutSection[];
}

interface PageContentLayoutSection {
  id: string;
  visible: boolean;
}

export type ExtraBlockItem = BulletListBlock | CardGridBlock | ImageCardBlock;

export type ImageCardTone = 'positive' | 'negative' | 'neutral';

interface BulletListBlock {
  id: string;
  type: 'bullet_list';
  title?: string | null;
  items: Array<{
    text: string;
    link?: { label?: string | null; target: string } | null;
  }>;
}

interface CardGridBlock {
  id: string;
  type: 'card_grid';
  title?: string | null;
  columns?: 2 | 3 | 4;
  items: Array<{
    title: string;
    description?: string | null;
    link?: { label?: string | null; target: string } | null;
  }>;
}

/**
 * Khối ảnh + nội dung. Dùng cho các trang cần nhiều ảnh điều khiển từ admin
 * (vd: trang Bảo hành — Eligible/Ineligible comparison). Tone xác định màu accent.
 * - slot_key (optional): cho phép frontend đọc theo key có nghĩa (vd: "eligible",
 *   "ineligible") thay vì theo thứ tự — robust khi admin reorder/insert blocks.
 */
interface ImageCardBlock {
  id: string;
  type: 'image_card';
  title?: string | null;
  description?: string | null;
  image_file_id: string;
  tone?: ImageCardTone;
  slot_key?: string | null;
  link?: { label?: string | null; target: string } | null;
}

export interface PageContentRecord {
  id: string;
  title: string;
  slug: string;
  content_type: PageContentType;
  excerpt: string | null;
  content_html: string | null;
  featured_image_file_id: string | null;
  review_status: PageContentReviewStatus;
  publish_status: PageContentPublishStatus;
  seo_title: string | null;
  seo_description: string | null;
  seo_og_image_file_id: string | null;
  news_category_id: string | null;
  published_at: Date | null;
  is_featured: boolean;
  extra_blocks: ExtraBlocksPayload;
  created_by: number | null;
  updated_by: number | null;
  approved_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type PageContentListItem = Pick<
  PageContentRecord,
  | 'id'
  | 'title'
  | 'slug'
  | 'content_type'
  | 'excerpt'
  | 'featured_image_file_id'
  | 'review_status'
  | 'publish_status'
  | 'news_category_id'
  | 'published_at'
  | 'is_featured'
  | 'updated_by'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
> & {
  has_meaningful_body: boolean;
  has_seo_description: boolean;
  has_seo_title: boolean;
};

export interface PageContentMutationInput {
  title?: string;
  slug?: string;
  content_type?: PageContentType;
  excerpt?: string | null;
  content_html?: string | null;
  featured_image_file_id?: string | null;
  review_status?: PageContentReviewStatus;
  publish_status?: PageContentPublishStatus;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_og_image_file_id?: string | null;
  news_category_id?: string | null;
  published_at?: Date | string | null;
  is_featured?: boolean;
  extra_blocks?: ExtraBlocksPayload;
}
