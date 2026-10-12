export const AUDIT_LOG_TABLE = 'audit_log';

export const AUDIT_LOG_ACTIONS = ['create', 'update', 'soft_delete', 'restore', 'approve', 'publish', 'archive', 'apply_import', 'resolve_conflict', 'other'] as const;

export type AuditLogAction = (typeof AUDIT_LOG_ACTIONS)[number];

interface AuditLogRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  actor_id: string | null;
  action: AuditLogAction;
  old_value: unknown | null;
  new_value: unknown | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type AuditLogListItem = Pick<AuditLogRecord, 'id' | 'entity_type' | 'entity_id' | 'actor_id' | 'action' | 'created_at'> & {
  actor_name: string | null;
  actor_email: string | null;
};

export type AuditLogDetail = Pick<
  AuditLogRecord,
  'id' | 'entity_type' | 'entity_id' | 'actor_id' | 'action' | 'old_value' | 'new_value' | 'changed_fields' | 'ip_address' | 'user_agent' | 'created_at'
> & {
  actor_name: string | null;
  actor_email: string | null;
};
