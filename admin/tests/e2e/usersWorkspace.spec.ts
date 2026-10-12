import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const user = {
  id: 'qa-admin', email: 'admin@songthanh.local', display_name: 'Super Admin', status: 'active'
};
const permissions = [
  'admin_user.read', 'admin_user.create', 'admin_user.update',
  'admin_user.manage_status', 'admin_user.reset_password', 'admin_role.read'
];
const roles = [
  { id: 'super-role', code: 'super_admin', name: 'Super Admin', status: 'active',
    description: 'Toàn quyền hệ thống', user_count: 1, permission_count: 118,
    is_protected: true, is_super_admin: true, can_assign: true },
  { id: 'content-role', code: 'content_admin', name: 'Content Admin', status: 'active',
    description: 'Biên tập nội dung website', user_count: 1, permission_count: 60,
    is_protected: true, is_super_admin: false, can_assign: true },
  { id: 'viewer-role', code: 'viewer', name: 'Viewer', status: 'active',
    description: 'Chỉ xem dữ liệu được cấp', user_count: 0, permission_count: 16,
    is_protected: true, is_super_admin: false, can_assign: true }
];
const accounts = [
  { id: user.id, email: user.email, display_name: user.display_name, status: 'active',
    last_login_at: '2026-10-01T08:00:00.000Z', created_at: '2026-04-01T08:00:00.000Z',
    updated_at: '2026-10-01T08:00:00.000Z', is_current_user: true,
    roles: [{ id: roles[0].id, code: roles[0].code, name: roles[0].name,
      status: 'active', is_protected: true }] },
  { id: 'qa-editor', email: 'content@songthanh.local', display_name: 'Biên tập nội dung',
    status: 'locked', last_login_at: null, created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-01T08:00:00.000Z', is_current_user: false,
    roles: [{ id: roles[1].id, code: roles[1].code, name: roles[1].name,
      status: 'active', is_protected: true }] }
];

