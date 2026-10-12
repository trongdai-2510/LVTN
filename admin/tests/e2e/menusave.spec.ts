import { expect, test } from '@playwright/test';
import { getQaAuth } from './qaAuth';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('saving a menu reports success in a dialog and offers a return to the list', async ({ page, request }) => {
  const auth = await getQaAuth(request, api);
  const authorization = { Authorization: `Bearer ${auth.access_token}` };
  const menusResponse = await request.get(`${api}/song-thanh/menus?page=1&page_size=20`, {
    headers: authorization
  });
  expect(menusResponse.ok()).toBe(true);
  const { data: menus } = await menusResponse.json();
  const menuId = String(menus.items?.[0]?.id ?? '');
  expect(menuId).not.toBe('');
  const detailResponse = await request.get(`${api}/song-thanh/menus/${menuId}?item_deleted_scope=active`, {
    headers: authorization
  });
  expect(detailResponse.ok()).toBe(true);
  const detailBody = await detailResponse.text();

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
  let previewFooter = false;
  let createdGroup: Record<string, unknown> | null = null;
  await page.route(new RegExp(`/song-thanh/menus/${menuId}(?:\\?|$)`), async (route) => {
    if (route.request().method() === 'GET' && previewFooter) {
      const payload = JSON.parse(detailBody);
      payload.data.menu.position = 'footer_support';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
      return;
    }
    if (route.request().method() !== 'PUT') return route.continue();
    saved = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: detailBody });
  });
  await page.route(new RegExp(`/song-thanh/menus/${menuId}/items(?:\\?|$)`), async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    createdGroup = route.request().postDataJSON();
    const payload = JSON.parse(detailBody);
    payload.data.menu.position = 'footer_support';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  await page.goto(`${admin}/menu/${menuId}`);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  expect(saved).toBe(true);
  const dialog = page.getByRole('dialog', { name: 'Đã lưu menu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Đã lưu menu', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Đã lưu cấu hình menu.')).toHaveCount(0);
  await page.screenshot({ path: '../tmp/qa-artifacts/menusave-dialog-desktop.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeInViewport();
  await page.screenshot({ path: '../tmp/qa-artifacts/menusave-dialog-mobile.png', fullPage: false });
  await dialog.getByRole('button', { name: 'Về danh sách menu' }).click();
  await expect(page).toHaveURL(`${admin}/menu`);
  await expect(page.getByRole('region', { name: 'Đầu trang' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chân trang' })).toBeVisible();

  previewFooter = true;
  await page.goto(`${admin}/menu/${menuId}`);
  await page.getByRole('button', { name: 'Thêm nhóm chân trang' }).click();
  await expect(page.getByRole('textbox', { name: 'Tên nhóm hiển thị' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Tên nhóm hiển thị' }).fill('Tài liệu kỹ thuật');
  await page.getByRole('button', { name: 'Lưu mục' }).click();
  expect(createdGroup).toMatchObject({ title: 'Tài liệu kỹ thuật', link_type: 'group' });
  await expect(page.getByRole('dialog', { name: 'Đã thêm mục menu' })).toBeVisible();
});
