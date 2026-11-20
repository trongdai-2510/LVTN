export const ADMIN_USER_ALLOWED_STATUSES = ['active', 'inactive', 'locked'] as const;

export interface AdminUserRoleSummary {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  is_protected: boolean;
}