async function openWorkspace(page: Page, roleCode = 'super_admin') {
  const listRequests: string[] = [];
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: 'qa-token', refreshToken: 'qa-refresh', user,
    permissions, roles: [roleCode]
  });
  await page.route(`${apiUrl}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/auth/me') {
      return route.fulfill({ json: {
        ok: true, data: { user, permissions, roles: [roleCode] }
      } });
    }
    if (url.pathname === '/song-thanh/admin-users') {
      listRequests.push(url.search);
      const query = (url.searchParams.get('q') || '').toLowerCase();
      const status = url.searchParams.get('status');
      const roleId = url.searchParams.get('role_id');
      const filtered = accounts.filter((account) =>
        (!query || `${account.display_name} ${account.email}`.toLowerCase().includes(query)) &&
        (!status || account.status === status) &&
        (!roleId || account.roles.some((role) => role.id === roleId))
      );
      return route.fulfill({ json: { ok: true, data: {
        items: filtered,
        pagination: { page: 1, page_size: 10, total: filtered.length },
        filters: { q: query || null, status: status || 'all', role_id: roleId },
        available_roles: roles
      } } });
    }
    if (url.pathname === '/song-thanh/admin-users/qa-editor') {
      return route.fulfill({ json: { ok: true, data: { user: accounts[1], available_roles: roles } } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
  await page.goto(`${adminUrl}/admin/users`);
  await expect(page.locator('[data-user-account-card]')).toHaveCount(2);
  return () => listRequests;
}

test('a delegated role can read users but cannot see management actions', async ({ page }) => {
  await openWorkspace(page, 'content_admin');
  await expect(page.getByText('2 tài khoản')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo người dùng' })).toHaveCount(0);
  await expect(page.locator('[data-user-account-card]').getByRole('button', { name: 'Sửa' })).toHaveCount(0);
  await expect(page.locator('[data-user-account-card]').getByRole('button', { name: 'Quản lý' })).toHaveCount(0);
});

test('the account list is concise and does not fetch four separate summaries', async ({ page }, testInfo) => {
  const requests = await openWorkspace(page);
  await page.screenshot({ path: testInfo.outputPath('usersWorkspace.png'), fullPage: true });
  await expect(page.getByRole('heading', { name: 'Tài khoản quản trị', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Khu vực Hệ thống' })).toHaveCount(0);
  await expect(page.locator('[data-admin-sidebar]').getByRole('link', { name: 'Người dùng' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('2 tài khoản')).toBeVisible();
  expect(requests().length).toBeLessThanOrEqual(2);
  expect(requests().every((search) => new URLSearchParams(search).get('page_size') === '10')).toBe(true);
});

test('accounts use one readable card layout on desktop and phone', async ({ page }, testInfo) => {
  await openWorkspace(page);
  await expect(page.locator('[data-user-account-card]')).toHaveCount(2);
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('accountsDesktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-user-account-card]')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('accountsPhone.png'), fullPage: true });
});

test('the account form chooses one role without a long card list', async ({ page }, testInfo) => {
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Tạo người dùng' }).click();
  const editor = page.getByRole('dialog', { name: 'Tạo người dùng' });
  await page.screenshot({ path: testInfo.outputPath('accountForm.png'), fullPage: true });
  const role = editor.getByRole('combobox', { name: 'Vai trò' });
  await role.selectOption('viewer-role');
  await expect(role).toHaveValue('viewer-role');
  await expect(editor.getByText('16 quyền')).toBeVisible();
});

test('accounts remain readable and actionable at phone width', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await expect(page.getByTestId('user-mobile-card')).toHaveCount(2);
  await expect(page.getByTestId('user-mobile-card').last().getByRole('button', { name: 'Sửa' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Khu vực Hệ thống' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('usersMobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('one card action opens account management without a clipped menu', async ({ page }, testInfo) => {
  await openWorkspace(page);
  const editorRow = page.locator('[data-user-account-card]').filter({ hasText: 'content@songthanh.local' });
  await expect(editorRow.getByRole('button', { name: 'Sửa' })).toHaveCount(1);
  await expect(editorRow.getByRole('button', { name: /Thao tác cho/ })).toHaveCount(0);
  await editorRow.getByRole('button', { name: 'Sửa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chỉnh sửa người dùng' });
  await expect(dialog.getByRole('button', { name: 'Tạo mật khẩu tạm' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('accountActions.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Tạo mật khẩu tạm' }).click();
  await expect(page.getByRole('dialog', { name: 'Tạo mật khẩu tạm' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Chỉnh sửa người dùng' })).toHaveCount(0);
});

test('search narrows accounts and clearing filters restores the list', async ({ page }) => {
  const requests = await openWorkspace(page);
  await page.getByRole('searchbox', { name: 'Tìm kiếm người dùng' }).fill('content@');
  await expect(page.getByText('1 tài khoản')).toBeVisible();
  await expect(page.locator('[data-user-account-card]').getByText('Biên tập nội dung', { exact: true })).toBeVisible();
  await expect(page.locator('[data-user-account-card]').getByText('Super Admin', { exact: true })).toHaveCount(0);
  expect(requests().some((search) => new URLSearchParams(search).get('q') === 'content@')).toBe(true);
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
  await expect(page.getByText('2 tài khoản')).toBeVisible();
});

test('a failed save stays in the account form with its error', async ({ page }) => {
  await openWorkspace(page);
  await page.route(`${apiUrl}/song-thanh/admin-users`, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ status: 409, json: {
      ok: false, error: { code: 'QA_SAVE_REJECTED', message: 'Không lưu được tài khoản QA.' }
    } });
  });
  await page.getByRole('button', { name: 'Tạo người dùng' }).click();
  const editor = page.getByRole('dialog', { name: 'Tạo người dùng' });
  await editor.getByRole('textbox', { name: 'Họ tên' }).fill('QA mới');
  await editor.getByRole('textbox', { name: 'Email' }).fill('new@example.invalid');
  await editor.getByRole('combobox', { name: 'Vai trò' }).selectOption('viewer-role');
  await editor.getByRole('button', { name: 'Tạo người dùng' }).click();
  await expect(editor.getByText('Dữ liệu hiện tại không cho phép thao tác này')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('account list and editor meet basic accessibility checks', async ({ page }) => {
  await openWorkspace(page);
  const listReport = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(listReport.violations).toEqual([]);
  await page.getByRole('button', { name: 'Tạo người dùng' }).click();
  const editorReport = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(editorReport.violations).toEqual([]);
});
