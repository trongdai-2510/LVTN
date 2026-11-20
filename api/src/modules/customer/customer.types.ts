export const CUSTOMER_PROFILE_TABLE = 'customer_profile';
export const CONTACT_REQUEST_TABLE = 'contact_request';
export const QUOTE_REQUEST_TABLE = 'quote_request';
export const QUOTE_ITEM_TABLE = 'quote_item';

export const CUSTOMER_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;
export const CUSTOMER_SOURCE_KINDS = ['all', 'contact', 'quote', 'both'] as const;

export type CustomerDeletedScope = (typeof CUSTOMER_DELETED_SCOPES)[number];
export type CustomerSourceKind = (typeof CUSTOMER_SOURCE_KINDS)[number];

export interface CustomerProfileRecord {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface CustomerSummaryRecord {
  contact_count: number;
  quote_count: number;
  last_interaction_at: Date | string | null;
  last_interaction_kind: 'contact' | 'quote' | 'both' | null;
}

export interface CustomerListItem extends CustomerProfileRecord, CustomerSummaryRecord {}

export interface CustomerMutationInput {
  full_name?: string;
  phone?: string | null;
  email?: string | null;
  company_name?: string | null;
}

export interface CustomerListFilters {
  q: string | null;
  source_kind: CustomerSourceKind;
  deleted_scope: CustomerDeletedScope;
}

export interface CustomerInteractionItem {
  interaction_type: 'contact' | 'quote';
  source_id: string;
  occurred_at: Date | string;
  status: string;
  deleted_at: Date | string | null;
  full_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  summary: string | null;
  source_page: string | null;
  item_count: number | null;
}

export interface CustomerRelatedContact {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  company_name: string | null;
  message: string;
  source_page: string | null;
  status: string;
  assigned_to: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
}

export interface CustomerRelatedQuote {
  id: string;
  full_name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  message: string | null;
  status: string;
  assigned_to: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
  item_count: number;
}
