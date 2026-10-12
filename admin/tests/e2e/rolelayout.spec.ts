import { expect, test } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const user = { id: 'layout-admin', email: 'layout@example.com', display_name: 'Layout Admin' };
const permissions = ['admin_role.read', 'admin_role.create', 'admin_role.update', 'admin_role.manage_permissions', 'admin_user.read'];
const roles = ['Content Admin', 'Product Admin', 'Sales Admin', 'Viewer', 'Custom Admin'].map((name, index) => ({
  id: `role-${index}`,
  code: `role_${index}`,
  name,
  description: `Phạm vi ${name}`,
  status: 'active',
  created_at: '2026-04-01T08:00:00.000Z',
  updated_at: '2026-10-01T08:00:00.000Z',
  deleted_at: null,
  user_count: index,
  permission_count: 1,
  is_protected: index < 4,
  is_super_admin: false
}));
const groups = [{ module_key: 'menu', module_label: 'Menu điều hướng', permissions: [
  { code: 'menu.read', action_key: 'read', action_label: 'Xem menu', description: null, assigned: true, required_permission_codes: [] }
] }];
const longGroups = Array.from({ length: 11 }, (_, moduleIndex) => ({
  module_key: `module_${moduleIndex}`,
  module_label: `Khu vực ${moduleIndex + 1}`,
  permissions: Array.from({ length: 10 }, (_, permissionIndex) => ({
    code: `module_${moduleIndex}.permission_${permissionIndex}`,
    action_key: `permission_${permissionIndex}`,
    action_label: `Thao tác ${permissionIndex + 1}`,
    description: null,
    assigned: moduleIndex < 10 && permissionIndex < 6,
    required_permission_codes: []
  }))
}));
const longAssignedCodes = longGroups.flatMap((group) => group.permissions.filter((permission) => permission.assigned).map((permission) => permission.code));

