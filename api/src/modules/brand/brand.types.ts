export const BRAND_TABLE = 'brand';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const PRODUCT_CATEGORY_TABLE = 'product_category';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';
export const BRAND_FILE_USAGE_ENTITY_TYPE = 'brand';
export const BRAND_LOGO_FIELD_NAME = 'logo_file_id';
export const BRAND_ALLOWED_STATUSES = ['active', 'inactive'] as const;
export const BRAND_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type BrandStatus = (typeof BRAND_ALLOWED_STATUSES)[number];
export type BrandDeletedScope = (typeof BRAND_DELETED_SCOPES)[number];

export interface BrandRecord {
  id: string;
  name: string;
  slug: string;
  primary_category_id: string | null;
  logo_file_id: string | null;
  description: string | null;
  website_url: string | null;
  sort_order: number;
  status: BrandStatus;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface BrandListItem extends BrandRecord {
  primary_category_name: string | null;
  active_product_group_count: number;
}

export interface BrandMutationInput {
  name?: string;
  slug?: string;
  primary_category_id?: string | null;
  logo_file_id?: string | null;
  description?: string | null;
  website_url?: string | null;
  sort_order?: number;
  status?: BrandStatus;
}
