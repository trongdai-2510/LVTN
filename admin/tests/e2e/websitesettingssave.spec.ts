import { expect, test } from '@playwright/test';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('website settings save uses a result dialog and does not rewrite an unchanged website link', async ({ page, request }) => {
  const login = await request.post(`${api}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.110' },
    data: {
      email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
      password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
    }
  });
  expect(login.ok()).toBe(true);
  const { data: auth } = await login.json();

  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: []
  });

  let settingsSaved = false;
  let socialUpdated = false;
  let allowSocialToggle = false;
  await page.route(/\/song-thanh\/(?:website-settings|social-links)(?:\/[^?]+)?(?:\?|$)/, async (route) => {
    const method = route.request().method();
    if (method === 'PUT' && new URL(route.request().url()).pathname.endsWith('/website-settings')) {
      settingsSaved = true;
      const response = await route.fetch({ method: 'GET', postData: undefined });
      await route.fulfill({ response });
      return;
    }
    if ((method === 'PUT' || method === 'POST') && route.request().url().includes('/social-links')) {
      socialUpdated = true;
      if (allowSocialToggle) {
        const payload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { status: payload.status } })
        });
      } else {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return;
    }
    await route.continue();
  });

  await page.goto(`${admin}/website-settings`);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  expect(settingsSaved).toBe(true);
  expect(socialUpdated).toBe(false);
  await expect(page.getByRole('dialog', { name: 'Đã lưu cài đặt website' })).toBeVisible();
  await expect(page.getByText('Đã lưu thành công.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();

  await page.getByRole('button', { name: 'Mạng xã hội' }).click();
  const zaloIcon = page.locator('svg image[href="/admin/assets/social/zalo-logo.png"]');
  await expect(zaloIcon).toBeVisible();
  const asset = await request.get('http://localhost:3001/admin/assets/social/zalo-logo.png');
  expect(asset.ok()).toBe(true);

  const zaloSwitch = page.getByRole('switch', { name: /Zalo/ });
  const previousState = await zaloSwitch.getAttribute('aria-checked');
  allowSocialToggle = true;
  await zaloSwitch.click();
  await expect(zaloSwitch).toHaveAttribute('aria-checked', previousState === 'true' ? 'false' : 'true');
  await expect(page.getByText(/Đã bật liên kết|Đã tắt liên kết/)).toHaveCount(0);

  allowSocialToggle = false;
  await page.getByRole('button', { name: 'Thông tin công ty' }).click();
  await page.getByRole('textbox', { name: 'Website', exact: true }).fill('https://songthanh.example');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog', { name: 'Đã lưu thông tin, chưa cập nhật liên kết Website' })).toBeVisible();
});

test('missing social-link permission blocks a changed Website URL before saving settings', async ({ page, request }) => {
  const login = await request.post(`${api}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.115' },
    data: {
      email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
      password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
    }
  });
  expect(login.ok()).toBe(true);
  const { data: auth } = await login.json();
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions.filter((permission: string) => !permission.startsWith('website_settings_social_link.')),
    roles: []
  });

  let settingsSaved = false;
  await page.route(/\/auth\/me(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.data.permissions = payload.data.permissions.filter((permission: string) => !permission.startsWith('website_settings_social_link.'));
    await route.fulfill({ response, body: JSON.stringify(payload) });
  });
  await page.route(/\/song-thanh\/website-settings\/social-links\?/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { items: [] } }) });
  });
  await page.route(/\/song-thanh\/website-settings(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    settingsSaved = true;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });

  await page.goto(`${admin}/website-settings`);
  await page.getByRole('textbox', { name: 'Website', exact: true }).fill('https://songthanh.example');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog', { name: 'Kiểm tra thông tin trước khi lưu' })).toContainText('Bạn không có quyền thêm liên kết Website.');
  expect(settingsSaved).toBe(false);
});