async function mockAdmin(page: import('@playwright/test').Page, largeRole = false, onSave?: (codes: string[]) => void) {
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'layout-token', refreshToken: 'layout-refresh', user, permissions, roles: ['super_admin'] });
  let checks = 0;
  await page.route(`${apiUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') {
      checks += 1;
      if (checks > 1) await new Promise((resolve) => setTimeout(resolve, 500));
      return route.fulfill({ json: { ok: true, data: { user, permissions, roles: ['super_admin'] } } });
    }
    if (path === '/song-thanh/admin-roles') return route.fulfill({ json: { ok: true, data: { items: largeRole ? roles.map((role, index) => index === 0 ? { ...role, permission_count: 60 } : role) : roles, filters: { q: null, status: 'all' } } } });
    if (path === '/song-thanh/admin-roles/role-0/permissions' && route.request().method() === 'PUT') {
      const codes = (route.request().postDataJSON() as { permission_codes: string[] }).permission_codes;
      onSave?.(codes);
      return route.fulfill({ json: { ok: true, data: { role: { ...roles[0], permission_count: codes.length }, assigned_permission_codes: codes, permission_groups: longGroups } } });
    }
    const role = roles.find((item) => path === `/song-thanh/admin-roles/${item.id}`);
    if (role) return route.fulfill({ json: { ok: true, data: { role: largeRole && role.id === 'role-0' ? { ...role, permission_count: 60 } : role, assigned_permission_codes: largeRole && role.id === 'role-0' ? longAssignedCodes : ['menu.read'], permission_groups: largeRole && role.id === 'role-0' ? longGroups : groups } } });
    if (path === '/song-thanh/admin-users') return route.fulfill({ json: { ok: true, data: { items: [], pagination: { page: 1, page_size: 10, total: 0 }, available_roles: [] } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
}

test('role workspace uses the full width and keeps role selection usable', async ({ page }, testInfo) => {
  await mockAdmin(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${adminUrl}/admin/roles`);
  await expect(page.getByRole('heading', { name: 'Vai trò & quyền' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ma trận quyền' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Khu vực Hệ thống' })).toHaveCount(0);
  const picker = page.getByRole('region', { name: 'Danh sách vai trò' });
  const matrix = page.getByRole('heading', { name: 'Ma trận quyền' });
  const pickerBox = await picker.boundingBox();
  const matrixBox = await matrix.boundingBox();
  expect(pickerBox?.width).toBeGreaterThan(1000);
  expect(matrixBox?.y).toBeLessThan(800);
  await page.screenshot({ path: testInfo.outputPath('roles-desktop.png') });
  await picker.getByRole('button', { name: /Product Admin/ }).click();
  await expect(picker.getByRole('button', { name: /Product Admin/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Product Admin' })).toBeVisible();
});

test('role workspace fits a phone without horizontal overflow', async ({ page }, testInfo) => {
  await mockAdmin(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${adminUrl}/admin/roles`);
  await expect(page.getByRole('heading', { name: 'Ma trận quyền' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('roles-phone.png'), fullPage: true });
});

test('110 permissions remain reachable, editable and saveable at a short desktop viewport', async ({ page }, testInfo) => {
  let savedCodes: string[] | null = null;
  await mockAdmin(page, true, (codes) => { savedCodes = codes; });
  await page.setViewportSize({ width: 1536, height: 720 });
  await page.goto(`${adminUrl}/admin/roles`);
  await expect(page.getByRole('link', { name: 'Xem 60 quyền đang có ↓' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đang có (60)' })).toBeVisible();
  await expect(page.locator('input[data-permission-code]:checked')).toHaveCount(60);
  await page.screenshot({ path: testInfo.outputPath('roles110Top.png') });
  await page.getByRole('link', { name: 'Xem 60 quyền đang có ↓' }).click();
  const anchorScroll = await page.evaluate(() => window.scrollY);
  expect(anchorScroll).toBeGreaterThan(0);
  const firstGranted = page.locator('input[data-permission-code="module_0.permission_0"]');
  await expect(firstGranted).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('roles110.png') });
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 560);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(anchorScroll);

  await firstGranted.uncheck();
  await expect(firstGranted).toBeVisible();
  await expect(page.getByText('Sẽ gỡ khi lưu')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đang có (59)' })).toBeVisible();
  await page.getByRole('button', { name: 'Tất cả quyền (110)' }).click();
  const lastGroup = page.locator('[data-permission-group="module_10"]');
  await lastGroup.getByRole('button', { name: /Khu vực 11/ }).click();
  await lastGroup.locator('input[data-permission-code="module_10.permission_9"]').check();
  await expect(page.getByRole('button', { name: 'Lưu thay đổi' })).toBeInViewport();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.getByRole('dialog', { name: 'Xác nhận cập nhật vai trò' }).getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog', { name: 'Đã lưu vai trò và quyền' })).toBeVisible();
  expect(savedCodes).toHaveLength(60);
  expect(savedCodes).toContain('module_10.permission_9');
  expect(savedCodes).not.toContain('module_0.permission_0');
});

test('closing the create-role dialog restores page scrolling', async ({ page }) => {
  await mockAdmin(page, true);
  await page.setViewportSize({ width: 1536, height: 720 });
  await page.goto(`${adminUrl}/admin/roles`);
  await expect(page.getByRole('button', { name: 'Tạo vai trò' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo vai trò' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.mouse.move(900, 400);
  await page.mouse.wheel(0, 560);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('the verified admin shell stays mounted during route verification', async ({ page }) => {
  await mockAdmin(page);
  await page.goto(`${adminUrl}/admin/roles`);
  await expect(page.getByRole('heading', { name: 'Ma trận quyền' })).toBeVisible();
  await page.evaluate(() => {
    (window as typeof window & { qaSidebar?: Element | null }).qaSidebar = document.querySelector('[data-admin-sidebar]');
  });
  await page.locator('[data-admin-sidebar] a[href="/admin/users"]').click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  expect(await page.evaluate(() =>
    (window as typeof window & { qaSidebar?: Element | null }).qaSidebar === document.querySelector('[data-admin-sidebar]')
  )).toBe(true);
  await expect(page.getByRole('heading', { name: 'Tài khoản quản trị' })).toBeVisible();
  expect(await page.evaluate(() =>
    (window as typeof window & { qaSidebar?: Element | null }).qaSidebar === document.querySelector('[data-admin-sidebar]')
  )).toBe(true);
  await page.locator('[data-admin-sidebar] a[href="/admin/roles"]').click();
  await expect(page.getByRole('heading', { name: 'Ma trận quyền' })).toBeVisible();
  expect(await page.evaluate(() =>
    (window as typeof window & { qaSidebar?: Element | null }).qaSidebar === document.querySelector('[data-admin-sidebar]')
  )).toBe(true);
});
