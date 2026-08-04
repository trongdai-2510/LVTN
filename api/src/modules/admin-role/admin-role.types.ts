export const ADMIN_ROLE_ALLOWED_STATUSES = ['active', 'inactive'] as const;

export type AdminRoleStatus = (typeof ADMIN_ROLE_ALLOWED_STATUSES)[number];
