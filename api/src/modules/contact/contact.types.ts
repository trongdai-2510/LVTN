export const CONTACT_REQUEST_TABLE = 'contact_request';
export const CONTACT_INTERNAL_NOTE_TABLE = 'contact_internal_note';

export const CONTACT_ALLOWED_STATUSES = ['new', 'in_progress', 'done', 'spam', 'invalid'] as const;
export const CONTACT_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type ContactStatus = (typeof CONTACT_ALLOWED_STATUSES)[number];
export type ContactDeletedScope = (typeof CONTACT_DELETED_SCOPES)[number];
type ContactStatusFilter = ContactStatus | 'all';

export interface ContactRecord {
  id: string;
  customer_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  company_name: string | null;
  message: string;
  source_page: string | null;
  status: ContactStatus;
  assigned_to: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
}

export type ContactListItem = Omit<ContactRecord, 'message' | 'ip_address' | 'user_agent'> & {
  assigned_to_label: string | null;
};

export type ContactDetailRecord = ContactRecord & {
  assigned_to_label: string | null;
};

export interface ContactInternalNoteRecord {
  id: string;
  contact_id: string;
  note_text: string;
  added_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type ContactInternalNote = ContactInternalNoteRecord & {
  added_by_label: string | null;
};

export interface ContactAssigneeOption {
  id: number;
  label: string;
  email: string | null;
}

export interface ContactListFilters {
  q: string | null;
  status: ContactStatusFilter;
  assigned_to: number | null;
  created_from: Date | null;
  created_to: Date | null;
  deleted_scope: ContactDeletedScope;
}
