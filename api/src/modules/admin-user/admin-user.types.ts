export const ADMIN_USER_ALLOWED_STATUSES = ['active', 'inactive', 'locked'] as const;

export type AdminUserStatus = (typeof ADMIN_USER_ALLOWED_STATUSES)[number];

export interface AdminUserRoleSummary {
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  is_protected: boolean;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  display_name: string;
  status: AdminUserStatus;
  last_login_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  is_current_user: boolean;
  roles: AdminUserRoleSummary[];
}
