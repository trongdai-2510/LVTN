import { expect, test } from '@playwright/test';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('brand page save uses one result dialog rather than inline success text', async ({ page, request }) => {
  const login = await request.post(`${api}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.114' },
    data: {
      email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
      password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
    }
  });
  expect(login.ok()).toBe(true);
  const { data: auth } = await login.json();
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const list = await request.get(`${api}/song-thanh/brand-pages?page=1&page_size=100&page_status=all`, { headers });
  expect(list.ok()).toBe(true);
  const { data: rows } = await list.json();
  const pageId = String(rows.items?.find((item: { page_id?: string; deleted_at?: string | null }) => item.page_id && !item.deleted_at)?.page_id ?? '');
  expect(pageId).not.toBe('');
  const detail = await request.get(`${api}/song-thanh/brand-pages/${pageId}`, { headers });
  expect(detail.ok()).toBe(true);
  const detailBody = await detail.text();

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
  let archived = false;
  await page.route(new RegExp(`/song-thanh/brand-pages/${pageId}(?:\\?|$)`), async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    saved = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: detailBody });
  });
  await page.route(new RegExp(`/song-thanh/brand-pages/${pageId}/archive(?:\\?|$)`), async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    archived = true;
    const payload = JSON.parse(detailBody);
    payload.data.brand_page.deleted_at = new Date().toISOString();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });

  await page.goto(`${admin}/page-contents/brand-pages/${pageId}`);
  await page.getByRole('button', { name: 'Lưu trang' }).click();
  expect(saved).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Đã lưu trang thương hiệu' })).toBeVisible();
  await expect(page.getByText('Đã lưu trang thương hiệu.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
  await page.getByRole('button', { name: 'Lưu trữ', exact: true }).click();
  await page.getByRole('dialog', { name: 'Lưu trữ trang thương hiệu?' }).getByRole('button', { name: 'Lưu trữ' }).click();
  expect(archived).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Đã lưu trữ trang thương hiệu' })).toBeVisible();
  await page.getByRole('button', { name: 'Về danh sách' }).click();
  await expect(page).toHaveURL(`${admin}/page-contents/brand-pages`);
});
