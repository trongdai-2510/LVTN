import { expect, test } from '@playwright/test';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('saving the homepage confirms the result in a dialog instead of an inline message', async ({ page, request }) => {
  const login = await request.post(`${api}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.113' },
    data: {
      email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
      password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
    }
  });
  expect(login.ok()).toBe(true);
  const { data: auth } = await login.json();
  const current = await request.get(`${api}/song-thanh/home-page`, {
    headers: { Authorization: `Bearer ${auth.access_token}` }
  });
  expect(current.ok()).toBe(true);
  const currentBody = await current.text();

  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: []
  });

  let saved = false;
  await page.route(/\/song-thanh\/home-page(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    saved = true;
    const payload = JSON.parse(currentBody);
    payload.data.seo.title = 'Trang chủ thử nghiệm';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });

  await page.goto(`${admin}/home-page`);
  await page.getByRole('textbox', { name: 'Tiêu đề tìm kiếm' }).fill('Trang chủ thử nghiệm');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  expect(saved).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Đã lưu trang chủ' })).toBeVisible();
  await expect(page.getByText('Đã lưu trang chủ.', { exact: true })).toHaveCount(0);
});
