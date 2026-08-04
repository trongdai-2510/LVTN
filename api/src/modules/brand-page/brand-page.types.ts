export const BRAND_PAGE_TABLE = 'brand_page';
export const BRAND_PAGE_STAT_TABLE = 'brand_page_stat';
export const BRAND_PAGE_SOURCE_TABLE = 'brand_page_source';
export const BRAND_PAGE_FEATURED_PRODUCT_GROUP_TABLE = 'brand_page_featured_product_group';

export const BRAND_TABLE = 'brand';
export const BANNER_TABLE = 'banner';
export const FILE_METADATA_TABLE = 'file_metadata';
export const PRODUCT_CATEGORY_TABLE = 'product_category';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const TECHNICAL_DOCUMENT_TABLE = 'technical_document';

export const BRAND_PAGE_REVIEW_STATUSES = ['draft', 'pending_review', 'approved', 'rejected'] as const;
export const BRAND_PAGE_PUBLISH_STATUSES = ['unpublished', 'published', 'archived'] as const;
export const BRAND_PAGE_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const BRAND_PAGE_SOURCE_TYPES = ['website', 'catalogue', 'certificate', 'other'] as const;
export const BRAND_PAGE_STAT_STATUSES = ['active', 'inactive'] as const;
export const BRAND_PAGE_HERO_TITLE_SIZES = ['medium', 'large', 'xlarge'] as const;
export const BRAND_PAGE_HERO_EXCERPT_SIZES = ['medium', 'large'] as const;
export const BRAND_PAGE_LAYOUT_ARCHETYPES = ['auto', 'international', 'domestic', 'minimal'] as const;

export type BrandPageReviewStatus = (typeof BRAND_PAGE_REVIEW_STATUSES)[number];
export type BrandPagePublishStatus = (typeof BRAND_PAGE_PUBLISH_STATUSES)[number];
export type BrandPageDeletedScope = (typeof BRAND_PAGE_DELETED_SCOPES)[number];
export type BrandPageSourceType = (typeof BRAND_PAGE_SOURCE_TYPES)[number];
export type BrandPageRowStatus = (typeof BRAND_PAGE_STAT_STATUSES)[number];
export type BrandPageHeroTitleSize = (typeof BRAND_PAGE_HERO_TITLE_SIZES)[number];
export type BrandPageHeroExcerptSize = (typeof BRAND_PAGE_HERO_EXCERPT_SIZES)[number];
export type BrandPageLayoutArchetype = (typeof BRAND_PAGE_LAYOUT_ARCHETYPES)[number];

export interface BrandPageRecord {
  id: string;
  brand_id: string;
  title: string;
  excerpt: string | null;
  overview_title: string | null;
  overview_body: string | null;
  support_title: string | null;
  support_intro: string | null;
  support_items: BrandPageSupportItem[] | null;
  support_image_file_id: string | null;
  hero_banner_id: string | null;
  hero_title_size: BrandPageHeroTitleSize;
  hero_excerpt_size: BrandPageHeroExcerptSize;
  hero_eyebrow_color: string | null;
  hero_title_color: string | null;
  hero_excerpt_color: string | null;
  accent_color: string | null;
  layout_archetype: BrandPageLayoutArchetype;
  cta_title: string | null;
  cta_description: string | null;
  cta_button_label: string | null;
  cta_button_url: string | null;
  review_status: BrandPageReviewStatus;
  publish_status: BrandPagePublishStatus;
  seo_title: string | null;
  seo_description: string | null;
  seo_og_image_file_id: string | null;
  created_by: number | null;
  updated_by: number | null;
  approved_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface BrandPageSupportItem {
  title: string;
  description: string;
}

export interface BrandPageStatRecord {
  id: string;
  brand_page_id: string;
  value: string;
  label: string;
  note: string | null;
  source_url: string | null;
  source_file_id: string | null;
  is_verified: boolean;
  sort_order: number;
  status: BrandPageRowStatus;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface BrandPageSourceRecord {
  id: string;
  brand_page_id: string;
  title: string;
  source_type: BrandPageSourceType;
  url: string | null;
  file_id: string | null;
  description: string | null;
  sort_order: number;
  status: BrandPageRowStatus;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface BrandPageFeaturedProductGroupRecord {
  id: string;
  brand_page_id: string;
  product_group_id: string;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface BrandPageBrandSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_file_id: string | null;
  status: 'active' | 'inactive';
  deleted_at: Date | string | null;
}

export interface BrandPageListItem {
  brand_id: string;
  brand_name: string;
  brand_slug: string;
  brand_status: 'active' | 'inactive';
  brand_deleted_at: Date | string | null;
  brand_logo_file_id: string | null;
  brand_website_url: string | null;
  page_id: string | null;
  title: string | null;
  review_status: BrandPageReviewStatus | null;
  publish_status: BrandPagePublishStatus | null;
  updated_at: Date | string | null;
  deleted_at: Date | string | null;
  active_product_group_count: number;
  pinned_product_count: number;
  missing_source_stat_count: number;
}

export interface BrandPageDetail {
  brand_page: BrandPageRecord;
  brand: BrandPageBrandSummary;
  stats: BrandPageStatRecord[];
  sources: BrandPageSourceRecord[];
  featured_product_groups: BrandPageFeaturedProductGroupRecord[];
  dependency_counts: {
    active_product_groups: number;
    pinned_product_groups: number;
    missing_source_stats: number;
  };
}

export interface BrandPageMutationInput {
  brand_id?: string;
  title?: string;
  excerpt?: string | null;
  overview_title?: string | null;
  overview_body?: string | null;
  support_title?: string | null;
  support_intro?: string | null;
  support_items?: BrandPageSupportItem[] | null;
  support_image_file_id?: string | null;
  hero_banner_id?: string | null;
  hero_title_size?: BrandPageHeroTitleSize;
  hero_excerpt_size?: BrandPageHeroExcerptSize;
  hero_eyebrow_color?: string | null;
  hero_title_color?: string | null;
  hero_excerpt_color?: string | null;
  accent_color?: string | null;
  layout_archetype?: BrandPageLayoutArchetype;
  cta_title?: string | null;
  cta_description?: string | null;
  cta_button_label?: string | null;
  cta_button_url?: string | null;
  review_status?: BrandPageReviewStatus;
  publish_status?: BrandPagePublishStatus;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_og_image_file_id?: string | null;
}

export type BrandPageStatMutationInput = Omit<
  BrandPageStatRecord,
  'id' | 'brand_page_id' | 'created_at' | 'updated_at' | 'deleted_at'
>;

export type BrandPageSourceMutationInput = Omit<
  BrandPageSourceRecord,
  'id' | 'brand_page_id' | 'created_at' | 'updated_at' | 'deleted_at'
>;
