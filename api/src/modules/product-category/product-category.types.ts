export const PRODUCT_CATEGORY_TABLE = 'product_category';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';
export const PRODUCT_CATEGORY_FILE_USAGE_ENTITY_TYPE = 'product_category';
export const PRODUCT_CATEGORY_ICON_FIELD_NAME = 'icon_file_id';
export const PRODUCT_CATEGORY_ALLOWED_STATUSES = ['active', 'inactive'] as const;
export const PRODUCT_CATEGORY_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type ProductCategoryStatus = (typeof PRODUCT_CATEGORY_ALLOWED_STATUSES)[number];
export type ProductCategoryDeletedScope = (typeof PRODUCT_CATEGORY_DELETED_SCOPES)[number];

export interface ProductCategoryRecord {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  icon_file_id: string | null;
  sort_order: number;
  status: ProductCategoryStatus;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface ProductCategoryListItem extends ProductCategoryRecord {
  active_product_group_count: number;
  parent_name: string | null;
}

export interface ProductCategoryMutationInput {
  name?: string;
  slug?: string;
  parent_id?: string | null;
  description?: string | null;
  icon_file_id?: string | null;
  sort_order?: number;
  status?: ProductCategoryStatus;
}
