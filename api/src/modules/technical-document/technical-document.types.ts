export const TECHNICAL_DOCUMENT_TABLE = 'technical_document';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const PRODUCT_VARIANT_TABLE = 'product_variant';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';

export const TECHNICAL_DOCUMENT_FILE_USAGE_ENTITY_TYPE = 'technical_document';
export const TECHNICAL_DOCUMENT_FILE_FIELD_NAME = 'file_id';

export const TECHNICAL_DOCUMENT_ALLOWED_STATUSES = ['active', 'inactive'] as const;
export const TECHNICAL_DOCUMENT_ALLOWED_TYPES = [
  'datasheet',
  'manual',
  'catalogue',
  'certificate',
  'other'
] as const;
export const TECHNICAL_DOCUMENT_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const TECHNICAL_DOCUMENT_PUBLIC_FILTERS = ['true', 'false', 'all'] as const;

export type TechnicalDocumentStatus = (typeof TECHNICAL_DOCUMENT_ALLOWED_STATUSES)[number];
export type TechnicalDocumentType = (typeof TECHNICAL_DOCUMENT_ALLOWED_TYPES)[number];
export type TechnicalDocumentDeletedScope = (typeof TECHNICAL_DOCUMENT_DELETED_SCOPES)[number];
export type TechnicalDocumentPublicFilter = (typeof TECHNICAL_DOCUMENT_PUBLIC_FILTERS)[number];

export interface TechnicalDocumentRecord {
  id: string;
  product_group_id: string;
  product_variant_id: string | null;
  document_name: string;
  document_type: TechnicalDocumentType;
  file_id: string;
  version: string | null;
  is_public: boolean;
  status: TechnicalDocumentStatus;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface TechnicalDocumentAdminRecord extends TechnicalDocumentRecord {
  product_group_name: string | null;
  product_group_slug: string | null;
  product_variant_name: string | null;
  file_original_filename: string | null;
}

export interface TechnicalDocumentListItem extends TechnicalDocumentAdminRecord {
  active_file_usage_count: number;
}

export interface TechnicalDocumentDependencyCounts {
  active_file_usage: number;
}

export interface TechnicalDocumentMutationInput {
  product_group_id?: string;
  product_variant_id?: string | null;
  document_name?: string;
  document_type?: TechnicalDocumentType;
  file_id?: string;
  version?: string | null;
  is_public?: boolean;
  status?: TechnicalDocumentStatus;
  sort_order?: number;
}
