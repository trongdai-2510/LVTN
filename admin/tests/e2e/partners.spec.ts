import { expect, test } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const permissions = ['partner.read', 'partner.create', 'partner.update', 'partner.archive', 'partner.restore'];
const user = { id: 'partner-qa', email: 'partner@example.com', display_name: 'Partner QA' };

test('partner manager handles an empty list, a new partner and mobile layout', async ({ page }) => {
  let saved: Record<string, unknown> | null = null;
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'partner-qa-token', refreshToken: 'partner-qa-refresh', user, permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') {
      return route.fulfill({ json: { ok: true, data: { user, permissions, roles: ['super_admin'] } } });
    }
    if (path === '/song-thanh/partners' && route.request().method() === 'GET') {
      return route.fulfill({ json: { ok: true, data: { items: saved ? [{ id: 'qa-partner', ...saved, deleted_at: null }] : [] } } });
    }
    if (path === '/song-thanh/partners' && route.request().method() === 'POST') {
      saved = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({ json: { ok: true, data: { partner: { id: 'qa-partner', ...saved, deleted_at: null } } } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${adminUrl}/admin/partners`);
  await expect(page.getByRole('heading', { name: 'Đối tác', exact: true })).toBeVisible();
  await expect(page.getByText('Chưa có đối tác.')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm đối tác đầu tiên' }).click();
  await page.getByLabel('Tên đối tác').fill('Đối tác thử nghiệm');
  await page.getByLabel('Website đối tác').fill('https://example.com');
  await page.getByRole('button', { name: 'Lưu đối tác' }).click();
  await expect(page.getByText('Đã thêm đối tác.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Đối tác thử nghiệm/ })).toBeVisible();
  expect(saved).toMatchObject({ name: 'Đối tác thử nghiệm', website_url: 'https://example.com', status: 'active' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const width of [1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
