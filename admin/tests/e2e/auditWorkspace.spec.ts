import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const id = '11111111-1111-4111-8111-111111111111';
const user = { id: 'qa-admin', email: 'admin@songthanh.local', display_name: 'Super Admin', status: 'active' };
const permissions = ['admin_user.read', 'admin_role.read', 'audit_log.read'];
const entry = {
  id, entity_type: 'admin_user', entity_id: 'account-1', actor_id: 'qa-admin',
  actor_name: 'Super Admin', actor_email: 'admin@songthanh.local', action: 'update',
  created_at: '2026-10-01T08:00:00.000Z'
};

test('audit list opens the actual log detail and stays usable on mobile', async ({ page }, testInfo) => {
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'qa-token', refreshToken: 'qa-refresh', user, permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions, roles: ['super_admin'] } } });
    if (pathname === '/song-thanh/audit-logs') return route.fulfill({ json: { ok: true, data: { items: [entry], pagination: { page: 1, page_size: 20, total: 1 } } } });
    if (pathname === `/song-thanh/audit-logs/${id}`) return route.fulfill({ json: { ok: true, data: { audit_log: { ...entry, old_value: { display_name: 'Tên cũ' }, new_value: { display_name: 'Tên mới' }, changed_fields: ['display_name'], ip_address: null, user_agent: null } } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });

  await page.goto(`${adminUrl}/admin/audit-logs`);
  await expect(page.getByRole('heading', { name: 'Nhật ký hệ thống', level: 1 })).toBeVisible();
  await expect(page.getByText('1 sự kiện')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bộ lọc' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Từ ngày')).toBeHidden();
  await page.getByRole('button', { name: 'Bộ lọc' }).click();
  await expect(page.getByRole('button', { name: 'Bộ lọc' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Từ ngày')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('auditList.png'), fullPage: true });

  await page.getByRole('link', { name: 'Xem', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chi tiết hoạt động' })).toBeVisible();
  await expect(page.getByText('Tên cũ')).toBeVisible();
  await expect(page.getByText('Tên mới', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
});

test('a role without audit permission cannot open the log or fetch its data', async ({ page }) => {
  const limitedPermissions = ['admin_user.read'];
  let auditRequests = 0;
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'qa-token', refreshToken: 'qa-refresh', user, permissions: limitedPermissions, roles: ['content_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions: limitedPermissions, roles: ['content_admin'] } } });
    if (pathname.startsWith('/song-thanh/audit-logs')) auditRequests += 1;
    return route.fulfill({ status: 403, json: { ok: false, error: { code: 'FORBIDDEN', message: 'Forbidden' } } });
  });

  await page.goto(`${adminUrl}/admin/audit-logs`);
  await expect(page.getByText(/không có quyền/i).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nhật ký hệ thống', level: 1 })).toHaveCount(0);
  expect(auditRequests).toBe(0);
});
