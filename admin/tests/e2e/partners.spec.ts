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
  await expect(page.getByLabel('Tên đối tác')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm đối tác đầu tiên' }).click();
  await expect(page.getByRole('dialog', { name: 'Thêm đối tác' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm đối tác', exact: true }).click();
  await page.getByRole('dialog', { name: 'Thêm đối tác' }).getByRole('button', { name: 'Chọn ảnh' }).click();
  await expect(page.getByRole('dialog', { name: 'Chọn ảnh' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Chọn ảnh' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Thêm đối tác' })).toBeVisible();
  await page.getByLabel('Tên đối tác').fill('Đối tác thử nghiệm');
  await page.getByLabel('Website đối tác').fill('https://example.com');
  await page.getByRole('button', { name: 'Lưu đối tác' }).click();
  await expect(page.getByText('Đã thêm đối tác.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Đối tác thử nghiệm/ })).toBeVisible();
  await page.getByRole('button', { name: /Đối tác thử nghiệm/ }).click();
  await expect(page.getByRole('dialog', { name: 'Chỉnh sửa đối tác' })).toBeVisible();
  await expect(page.getByLabel('Tên đối tác')).toHaveValue('Đối tác thử nghiệm');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng' }).click();
  expect(saved).toMatchObject({ name: 'Đối tác thử nghiệm', website_url: 'https://example.com', status: 'active' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  for (const width of [1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('selecting a new partner logo keeps the unsaved editor open', async ({ page }) => {
  let saves = 0;
  let uploads = 0;
  let slowRecheck = false;
  await page.addInitScript((state) => window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state)),
    { accessToken: 'partner-qa-token', refreshToken: 'partner-qa-refresh', user, permissions: [...permissions, 'file.create'], roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') {
      if (slowRecheck) await new Promise((resolve) => setTimeout(resolve, 250));
      return route.fulfill({ json: { ok: true, data: { user, permissions: [...permissions, 'file.create'], roles: ['super_admin'] } } });
    }
    if (path === '/song-thanh/partners' && route.request().method() === 'GET') return route.fulfill({ json: { ok: true, data: { items: [] } } });
    if (path === '/song-thanh/partners' && route.request().method() === 'POST') saves += 1;
    if (path === '/song-thanh/files/upload') { uploads += 1; return route.fulfill({ json: { ok: true, data: { file: { id: 'qa-logo', original_filename: 'logo.png', mime_type: 'image/png' } } } }); }
    if (path === '/song-thanh/files/qa-logo') return route.fulfill({ json: { ok: true, data: { file: { id: 'qa-logo', original_filename: 'logo.png', mime_type: 'image/png' } } } });
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
  await page.goto(`${adminUrl}/admin/partners`);
  await page.getByRole('button', { name: 'Thêm đối tác', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Thêm đối tác' });
  await editor.getByLabel('Tên đối tác').fill('Đang nhập đối tác');
  await editor.getByRole('button', { name: 'Tải ảnh mới' }).click();
  const upload = page.getByRole('dialog', { name: 'Tải ảnh mới' });
  await expect(upload).toBeVisible();
  expect(await upload.locator('form').count()).toBe(0);
  slowRecheck = true;
  const recheck = page.waitForResponse((response) => new URL(response.url()).pathname === '/auth/me');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(upload).toBeVisible();
  await expect(editor.getByLabel('Tên đối tác')).toHaveValue('Đang nhập đối tác');
  await recheck;
  await expect(upload).toBeVisible();
  await expect(editor.getByLabel('Tên đối tác')).toHaveValue('Đang nhập đối tác');
  const fileChooser = page.waitForEvent('filechooser');
  await upload.locator('[data-file-upload-input]').click();
  await (await fileChooser).setFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64') });
  await expect(upload).toContainText('logo.png');
  await expect(editor.getByLabel('Tên đối tác')).toHaveValue('Đang nhập đối tác');
  expect(saves).toBe(0);
  await upload.locator('[data-file-upload-submit]').click();
  await expect(upload).toHaveCount(0);
  await expect(editor).toBeVisible();
  await expect(editor).toContainText('logo.png');
  await expect(editor.getByLabel('Tên đối tác')).toHaveValue('Đang nhập đối tác');
  expect(saves).toBe(0);
  expect(uploads).toBe(1);
  await editor.getByRole('button', { name: 'Tải ảnh mới' }).click();
  const invalidUpload = page.getByRole('dialog', { name: 'Tải ảnh mới' });
  const invalidChooser = page.waitForEvent('filechooser');
  await invalidUpload.locator('[data-file-upload-input]').click();
  await (await invalidChooser).setFiles({ name: 'wrong.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n') });
  await invalidUpload.locator('[data-file-upload-submit]').click();
  await expect(invalidUpload).toContainText('Định dạng tệp không phù hợp');
  await expect(editor).toBeVisible();
  expect(uploads).toBe(1);
});

test('partner editor suggests a free order and rejects an occupied one', async ({ page }) => {
  let saves = 0;
  await page.addInitScript((state) => window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state)),
    { accessToken: 'partner-qa-token', refreshToken: 'partner-qa-refresh', user, permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions, roles: ['super_admin'] } } });
    if (path === '/song-thanh/partners' && route.request().method() === 'GET') return route.fulfill({ json: { ok: true, data: { items: [
      { id: 'a', name: 'A', sort_order: 0, status: 'inactive', deleted_at: null },
      { id: 'b', name: 'B', sort_order: 2, status: 'active', deleted_at: null }
    ] } } });
    if (path === '/song-thanh/partners' && route.request().method() === 'POST') saves += 1;
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
  await page.goto(`${adminUrl}/admin/partners`);
  await page.getByRole('button', { name: 'Thêm đối tác', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Thêm đối tác' });
  await expect(editor.getByLabel('Thứ tự hiển thị')).toHaveValue('1');
  await editor.getByLabel('Tên đối tác').fill('C');
  await editor.getByLabel('Thứ tự hiển thị').fill('2');
  await editor.getByRole('button', { name: 'Lưu đối tác' }).click();
  await expect(editor.getByRole('alert')).toContainText('đã được dùng');
  expect(saves).toBe(0);
});
