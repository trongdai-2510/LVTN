export const IMPORT_BATCH_TABLE = 'import_batch';
export const IMPORT_MAPPING_PROFILE_TABLE = 'import_mapping_profile';
export const RAW_DATA_TABLE = 'raw_data';
export const PENDING_PRODUCT_GROUP_TABLE = 'pending_product_group';
export const PENDING_VARIANT_TABLE = 'pending_variant';
export const DATA_CONFLICT_TABLE = 'data_conflict';
export const CONFLICT_RESOLUTION_TABLE = 'conflict_resolution';
export const IMPORT_MAPPING_TABLE = 'import_mapping';
export const IMPORT_ERROR_LOG_TABLE = 'import_error_log';
export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';
export const PRODUCT_CATEGORY_TABLE = 'product_category';
export const BRAND_TABLE = 'brand';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const PRODUCT_VARIANT_TABLE = 'product_variant';

export const IMPORT_BATCH_FILE_USAGE_ENTITY_TYPE = 'import_batch';
export const IMPORT_BATCH_SOURCE_FILE_FIELD_NAME = 'source_file_id';

export const IMPORT_BATCH_STATUSES = ['created', 'validated', 'in_review', 'ready_to_apply', 'applied', 'cancelled'] as const;
export const PENDING_ROW_STATUSES = ['pending_review', 'approved', 'rejected', 'applied'] as const;
export const DATA_CONFLICT_STATUSES = ['open', 'resolved', 'skipped'] as const;
export const DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];
export type PendingRowStatus = (typeof PENDING_ROW_STATUSES)[number];
export type DataConflictStatus = (typeof DATA_CONFLICT_STATUSES)[number];
export type DeletedScope = (typeof DELETED_SCOPES)[number];

export interface ImportBatchRecord {
  id: string;
  batch_name: string | null;
  source_file_name: string;
  source_file_id: string;
  source_sheet_name: string | null;
  uploaded_by: number | null;
  status: ImportBatchStatus;
  total_rows: number;
  error_count: number;
  conflict_count: number;
  notes: string | null;
  selected_row_ranges: Array<{ start_row: number; end_row: number }> | null;
  column_mapping: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
  validated_at: Date | null;
  applied_at: Date | null;
  cancelled_at: Date | null;
  deleted_at: Date | null;
}

export interface ImportMappingProfileRecord {
  id: string;
  profile_name: string;
  header_signature: string;
  normalized_headers: string[];
  mapping_config: Record<string, unknown>;
  usage_count: number;
  last_used_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ImportBatchStats {
  raw_data_count: number;
  pending_product_group_count: number;
  pending_variant_count: number;
  conflict_count: number;
  open_conflict_count: number;
  mapping_count: number;
  error_count: number;
}

export interface PendingProductGroupReadModel {
  id: string;
  import_batch_id: string;
  external_code: string | null;
  product_name: string;
  main_category_name: string | null;
  category_name: string | null;
  brand_name: string | null;
  short_description: string | null;
  status: PendingRowStatus;
  conflict_id: string | null;
  mapped_official_id: string | null;
  review_note: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  applied_at: Date | null;
  deleted_at: Date | null;
}

export interface PendingVariantReadModel {
  id: string;
  import_batch_id: string;
  pending_product_group_id: string;
  external_code: string | null;
  sku: string | null;
  model_code: string | null;
  variant_name: string;
  public_price_mode: 'public_price' | 'contact_for_quote';
  public_price_amount: number | null;
  status: PendingRowStatus;
  conflict_id: string | null;
  mapped_official_id: string | null;
  created_at: Date;
  updated_at: Date;
  applied_at: Date | null;
  deleted_at: Date | null;
  pending_product_group?: {
    id: string;
    external_code: string | null;
    product_name: string;
    status: PendingRowStatus;
    deleted_at: Date | null;
  };
}

export interface ConflictResolutionReadModel {
  id: string;
  conflict_id: string;
  decision: 'keep_existing' | 'overwrite' | 'merge' | 'manual_edit' | 'skip';
  note: string | null;
  resolved_by: number | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface DataConflictReadModel {
  id: string;
  import_batch_id: string;
  entity_type: string;
  entity_id: string | null;
  conflict_type: string;
  existing_data: unknown | null;
  incoming_data: unknown | null;
  status: DataConflictStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  latest_resolution?: ConflictResolutionReadModel | null;
}

export interface ImportReadinessBlocker {
  code: string;
  message: string;
  count?: number;
  group_key?: 'workflow' | 'duplicate_official' | 'duplicate_in_batch' | 'missing_data' | 'mapping';
  entity_type?: 'import_batch' | 'pending_product_group' | 'pending_variant';
  entity_id?: string | null;
  entity_label?: string | null;
  field?: string | null;
  pending_value?: string | null;
  matched_official_id?: string | null;
  matched_official_label?: string | null;
  suggested_action?: 'update_existing' | 'merge_existing' | 'skip_pending' | 'manual_edit_required';
}

export interface ImportReadinessBlockerGroup {
  key: NonNullable<ImportReadinessBlocker['group_key']>;
  label: string;
  count: number;
  blockers: ImportReadinessBlocker[];
}

export interface ImportReadinessPlannedActions {
  create_product_group_count: number;
  update_product_group_count: number;
  create_variant_count: number;
  update_variant_count: number;
}

export interface ParsedWorkbookRow {
  source_row_number: number;
  cells: Record<string, string | null>;
}

export interface DerivedImportRow {
  source_row_number: number;
  raw_content: Record<string, unknown>;
  group_external_code: string;
  variant_external_code: string;
  sku: string;
  model_code: string | null;
  product_name: string;
  variant_name: string;
  category_main_name: string | null;
  category_name: string | null;
  brand_name: string | null;
  short_description: string | null;
  public_price_mode: 'public_price' | 'contact_for_quote';
  public_price_amount: number | null;
  price_parse_error: string | null;
}
