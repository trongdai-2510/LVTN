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
  await expect(page.getByLabel('Tên chứng nhận')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm chứng nhận' }).click();
  await expect(page.getByRole('dialog', { name: 'Thêm chứng nhận' })).toBeVisible();
  await page.getByLabel('Tên chứng nhận').fill('Chứng nhận thử');
  await page.getByRole('button', { name: 'Lưu chứng nhận' }).click();
  await expect(page.getByText('Đã thêm chứng nhận.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Chứng nhận thử/ }).click();
  await expect(page.getByRole('dialog', { name: 'Chỉnh sửa chứng nhận' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
  expect(certificate).toMatchObject({ title: 'Chứng nhận thử', status: 'active' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const width of [1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${admin}/admin/tags`);
  await expect(page.getByRole('heading', { name: 'Nhãn sản phẩm', exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên nhãn')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm nhãn' }).click();
  await expect(page.getByRole('dialog', { name: 'Tạo nhãn mới' })).toBeVisible();
  await page.getByLabel('Tên nhãn').fill('Nhãn thử');
  await page.getByRole('button', { name: 'Lửa' }).click();
  await page.getByRole('button', { name: 'Vàng hổ phách' }).click();
  await page.getByRole('button', { name: 'Lưu nhãn' }).click();
  await expect(page.getByText('Đã tạo nhãn.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Nhãn thử/ }).click();
  await expect(page.getByRole('dialog', { name: 'Chỉnh sửa nhãn' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
  expect(tag).toMatchObject({ name: 'Nhãn thử', status: 'active', icon_key: 'flame', tone_key: 'amber' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const width of [1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
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

test('product editor can search, attach and remove an existing tag', async ({ page }) => {
  const productId = '6a8a5eb8-877c-4397-b2ae-2c41b0430df5';
  const tagId = '3d306efa-044d-4d43-a040-94bb058c5868';
  const tag = { id: tagId, name: 'Bán chạy', slug: 'ban-chay', icon_key: 'flame', tone_key: 'amber', status: 'active', deleted_at: null };
  let assigned: string[] = [];
  const editorPermissions = [...permissions, 'product_group.read', 'product_group.update'];
  await page.addInitScript((state) => window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state)),
    { accessToken: 'qa-token', refreshToken: 'qa-refresh', user, permissions: editorPermissions, roles: ['super_admin'] });
  await page.route(api + '/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions: editorPermissions, roles: ['super_admin'] } } });
    if (path === '/song-thanh/tags') return route.fulfill({ json: { ok: true, data: { items: [tag] } } });
    if (path === '/song-thanh/product-groups/' + productId + '/images') {
      return route.fulfill({ json: { ok: true, data: { items: [] } } });
    }
    if (path === '/song-thanh/product-groups/' + productId + '/tags') {
      if (route.request().method() === 'PUT') assigned = (route.request().postDataJSON() as { tag_ids: string[] }).tag_ids;
      return route.fulfill({ json: { ok: true, data: { items: assigned.includes(tagId) ? [tag] : [] } } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
  await page.goto(admin + '/admin/product-groups/' + productId);
  await expect(page.getByRole('heading', { name: 'Nhãn sản phẩm', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Tìm hoặc tạo nhãn' }).fill('Bán');
  await page.getByRole('button', { name: 'Bán chạy' }).click();
  await expect(page.getByRole('button', { name: 'Gỡ nhãn Bán chạy' })).toBeVisible();
  expect(assigned).toEqual([tagId]);
  await page.getByRole('button', { name: 'Gỡ nhãn Bán chạy' }).click();
  await expect(page.getByText('Sản phẩm này chưa có nhãn.')).toBeVisible();
  expect(assigned).toEqual([]);
});
