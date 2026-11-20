import { expect, test, type Page } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

async function mockSession(page: Page, permissions: string[], roles: string[]) {
  const user = { id: 'qa-user', email: 'qa@example.com', display_name: 'QA', status: 'active' };
  const state = {
    accessToken: 'qa-token', refreshToken: 'qa-refresh', user, permissions, roles
  };
  await page.addInitScript((value) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(value));
  }, state);
  await page.route(`${apiUrl}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/auth/me') {
      return route.fulfill({ json: { ok: true, data: { user, permissions, roles } } });
    }
    if (pathname === '/song-thanh/admin-users') {
      return route.fulfill({ json: {
        ok: true,
        data: {
          items: [],
          pagination: { page: 1, page_size: 10, total: 0 },
          available_roles: [
            { id: 'role-viewer', code: 'viewer', name: 'Viewer', status: 'active',
              description: null, user_count: 0, permission_count: 16,
              is_protected: true, is_super_admin: false, can_assign: true },
            { id: 'role-content', code: 'content_admin', name: 'Content Admin', status: 'active',
              description: null, user_count: 0, permission_count: 60,
              is_protected: true, is_super_admin: false, can_assign: true }
          ]
        }
      } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
}

test('one user can select only one role in the account form', async ({ page }) => {
  await mockSession(page, ['admin_user.read', 'admin_user.create'], ['super_admin']);
  await page.goto(`${adminUrl}/admin/users`);
  await page.getByRole('button', { name: 'Tạo người dùng' }).click();
  const editor = page.getByRole('dialog', { name: 'Tạo người dùng', exact: true });
  const role = editor.getByRole('combobox', { name: 'Vai trò' });
  await role.selectOption('role-viewer');
  await expect(role).toHaveValue('role-viewer');
  await role.selectOption('role-content');
  await expect(role).toHaveValue('role-content');
  await expect(editor.getByText('Content Admin: 60 quyền')).toBeVisible();
});

test('direct navigation does not expose pages absent from the assigned role', async ({ page }) => {
  await mockSession(page, ['product_group.read'], ['product_admin']);
  for (const pathname of ['/home-page', '/customers']) {
    await page.goto(`${adminUrl}/admin${pathname}`);
    await expect(page.getByRole('heading', { name: 'Không đủ quyền truy cập' })).toBeVisible();
  }
});
