export const PRODUCT_VARIANT_TABLE = 'product_variant';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const PRODUCT_CATEGORY_TABLE = 'product_category';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';
export const PRODUCT_IMAGE_TABLE = 'product_image';
export const QUOTE_ITEM_TABLE = 'quote_item';
export const VARIANT_ATTRIBUTE_TABLE = 'variant_attribute';

export const PRODUCT_IMAGE_FILE_USAGE_ENTITY_TYPE = 'product_image';
export const PRODUCT_IMAGE_FILE_USAGE_FIELD_NAME = 'file_id';

export const PRODUCT_VARIANT_ALLOWED_STATUSES = ['active', 'inactive'] as const;
export const PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES = [
  'draft',
  'pending_review',
  'approved',
  'rejected'
] as const;
export const PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES = [
  'unpublished',
  'published',
  'archived'
] as const;
export const PRODUCT_VARIANT_ALLOWED_PUBLIC_PRICE_MODES = ['public_price', 'contact_for_quote'] as const;
export const PRODUCT_VARIANT_MAX_PUBLIC_PRICE_AMOUNT = 2147483647;
export const PRODUCT_VARIANT_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type ProductVariantStatus = (typeof PRODUCT_VARIANT_ALLOWED_STATUSES)[number];
export type ProductVariantReviewStatus = (typeof PRODUCT_VARIANT_ALLOWED_REVIEW_STATUSES)[number];
export type ProductVariantPublishStatus = (typeof PRODUCT_VARIANT_ALLOWED_PUBLISH_STATUSES)[number];
export type ProductVariantPublicPriceMode = (typeof PRODUCT_VARIANT_ALLOWED_PUBLIC_PRICE_MODES)[number];
export type ProductVariantDeletedScope = (typeof PRODUCT_VARIANT_DELETED_SCOPES)[number];

export interface ProductVariantRecord {
  id: string;
  product_group_id: string;
  external_code: string | null;
  sku: string;
  model_code: string | null;
  variant_name: string;
  detailed_description: string | null;
  public_price_mode: ProductVariantPublicPriceMode;
  public_price_amount: number | null;
  review_status: ProductVariantReviewStatus;
  publish_status: ProductVariantPublishStatus;
  status: ProductVariantStatus;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface ProductVariantAdminRecord extends ProductVariantRecord {
  product_group_name: string | null;
  product_group_slug: string | null;
  image_file_id: string | null;
}

export interface ProductVariantListItem extends ProductVariantAdminRecord {
  active_quote_item_count: number;
  attribute_count: number;
  highlight_spec_count: number;
  attributes?: Array<Pick<VariantAttributeRecord, 'product_variant_id' | 'attribute_name' | 'attribute_value' | 'display_order'>>;
}

export interface ProductVariantDependencyCounts {
  active_quote_items: number;
}

export interface ProductVariantMutationInput {
  product_group_id?: string;
  external_code?: string | null;
  sku?: string;
  model_code?: string | null;
  variant_name?: string;
  detailed_description?: string | null;
  public_price_mode?: ProductVariantPublicPriceMode;
  public_price_amount?: number | null;
  review_status?: ProductVariantReviewStatus;
  publish_status?: ProductVariantPublishStatus;
  status?: ProductVariantStatus;
  sort_order?: number;
}

export interface VariantAttributeRecord {
  id: string;
  product_variant_id: string;
  attribute_name: string;
  attribute_value: string;
  display_order: number;
  created_by: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface VariantAttributeMutationInput {
  attribute_name?: string;
  attribute_value?: string;
  display_order?: number;
}
