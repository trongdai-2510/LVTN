export const QUOTE_REQUEST_TABLE = 'quote_request';
export const QUOTE_ITEM_TABLE = 'quote_item';
export const QUOTE_INTERNAL_NOTE_TABLE = 'quote_internal_note';
export const PRODUCT_GROUP_TABLE = 'product_group';
export const PRODUCT_VARIANT_TABLE = 'product_variant';
export const BRAND_TABLE = 'brand';

export const QUOTE_ALLOWED_STATUSES = ['new', 'in_progress', 'done', 'spam', 'invalid'] as const;
export const QUOTE_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type QuoteStatus = (typeof QUOTE_ALLOWED_STATUSES)[number];
export type QuoteDeletedScope = (typeof QUOTE_DELETED_SCOPES)[number];
type QuoteStatusFilter = QuoteStatus | 'all';

export interface QuoteRecord {
  id: string;
  customer_id: string | null;
  full_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  message: string | null;
  project_name: string | null;
  project_context: string | null;
  project_requirements: Array<{ label: string; value: string }>;
  status: QuoteStatus;
  assigned_to: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface QuoteItem {
  id: string;
  quote_request_id: string;
  product_group_id: string;
  product_group_name: string | null;
  product_group_status: string | null;
  product_group_deleted_at: Date | null;
  thumbnail_file_id: string | null;
  brand_name: string | null;
  product_variant_id: string | null;
  product_variant_name: string | null;
  product_variant_sku: string | null;
  product_variant_status: string | null;
  product_variant_deleted_at: Date | null;
  quantity: number | null;
  quantity_raw: string | null;
  quantity_unit: string | null;
  quantity_state: 'confirmed' | 'unspecified';
  public_price_amount_at_request: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type QuoteListItem = Omit<
  QuoteRecord,
  | 'address'
  | 'message'
  | 'project_name'
  | 'project_context'
  | 'project_requirements'
  | 'ip_address'
  | 'user_agent'
> & {
  assigned_to_label: string | null;
  item_count: number;
  first_item: QuoteItem | null;
};

export type QuoteDetailRecord = QuoteRecord & {
  assigned_to_label: string | null;
};

export interface QuoteInternalNoteRecord {
  id: string;
  quote_id: string;
  note_text: string;
  added_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type QuoteInternalNote = QuoteInternalNoteRecord & {
  added_by_label: string | null;
};

export interface QuoteAssigneeOption {
  id: number;
  label: string;
  email: string | null;
}

export interface QuoteListFilters {
  q: string | null;
  status: QuoteStatusFilter;
  assigned_to: number | null;
  product_group_id: string | null;
  product_variant_id: string | null;
  created_from: Date | null;
  created_to: Date | null;
  deleted_scope: QuoteDeletedScope;
}
