export const PRODUCT_GROUP_TABLE = 'product_group';
export const PRODUCT_VARIANT_TABLE = 'product_variant';
export const PRODUCT_CATEGORY_TABLE = 'product_category';
export const BRAND_TABLE = 'brand';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';
export const TECHNICAL_DOCUMENT_TABLE = 'technical_document';
export const PRODUCT_IMAGE_TABLE = 'product_image';
export const SPEC_GROUP_TABLE = 'spec_group';
export const PRODUCT_SPEC_TABLE = 'product_spec';
export const VARIANT_SPEC_GROUP_TABLE = 'variant_spec_group';
export const VARIANT_SPEC_TABLE = 'variant_spec';
export const VARIANT_ATTRIBUTE_TABLE = 'variant_attribute';
export const PRODUCT_HIGHLIGHT_SPEC_TABLE = 'product_highlight_spec';
export const SERVICE_PRODUCT_GROUP_TABLE = 'service_product_group';
export const PROJECT_PRODUCT_GROUP_TABLE = 'project_product_group';
export const QUOTE_ITEM_TABLE = 'quote_item';

export const PRODUCT_GROUP_FILE_USAGE_ENTITY_TYPE = 'product_group';
export const PRODUCT_GROUP_THUMBNAIL_FIELD_NAME = 'thumbnail_file_id';
export const PRODUCT_GROUP_OG_IMAGE_FIELD_NAME = 'seo_og_image_file_id';

export const PRODUCT_IMAGE_GALLERY_ENTITY_TYPE = 'product_image';
export const PRODUCT_IMAGE_GALLERY_FIELD_NAME = 'file_id';
export const PRODUCT_IMAGE_GALLERY_MAX_IMAGES = 80;

export interface ProductImageGalleryRecord {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  file_id: string;
  alt_text: string | null;
  sort_order: number;
  file: {
    id: string;
    original_filename: string;
    mime_type: string;
  } | null;
}

export interface ProductImageGalleryInput {
  file_id: string;
  alt_text?: string | null;
  product_variant_id?: string | null;
}

export const PRODUCT_GROUP_ALLOWED_STATUSES = ['active', 'inactive'] as const;
export const PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected'
] as const;
export const PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES = [
  'unpublished',
  'published',
  'archived'
] as const;
export const PRODUCT_GROUP_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const PRODUCT_HIGHLIGHT_SPEC_ALLOWED_SOURCE_TYPES = [
  'product_spec',
  'variant_spec',
  'variant_attribute',
  'manual'
] as const;

export type ProductGroupStatus = (typeof PRODUCT_GROUP_ALLOWED_STATUSES)[number];
export type ProductGroupReviewStatus = (typeof PRODUCT_GROUP_ALLOWED_REVIEW_STATUSES)[number];
export type ProductGroupPublishStatus = (typeof PRODUCT_GROUP_ALLOWED_PUBLISH_STATUSES)[number];
export type ProductGroupDeletedScope = (typeof PRODUCT_GROUP_DELETED_SCOPES)[number];
export type ProductHighlightSpecSourceType = (typeof PRODUCT_HIGHLIGHT_SPEC_ALLOWED_SOURCE_TYPES)[number];

export interface ProductGroupRecord {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  brand_id: string | null;
  short_description: string | null;
  detailed_description: string | null;
  thumbnail_file_id: string | null;
  review_status: ProductGroupReviewStatus;
  publish_status: ProductGroupPublishStatus;
  seo_title: string | null;
  seo_description: string | null;
  seo_og_image_file_id: string | null;
  status: ProductGroupStatus;
  sort_order: number;
  view_count: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface ProductGroupAdminRecord extends ProductGroupRecord {
  category_level_1_id: string | null;
  category_level_1_name: string | null;
  category_level_2_id: string | null;
  category_level_2_name: string | null;
  brand_name: string | null;
}

export interface ProductGroupListItem extends ProductGroupAdminRecord {
  variant_count: number;
  document_count: number;
}

export interface ProductGroupDependencyCounts {
  active_variants: number;
  active_documents: number;
  active_images: number;
  active_service_relations: number;
  active_project_relations: number;
  active_quote_items: number;
}

export interface ProductGroupMutationInput {
  name?: string;
  slug?: string;
  category_id?: string;
  brand_id?: string | null;
  short_description?: string | null;
  detailed_description?: string | null;
  thumbnail_file_id?: string | null;
  review_status?: ProductGroupReviewStatus;
  publish_status?: ProductGroupPublishStatus;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_og_image_file_id?: string | null;
  status?: ProductGroupStatus;
  sort_order?: number;
}

export interface ProductGroupPublicPriceSummary {
  display_mode: 'contact_for_quote' | 'exact_price' | 'from_price';
  display_amount: number | null;
  minimum_public_price_amount: number | null;
  priced_public_variant_count: number;
  public_variant_count: number;
}

export interface ProductHighlightSpecRecord {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  source_type: ProductHighlightSpecSourceType;
  source_id: string | null;
  display_label: string;
  display_value: string;
  sort_order: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface ProductHighlightSpecMutationInput {
  product_group_id: string;
  product_variant_id: string | null;
  source_type: ProductHighlightSpecSourceType;
  source_id: string | null;
  display_label: string;
  display_value: string;
  sort_order: number;
}

export interface ProductHighlightSpecPatchInput {
  display_label?: string;
  display_value?: string;
  sort_order?: number;
}

export interface ProductHighlightSpecSourceCandidate {
  source_type: Exclude<ProductHighlightSpecSourceType, 'manual'>;
  source_id: string;
  product_group_id: string;
  product_variant_id: string | null;
  source_label: string;
  source_value: string;
  source_sort_order: number;
}
