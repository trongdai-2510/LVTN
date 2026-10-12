import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const user = { id: 'qa-admin', email: 'admin@songthanh.local', display_name: 'Super Admin', status: 'active' };
const permissions = ['admin_role.read', 'admin_role.update', 'admin_role.manage_permissions', 'admin_user.read'];
const role = {
  id: 'content-role', code: 'content_admin', name: 'Content Admin', description: 'Quản lý nội dung website',
  status: 'active', created_at: '2026-04-01T08:00:00.000Z', updated_at: '2026-10-01T08:00:00.000Z',
  deleted_at: null, user_count: 1, permission_count: 1, is_protected: true, is_super_admin: false
};
const groups = [
  { module_key: 'menu', module_label: 'Menu điều hướng', permissions: [
    { code: 'menu.read', action_key: 'read', action_label: 'Xem menu', description: null, assigned: true, required_permission_codes: [] },
    { code: 'menu.create', action_key: 'create', action_label: 'Tạo menu', description: null, assigned: false, required_permission_codes: ['menu.read'] }
  ] },
  { module_key: 'audit_log', module_label: 'Nhật ký hệ thống', permissions: [
    { code: 'audit_log.read', action_key: 'read', action_label: 'Xem nhật ký', description: null, assigned: false, required_permission_codes: [] }
  ] }
];

test('a delegated role can inspect the permission matrix but cannot edit it', async ({ page }) => {
  const delegatedPermissions = [...permissions, 'menu.read'];
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'qa-token', refreshToken: 'qa-refresh', user, permissions: delegatedPermissions, roles: ['content_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions: delegatedPermissions, roles: ['content_admin'] } } });
    if (pathname === '/song-thanh/admin-roles') return route.fulfill({ json: { ok: true, data: { items: [role], filters: { q: null, status: 'all' } } } });
    if (pathname === '/song-thanh/admin-roles/content-role') return route.fulfill({ json: { ok: true, data: { role, assigned_permission_codes: ['menu.read'], permission_groups: groups } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });

  await page.goto(`${adminUrl}/admin/roles`);
  await expect(page.getByText('Content Admin', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo vai trò' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu trữ vai trò' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toHaveCount(0);
  const menu = page.locator('[data-permission-group="menu"]');
  await page.getByRole('button', { name: 'Tất cả quyền (3)' }).click();
  await expect(menu.locator('input[data-permission-code="menu.create"]')).toBeDisabled();
});

test('granted permissions open for inspection, while unassigned groups stay compact on a phone', async ({ page }, testInfo) => {
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'qa-token', refreshToken: 'qa-refresh', user, permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions, roles: ['super_admin'] } } });
    if (pathname === '/song-thanh/admin-roles') return route.fulfill({ json: { ok: true, data: { items: [role], filters: { q: null, status: 'all' } } } });
    if (pathname === '/song-thanh/admin-roles/content-role') return route.fulfill({ json: { ok: true, data: { role, assigned_permission_codes: ['menu.read'], permission_groups: groups } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });

  await page.goto(`${adminUrl}/admin/roles`);
  const menu = page.locator('[data-permission-group="menu"]');
  const audit = page.locator('[data-permission-group="audit_log"]');
  await expect(menu.getByRole('button', { name: /Menu điều hướng/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(audit).toHaveCount(0);
  await expect(menu.locator('input[data-permission-code="menu.read"]')).toBeChecked();
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('rolesCompact.png'), fullPage: true });

  await page.getByRole('button', { name: 'Tất cả quyền (3)' }).click();
  await expect(audit.getByRole('button', { name: /Nhật ký hệ thống/ })).toHaveAttribute('aria-expanded', 'false');
  await page.getByPlaceholder('Tìm module, thao tác hoặc mã quyền...').fill('nhật ký');
  await expect(audit.getByRole('button', { name: /Nhật ký hệ thống/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(audit.locator('input[data-permission-code="audit_log.read"]')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('saving a role sends exactly the permissions shown in the matrix', async ({ page }) => {
  let savedCodes: string[] | null = null;
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'qa-token', refreshToken: 'qa-refresh', user, permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions, roles: ['super_admin'] } } });
    if (pathname === '/song-thanh/admin-roles') return route.fulfill({ json: { ok: true, data: { items: [role], filters: { q: null, status: 'all' } } } });
    if (pathname === '/song-thanh/admin-roles/content-role/permissions' && route.request().method() === 'PUT') {
      savedCodes = (route.request().postDataJSON() as { permission_codes: string[] }).permission_codes;
      return route.fulfill({ json: { ok: true, data: { role, assigned_permission_codes: savedCodes, permission_groups: groups } } });
    }
    if (pathname === '/song-thanh/admin-roles/content-role') return route.fulfill({ json: { ok: true, data: { role, assigned_permission_codes: savedCodes ?? ['menu.read'], permission_groups: groups } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });

  await page.goto(`${adminUrl}/admin/roles`);
  const menu = page.locator('[data-permission-group="menu"]');
  await page.getByRole('button', { name: 'Tất cả quyền (3)' }).click();
  await menu.locator('input[data-permission-code="menu.create"]').check();
  await expect(menu.locator('input[data-permission-code="menu.read"]')).toBeChecked();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByRole('dialog', { name: 'Xác nhận cập nhật vai trò' }).getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog', { name: 'Đã lưu vai trò và quyền' })).toBeVisible();
  expect(savedCodes).toEqual(['menu.read', 'menu.create']);
});
