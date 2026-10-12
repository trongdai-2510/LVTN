import { expect, test, type Page } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

async function openWithStaleAccess(page: Page, meStatus: number) {
  let currentStatus = meStatus;
  await page.addInitScript(() => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify({
      accessToken: 'stale-access', refreshToken: 'stale-refresh',
      user: { id: 'old-admin', display_name: 'Old Admin', email: 'old@example.com' },
      permissions: ['admin_user.read', 'admin_user.create', 'admin_role.read'],
      roles: ['super_admin']
    }));
  });
  await page.route(`${apiUrl}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') {
      if (currentStatus === 200) {
        return route.fulfill({ json: { ok: true, data: {
          user: { id: 'old-admin', display_name: 'Old Admin', email: 'old@example.com' },
          permissions: ['admin_user.read', 'admin_role.read'], roles: ['super_admin']
        } } });
      }
      return route.fulfill({ status: currentStatus, json: {
        ok: false, error: { code: 'AUTH_ACCESS_REVOKED', message: 'Không thể xác minh quyền hiện tại.' }
      } });
    }
    if (path === '/auth/refresh') {
      return route.fulfill({ status: 401, json: {
        ok: false, error: { code: 'AUTH_INVALID_REFRESH_TOKEN', message: 'Phiên đã hết hạn.' }
      } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
  await page.goto(`${adminUrl}/admin/users`);
  return (status: number) => { currentStatus = status; };
}

test('a revoked admin session does not show cached system rights', async ({ page }) => {
  await openWithStaleAccess(page, 403);
  await expect(page).toHaveURL(/\/admin\/login\?returnTo=/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Người dùng' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('song-thanh-admin-auth'))).toBeNull();
});

test('verification outage blocks stale access but offers a retry', async ({ page }) => {
  const setStatus = await openWithStaleAccess(page, 503);
  await expect(page.getByRole('heading', { name: 'Chưa thể xác minh quyền truy cập' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Người dùng' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tạo người dùng' })).toHaveCount(0);
  setStatus(200);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa thể xác minh quyền truy cập' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Người dùng' }).first()).toBeVisible();
});

test('a sidebar group links to an allowed child when its parent is forbidden', async ({ page }) => {
  const user = { id: 'variant-reader', display_name: 'Biến thể', email: 'variant@example.com' };
  const permissions = ['product_variant.read'];
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'variant-token', refreshToken: 'variant-refresh', user,
    permissions, roles: ['product_admin'] });
  await page.route(`${apiUrl}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: {
      user, permissions, roles: ['product_admin']
    } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
  await page.goto(`${adminUrl}/admin/dashboard`);
  await expect(page.locator('[data-admin-sidebar]')
    .getByRole('link', { name: 'Sản phẩm', exact: true })).toHaveAttribute('href', '/admin/product-variants');
});

test('an open tab loses both the page and its actions after role permissions are revoked', async ({ page }) => {
  const user = { id: 'editor', display_name: 'Biên tập', email: 'editor@example.com' };
  let permissions = ['admin_user.read', 'admin_user.create'];
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'editor-token', refreshToken: 'editor-refresh', user,
    permissions, roles: ['content_admin'] });
  await page.route(`${apiUrl}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: {
      user, permissions, roles: ['content_admin']
    } } });
    if (path === '/song-thanh/admin-users') return route.fulfill({ json: { ok: true, data: {
      items: [], pagination: { page: 1, page_size: 10, total: 0 }, available_roles: []
    } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
  await page.goto(`${adminUrl}/admin/users`);
  await expect(page.getByRole('heading', { name: 'Tài khoản quản trị' })).toBeVisible();
  permissions = [];
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Không đủ quyền truy cập' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo người dùng' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Người dùng' })).toHaveCount(0);
});

test('authentication and admin API responses are not cacheable', async ({ request }) => {
  for (const path of ['/auth/me', '/song-thanh/admin-users']) {
    const response = await request.get(`${apiUrl}${path}`);
    expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('customer submission responses are not cacheable even when validation fails', async ({ request }) => {
  for (const path of ['/public/contact-requests', '/public/quote-requests']) {
    const response = await request.post(`${apiUrl}${path}`, { data: {} });
    expect(response.status()).toBe(400);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test('a forged browser session cannot open users by changing the admin URL', async ({ page, request }) => {
  const forgedToken = 'not-a-signed-access-token';
  const response = await request.get(`${apiUrl}/song-thanh/admin-users`, {
    headers: { Authorization: `Bearer ${forgedToken}` }
  });
  expect(response.status()).toBe(401);

  await page.addInitScript((accessToken) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify({
      accessToken,
      refreshToken: 'not-a-valid-refresh-token',
      user: { id: 'another-user', display_name: 'Super Admin' },
      permissions: ['admin_user.read', 'admin_user.create'],
      roles: ['super_admin']
    }));
  }, forgedToken);
  await page.goto(`${adminUrl}/admin/users`);
  await expect(page).toHaveURL(/\/admin\/login\?returnTo=/);
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo người dùng' })).toHaveCount(0);
});
