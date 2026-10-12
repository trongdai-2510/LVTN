const superAdminOnlyPermissions = new Set([
  'admin_user.create',
  'admin_user.update',
  'admin_user.manage_status',
  'admin_user.reset_password',
  'admin_role.create',
  'admin_role.update',
  'admin_role.archive',
  'admin_role.manage_permissions'
]);

export function isSuperAdminOnlyPermission(code: string): boolean {
  return superAdminOnlyPermissions.has(code);
}
