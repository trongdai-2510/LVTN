export const REDIRECT_TABLE = 'redirect_rule';

export const REDIRECT_TYPES = [301, 302] as const;
export const REDIRECT_STATUSES = ['active', 'inactive'] as const;
export const REDIRECT_DELETED_SCOPES = ['active', 'deleted', 'all'] as const;

export type RedirectType = (typeof REDIRECT_TYPES)[number];
export type RedirectStatus = (typeof REDIRECT_STATUSES)[number];
export type RedirectDeletedScope = (typeof REDIRECT_DELETED_SCOPES)[number];

export interface RedirectRecord {
  id: string;
  from_path: string;
  to_path: string;
  redirect_type: RedirectType;
  status: RedirectStatus;
  created_by: number | null;
  updated_by: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type RedirectReadModel = Pick<
  RedirectRecord,
  | 'id'
  | 'from_path'
  | 'to_path'
  | 'redirect_type'
  | 'status'
  | 'created_by'
  | 'updated_by'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
>;

export interface RedirectMutationInput {
  from_path?: string;
  to_path?: string;
  redirect_type?: RedirectType;
  status?: RedirectStatus;
}
