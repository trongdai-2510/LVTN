import { expect, test } from '@playwright/test';

const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const permissions = ['certificate.read','certificate.create','certificate.update','certificate.archive','certificate.restore','tag.read','tag.create','tag.update','tag.archive','tag.restore'];
const user = { id: 'content-qa', email: 'content@example.com', display_name: 'Content QA' };

test('certificate and tag managers create records without horizontal overflow', async ({ page }) => {
  let certificate: Record<string, unknown> | null = null;
  let tag: Record<string, unknown> | null = null;
  await page.addInitScript((state) => window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state)),
    { accessToken: 'qa-token', refreshToken: 'qa-refresh', user, permissions, roles: ['super_admin'] });
  await page.route(`${api}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions, roles: ['super_admin'] } } });
    if (path === '/song-thanh/certificates') {
      if (route.request().method() === 'POST') certificate = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: { ok: true, data: { items: certificate ? [{ id: 'qa-certificate', ...certificate, deleted_at: null }] : [], certificate } } });
    }
    if (path === '/song-thanh/tags') {
      if (route.request().method() === 'POST') tag = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: { ok: true, data: { items: tag ? [{ id: 'qa-tag', slug: 'nhan-thu', ...tag, deleted_at: null }] : [], tag } } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${admin}/admin/certificates`);
  await expect(page.getByRole('heading', { name: 'Chứng nhận', exact: true })).toBeVisible();
  await page.getByLabel('Tên chứng nhận').fill('Chứng nhận thử');
  await page.getByRole('button', { name: 'Lưu chứng nhận' }).click();
  await expect(page.getByText('Đã thêm chứng nhận.')).toBeVisible();
  expect(certificate).toMatchObject({ title: 'Chứng nhận thử', status: 'active' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.goto(`${admin}/admin/tags`);
  await expect(page.getByRole('heading', { name: 'Nhãn sản phẩm', exact: true })).toBeVisible();
  await page.getByLabel('Tên nhãn').fill('Nhãn thử');
  await page.getByRole('button', { name: 'Lưu nhãn' }).click();
  await expect(page.getByText('Đã tạo nhãn.')).toBeVisible();
  expect(tag).toMatchObject({ name: 'Nhãn thử', status: 'active' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('certificate visibility on home and about matches public records', async ({ page, request }) => {
  const response = await request.get(`${api}/public/certificates`);
  expect(response.ok()).toBe(true);
  const certificates = (await response.json()).data.items as Array<{ id: string }>;
  for (const path of ['/', '/gioi-thieu']) {
    await page.goto(`http://localhost:3000${path}`);
    await expect(page.locator('section[aria-label="Chứng nhận của Song Thanh"]')).toHaveCount(certificates.length > 0 ? 1 : 0);
  }
});
