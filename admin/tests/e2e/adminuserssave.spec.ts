import { expect, test } from '@playwright/test';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('editing a user confirms the save in a dialog instead of inside the form', async ({ page, request }) => {
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
    permissions: auth.permissions,
    roles: auth.roles
  });

  let saved = false;
  await page.route(new RegExp(`/song-thanh/admin-users/${auth.user.id}(?:\\?|$)`), async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    saved = true;
    const response = await route.fetch({ method: 'GET', postData: undefined });
    await route.fulfill({ response });
  });

  await page.goto(`${admin}/users`);
  const account = page.getByRole('article').filter({ hasText: String(auth.user.email) });
  await account.getByRole('button', { name: 'Sửa' }).click();
  const editor = page.getByRole('dialog', { name: 'Chỉnh sửa người dùng' });
  const name = editor.getByLabel('Họ tên');
  await name.fill(`${await name.inputValue()} QA`);
  await editor.getByRole('button', { name: 'Lưu thay đổi' }).click();
  expect(saved).toBe(true);
  await expect(page.getByRole('dialog', { name: 'Đã cập nhật người dùng' })).toBeVisible();
  await expect(editor).toHaveCount(0);
});

test('a generated temporary password is shown once in the creation result', async ({ page, request }) => {
  const login = await request.post(`${api}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.116' },
    data: {
      email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
      password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
    }
  });
  expect(login.ok()).toBe(true);
  const { data: auth } = await login.json();
  const detail = await request.get(`${api}/song-thanh/admin-users/${auth.user.id}`, {
    headers: { Authorization: `Bearer ${auth.access_token}` }
  });
  expect(detail.ok()).toBe(true);
  const detailBody = await detail.json();
  detailBody.data.temporary_password = 'QaTemporary123!';
  detailBody.data.user.display_name = 'QA Temporary';
  detailBody.data.user.email = 'qa-temporary@example.invalid';

  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: auth.roles
  });

  let created = false;
  await page.route(/\/song-thanh\/admin-users(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    created = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detailBody) });
  });

  await page.goto(`${admin}/users`);
  await page.getByRole('button', { name: 'Tạo người dùng' }).click();
  const editor = page.getByRole('dialog', { name: 'Tạo người dùng', exact: true });
  await editor.getByLabel('Họ tên').fill('QA Temporary');
  await editor.getByLabel('Email').fill('qa-temporary@example.invalid');
  await editor.getByRole('combobox', { name: 'Vai trò' }).selectOption({ label: 'Viewer' });
  await editor.getByRole('button', { name: 'Tạo người dùng' }).click();
  expect(created).toBe(true);
  const result = page.getByRole('dialog', { name: 'Đã tạo người dùng' });
  await expect(result.getByText('Mật khẩu tạm: QaTemporary123!')).toBeVisible();
  await expect(editor).toHaveCount(0);
  await result.getByRole('button', { name: 'Đóng' }).last().click();
  await expect(page.getByText('QaTemporary123!')).toHaveCount(0);
});
