export const FILE_METADATA_TABLE = 'file_metadata';
export const FILE_USAGE_TABLE = 'file_usage';
export const FILE_STORAGE_LOCATIONS = ['local', 'r2', 'other'] as const;
export const FILE_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const FILE_PURPOSES = [
  'product_image',
  'brand_logo',
  'banner',
  'technical_document',
  'import_file',
  'website_config',
  'other'
] as const;
export const FILE_USAGE_GROUPS = FILE_PURPOSES;

export type FileStorageLocation = (typeof FILE_STORAGE_LOCATIONS)[number];
export type FileDeletedScope = (typeof FILE_DELETED_SCOPES)[number];
export type FilePurpose = (typeof FILE_PURPOSES)[number];
export type FileUsageGroup = FilePurpose;

export interface FileMetadataRecord {
  id: string;
  original_filename: string;
  stored_path: string;
  file_size: number;
  mime_type: string;
  storage_location: FileStorageLocation;
  purpose: FilePurpose;
  uploaded_by: number | null;
  is_orphan: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface FileListItem extends FileMetadataRecord {
  active_usage_count: number;
  usage_group: FileUsageGroup;
}

export interface FileUsageRecord {
  id: string;
  file_id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
  /** Resolved product_group id (populated when entity_type is product_group or product_image) */
  resolved_group_id?: string | null;
  /** Resolved product_group name */
  resolved_group_name?: string | null;
}

export interface FilePreviewSummary {
  id: string;
  original_filename: string;
  mime_type: string;
}

export interface FileUsageRecordSummary {
  entity_type: string;
  entity_id: string;
  entity_label: string;
  /** For product_image entity_type: the product_group.id this image belongs to */
  entity_resolved_group_id?: string | null;
  usage_group: FileUsageGroup;
  file_count: number;
  usage_count: number;
  latest_usage_at: Date | string | null;
  preview_file: FilePreviewSummary | null;
}
