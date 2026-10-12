import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const ADMIN_BASE_PATH = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const STORAGE_KEY = 'song-thanh-admin-auth';

type RecordMap = Record<string, unknown>;
type AdminSession = {
  access_token: string;
  refresh_token: string;
  user: RecordMap;
  permissions: string[];
  roles: string[];
};

let session: AdminSession;
const createdRoleIds: string[] = [];
const createdUserIds: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  assertSafeTarget();
  session = await login(request);
});

test.afterAll(async ({ request }) => {
  if (createdUserIds.length > 0) {
    const rolesResponse = await adminRequest(request, session, 'GET', '/song-thanh/admin-users');
    const roles = unwrap(await rolesResponse.json()).available_roles;
    const viewer = Array.isArray(roles)
      ? roles.map(recordOf).find((role) => role.code === 'viewer')
      : undefined;
    if (viewer?.id) {
      for (const userId of createdUserIds) {
        await adminRequest(request, session, 'PUT', `/song-thanh/admin-users/${userId}`, {
          role_ids: [String(viewer.id)]
        }).catch(() => undefined);
      }
    }
  }
  for (const roleId of createdRoleIds) {
    await adminRequest(
      request,
      session,
      'POST',
      `/song-thanh/admin-roles/${roleId}/archive`,
      {}
    ).catch(() => undefined);
  }
});

test('login returns roles immediately so Super Admin capability is not stale', async () => {
  expect(session.roles).toContain('super_admin');
});

test('system role metadata is read-only while its permission matrix remains explicit', async ({
  page
}, testInfo) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/roles'));
  await expect(page.getByRole('heading', { name: 'Vai trò & quyền', level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Danh sách vai trò' })).toBeVisible();

  await page.getByRole('button', { name: /Content Admin/ }).click();
  await page.screenshot({ path: testInfo.outputPath('rolesWorkspace.png'), fullPage: true });
  await expect(page.getByLabel('Tên vai trò')).toHaveCount(0);
  await expect(page.getByLabel('Trạng thái').first()).toHaveCount(0);
  await expect(
    page.getByText(/Tên và mô tả của vai trò hệ thống được cấu hình cố định/)
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ma trận quyền' })).toBeVisible();
  const menuPermissions = page.locator('[data-permission-group="menu"]');
  await expect(menuPermissions.getByRole('button', { name: /Menu điều hướng/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(menuPermissions.locator('input[data-permission-code="menu.read"]')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('system audit history has usable filters and a readable mobile layout', async ({ page }, testInfo) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/audit-logs'));
  await expect(page.getByRole('heading', { name: 'Nhật ký hệ thống', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Khu vực Hệ thống' })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Hành động' })).toBeHidden();
  await page.getByRole('button', { name: 'Bộ lọc' }).click();
  await expect(page.getByRole('combobox', { name: 'Hành động' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('auditWorkspace.png'), fullPage: true });
  const firstEvent = page.getByRole('table').getByRole('link', { name: 'Xem', exact: true }).first();
  if (await firstEvent.count()) {
    await firstEvent.click();
    await expect(page.getByRole('heading', { name: 'Chi tiết hoạt động', level: 1 })).toBeVisible();
    await expect(page.getByText('Người thực hiện', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('auditDetail.png'), fullPage: true });
    await page.getByRole('link', { name: 'Nhật ký hệ thống' }).last().click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (!(await page.getByRole('combobox', { name: 'Hành động' }).isVisible())) {
    await page.getByRole('button', { name: 'Bộ lọc' }).click();
  }
  await expect(page.getByRole('combobox', { name: 'Hành động' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('permission editor automatically keeps required read access and saves a clear matrix', async ({
  page,
  request
}) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/roles'));

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await page.getByRole('button', { name: 'Tạo vai trò' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Tạo vai trò' });
  await createDialog.getByLabel('Tên vai trò').fill(`Vai trò QA ${runId}`);
  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/song-thanh/admin-roles') &&
      response.ok()
  );
  await createDialog.getByRole('button', { name: 'Tạo vai trò' }).click();
  const created = unwrap(await (await createResponse).json());
  const createdRoleId = String(recordOf(created.role).id || '');
  expect(createdRoleId).not.toBe('');
  createdRoleIds.push(createdRoleId);
  const createdDialog = page.getByRole('dialog', { name: 'Đã tạo vai trò' });
  await expect(createdDialog).toBeVisible();
  await createdDialog.getByRole('button', { name: 'Đóng' }).last().click();
  await expect(page.getByRole('heading', { name: `Vai trò QA ${runId}`, exact: true })).toBeVisible();
  await expect(page.getByText(/Vai trò chưa có quyền nên/)).toBeVisible();

  for (const payload of [{ name: null }, { status: null }]) {
    const invalid = await adminRequest(request, session, 'PUT',
      `/song-thanh/admin-roles/${createdRoleId}`, payload);
    expect(invalid.status()).toBe(400);
  }

  const createPermission = permissionCheckbox(page, 'menu_item.create');
  const readPermission = permissionCheckbox(page, 'menu.read');
  await page.locator('[data-permission-group="menu"]').getByRole('button', { name: /Menu điều hướng/ }).click();
  await createPermission.check();
  await expect(readPermission).toBeChecked();
  await expect(page.getByText('Chưa lưu: thêm 2, gỡ 0 quyền.')).toBeVisible();

  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  const confirm = page.getByRole('dialog', { name: 'Xác nhận cập nhật vai trò' });
  await expect(confirm.getByText(/thêm 2, gỡ 0/)).toBeVisible();
  await confirm.getByRole('button', { name: 'Lưu thay đổi' }).click();
  const savedDialog = page.getByRole('dialog', { name: 'Đã lưu vai trò và quyền' });
  await expect(savedDialog).toBeVisible();
  await savedDialog.getByRole('button', { name: 'Đóng' }).last().click();

  const detailResponse = await adminRequest(
    request,
    session,
    'GET',
    `/song-thanh/admin-roles/${createdRoleId}`
  );
  expect(detailResponse.ok()).toBe(true);
  const detail = unwrap(await detailResponse.json());
  const codes = Array.isArray(detail.assigned_permission_codes)
    ? detail.assigned_permission_codes.map(String)
    : [];
  expect(codes).toEqual(expect.arrayContaining(['menu.read', 'menu_item.create']));

  const unsavedPermission = permissionCheckbox(page, 'menu.create');
  await unsavedPermission.check();
  await page.getByLabel('Tìm vai trò').fill('vai-tro-khong-ton-tai');
  await expect(page.getByRole('heading', { name: `Vai trò QA ${runId}`, exact: true })).toBeVisible();
  await expect(unsavedPermission).toBeChecked();
  await page.getByLabel('Tìm vai trò').clear();
  await unsavedPermission.uncheck();
});

test('user assignment explains Super Admin impact before saving', async ({ page }) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/users'));
  await page.getByRole('button', { name: 'Tạo người dùng' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo người dùng' });
  const role = dialog.getByRole('combobox', { name: 'Vai trò' });
  await role.selectOption({ label: 'Super Admin' });
  await expect(
    dialog.getByText(/Toàn quyền hệ thống. Chỉ Super Admin được gán hoặc gỡ vai trò này/)
  ).toBeVisible();
  await expect(dialog.getByText(/118 quyền/)).toBeVisible();
});

test('an existing token follows role changes and cannot reach unauthorized API routes', async ({ request, page }) => {
  const runId = Date.now();
  const roleResponse = await adminRequest(request, session, 'POST', '/song-thanh/admin-roles', {
    name: `Vai trò QA ${runId}-access`
  });
  expect(roleResponse.ok()).toBe(true);
  const accessRoleId = String(recordOf(unwrap(await roleResponse.json()).role).id);
  createdRoleIds.push(accessRoleId);
  expect((await adminRequest(request, session, 'PUT',
    `/song-thanh/admin-roles/${accessRoleId}/permissions`,
    { permission_codes: ['menu.read', 'menu_item.create'] })).ok()).toBe(true);

  const identity = `QA Role Access ${runId}`;
  const email = `qa-role-access-${runId}@songthanh.local`;
  const optionsResponse = await adminRequest(request, session, 'GET', '/song-thanh/admin-users');
  const options = unwrap(await optionsResponse.json()).available_roles;
  const viewer = (Array.isArray(options) ? options : [])
    .map(recordOf).find((role) => role.code === 'viewer');
  expect(viewer?.id).toBeTruthy();
  const invalidAssignment = await adminRequest(request, session, 'POST', '/song-thanh/admin-users', {
    display_name: identity,
    email,
    role_ids: [accessRoleId, String(viewer?.id)]
  });
  expect(invalidAssignment.status()).toBe(400);
  const createResponse = await adminRequest(request, session, 'POST', '/song-thanh/admin-users', {
    display_name: identity,
    email,
    role_ids: [accessRoleId]
  });
  expect(createResponse.ok()).toBe(true);
  const created = unwrap(await createResponse.json());
  const createdUserId = String(recordOf(created.user).id);
  createdUserIds.push(createdUserId);
  const password = String(created.temporary_password);
  const userResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.222' },
    data: { email, password }
  });
  expect(userResponse.ok()).toBe(true);
  const userSession = unwrap(await userResponse.json()) as unknown as AdminSession;
  expect(userSession.permissions).toEqual(expect.arrayContaining(['menu.read', 'menu_item.create']));
  expect(userSession.roles).toHaveLength(1);
  expect(userSession.roles).not.toContain('viewer');
  const refreshAttempts = await Promise.all([
    request.post(`${API_BASE_URL}/auth/refresh`, {
      data: { refresh_token: userSession.refresh_token }
    }),
    request.post(`${API_BASE_URL}/auth/refresh`, {
      data: { refresh_token: userSession.refresh_token }
    })
  ]);
  expect(refreshAttempts.map((response) => response.status()).sort()).toEqual([201, 401]);
  const rotatedResponse = refreshAttempts.find((response) => response.ok());
  expect(rotatedResponse).toBeTruthy();
  const rotatedSession = unwrap(await rotatedResponse!.json()) as unknown as AdminSession;
  await seedAuth(page, userSession);
  for (const route of ['/roles', '/users']) {
    await page.goto(adminPath(route));
    await expect(page.getByRole('heading', { name: 'Không đủ quyền truy cập' })).toBeVisible();
  }
  expect((await adminRequest(request, userSession, 'GET', '/song-thanh/menus')).status()).toBe(200);
  expect((await adminRequest(request, userSession, 'GET', '/song-thanh/admin-roles')).status()).toBe(403);
  expect((await adminRequest(request, session, 'POST',
    `/song-thanh/admin-roles/${accessRoleId}/archive`, {})).status()).toBe(409);

  const allowedAction = await adminRequest(request, userSession, 'POST',
    '/song-thanh/menus/00000000-0000-4000-8000-000000000000/items', {});
  expect(allowedAction.status()).not.toBe(403);

  const clearResponse = await adminRequest(
    request,
    session,
    'PUT',
    `/song-thanh/admin-roles/${accessRoleId}/permissions`,
    { permission_codes: [] }
  );
  expect(clearResponse.ok()).toBe(true);
  expect((await adminRequest(request, userSession, 'GET', '/song-thanh/menus')).status()).toBe(403);
  expect((await adminRequest(request, userSession, 'POST',
    '/song-thanh/menus/00000000-0000-4000-8000-000000000000/items', {})).status()).toBe(403);
  expect((await adminRequest(request, session, 'PUT',
    `/song-thanh/admin-roles/${accessRoleId}/permissions`,
    { permission_codes: ['menu.read', 'menu_item.create'] })).ok()).toBe(true);

  const nullRolesResponse = await adminRequest(
    request,
    session,
    'PUT',
    `/song-thanh/admin-users/${createdUserId}`,
    { role_ids: null }
  );
  expect(nullRolesResponse.status()).toBe(400);
  for (const payload of [{ display_name: null }, { email: null }, { status: null }]) {
    const invalid = await adminRequest(request, session, 'PUT',
      `/song-thanh/admin-users/${createdUserId}`, payload);
    expect(invalid.status()).toBe(400);
  }
  const nullPasswordResponse = await adminRequest(request, session, 'POST',
    `/song-thanh/admin-users/${createdUserId}/reset-password`, { new_password: null });
  expect(nullPasswordResponse.status()).toBe(400);

  const newPassword = `ResetQA${Date.now()}!`;
  const resetResponse = await adminRequest(request, session, 'POST',
    `/song-thanh/admin-users/${createdUserId}/reset-password`,
    { new_password: newPassword }
  );
  expect(resetResponse.ok()).toBe(true);
  expect((await adminRequest(request, userSession, 'GET', '/song-thanh/menus')).status()).toBe(401);
  expect((await request.post(`${API_BASE_URL}/auth/refresh`, {
    data: { refresh_token: rotatedSession.refresh_token }
  })).status()).toBe(401);
  const oldPasswordResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.224' },
    data: { email, password }
  });
  expect(oldPasswordResponse.status()).toBe(401);
  const newPasswordResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.225' },
    data: { email, password: newPassword }
  });
  expect(newPasswordResponse.ok()).toBe(true);
  const renewedSession = unwrap(await newPasswordResponse.json()) as unknown as AdminSession;
  expect((await adminRequest(request, renewedSession, 'GET', '/song-thanh/menus')).status()).toBe(200);
  const changedPassword = `ChangedQA${Date.now()}!`;
  const changeResponse = await adminRequest(request, renewedSession, 'POST',
    '/auth/change-password',
    { current_password: newPassword, new_password: changedPassword }
  );
  expect(changeResponse.ok()).toBe(true);
  expect((await request.post(`${API_BASE_URL}/auth/refresh`, {
    data: { refresh_token: renewedSession.refresh_token }
  })).status()).toBe(401);
  const changedLoginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.226' },
    data: { email, password: changedPassword }
  });
  expect(changedLoginResponse.ok()).toBe(true);
  const changedSession = unwrap(await changedLoginResponse.json()) as unknown as AdminSession;
  expect((await adminRequest(request, changedSession, 'GET', '/song-thanh/menus')).status()).toBe(200);
  expect((await adminRequest(request, session, 'POST',
    `/song-thanh/admin-users/${createdUserId}/status`, { status: 'locked' })).ok()).toBe(true);
  expect((await adminRequest(request, changedSession, 'GET', '/song-thanh/menus')).status()).toBe(403);
  expect((await adminRequest(request, session, 'POST',
    `/song-thanh/admin-users/${createdUserId}/status`, { status: 'active' })).ok()).toBe(true);
  expect((await adminRequest(request, changedSession, 'GET', '/song-thanh/menus')).status()).toBe(401);

  expect((await adminRequest(request, session, 'PUT',
    `/song-thanh/admin-users/${createdUserId}`,
    { role_ids: [String(viewer?.id)] })).ok()).toBe(true);
  expect((await adminRequest(request, session, 'POST',
    `/song-thanh/admin-roles/${accessRoleId}/archive`, {})).ok()).toBe(true);
  expect((await adminRequest(request, session, 'GET',
    `/song-thanh/admin-roles/${accessRoleId}`)).status()).toBe(404);
});

test('Super Admin can edit own profile but cannot disable the active account', async ({ page, request }) => {
  const userId = String(session.user.id);
  const statusResponse = await adminRequest(
    request,
    session,
    'POST',
    `/song-thanh/admin-users/${userId}/status`,
    { status: 'locked' }
  );
  expect(statusResponse.status()).toBe(409);
  await seedAuth(page, session);
  await page.goto(adminPath('/users'));
  const ownAccount = page.getByRole('article').filter({ hasText: String(session.user.email) });
  await ownAccount.getByRole('button', { name: 'Sửa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chỉnh sửa người dùng' });
  await expect(dialog.getByLabel('Họ tên')).toBeEnabled();
  await expect(dialog.getByLabel('Trạng thái')).toBeDisabled();
  await expect(dialog.getByRole('combobox', { name: 'Vai trò' })).toBeDisabled();
  await page.route(`**/song-thanh/admin-users/${userId}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: {
          code: 'ADMIN_USER_CHANGED_DURING_EDIT',
          message: 'Tài khoản vừa thay đổi. Hãy tải lại trước khi lưu.'
        }
      })
    });
  });
  await dialog.getByLabel('Họ tên').fill(`${String(session.user.display_name)} QA`);
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog.getByRole('heading', { name: 'Tài khoản đã được cập nhật ở nơi khác' })).toBeVisible();
});

test('reserved system write codes cannot be delegated and a reader cannot manage accounts', async ({ request }) => {
  const runId = Date.now();
  const roleResponse = await adminRequest(request, session, 'POST', '/song-thanh/admin-roles', {
    name: `Vai trò QA guard ${runId}`
  });
  expect(roleResponse.ok()).toBe(true);
  const managerRoleId = String(recordOf(unwrap(await roleResponse.json()).role).id);
  createdRoleIds.push(managerRoleId);
  const reservedPermissions = [
    'admin_user.read', 'admin_user.create', 'admin_user.update',
    'admin_user.manage_status', 'admin_user.reset_password',
    'admin_role.read', 'admin_role.create', 'admin_role.update',
    'admin_role.manage_permissions', 'admin_role.archive'
  ];
  const reservedResponse = await adminRequest(request, session, 'PUT',
    `/song-thanh/admin-roles/${managerRoleId}/permissions`,
    { permission_codes: reservedPermissions }
  );
  expect(reservedResponse.status()).toBe(400);
  const managerPermissions = ['admin_user.read', 'admin_role.read'];
  expect((await adminRequest(request, session, 'PUT',
    `/song-thanh/admin-roles/${managerRoleId}/permissions`,
    { permission_codes: managerPermissions }
  )).ok()).toBe(true);

  const email = `qa-role-guard-${runId}@songthanh.local`;
  const userResponse = await adminRequest(request, session, 'POST', '/song-thanh/admin-users', {
    display_name: `QA Role Guard ${runId}`,
    email,
    role_ids: [managerRoleId]
  });
  expect(userResponse.ok()).toBe(true);
  const user = unwrap(await userResponse.json());
  const managerUserId = String(recordOf(user.user).id);
  createdUserIds.push(managerUserId);
  const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.223' },
    data: { email, password: user.temporary_password }
  });
  expect(loginResponse.ok()).toBe(true);
  const delegatedSession = unwrap(await loginResponse.json()) as unknown as AdminSession;
  const roleList = unwrap(await (await adminRequest(request, session, 'GET', '/song-thanh/admin-users')).json());
  const viewer = (Array.isArray(roleList.available_roles) ? roleList.available_roles : [])
    .map(recordOf).find((role) => role.code === 'viewer');
  expect(viewer?.id).toBeTruthy();
  const delegatedList = unwrap(await (await adminRequest(request, delegatedSession, 'GET', '/song-thanh/admin-users')).json());
  expect((Array.isArray(delegatedList.available_roles) ? delegatedList.available_roles : [])
    .map(recordOf).every((role) => role.can_assign === false)).toBe(true);

  const grantResponse = await adminRequest(request, delegatedSession, 'POST', '/song-thanh/admin-users', {
    display_name: `QA Escalation ${runId}`,
    email: `qa-escalation-${runId}@songthanh.local`,
    role_ids: [String(viewer?.id)]
  });
  expect(grantResponse.status()).toBe(403);
  expect(recordOf(recordOf(await grantResponse.json()).error).code).toBe('PERMISSION_DENIED');

  const matrixResponse = await adminRequest(request, delegatedSession, 'PUT',
    `/song-thanh/admin-roles/${managerRoleId}/permissions`,
    { permission_codes: [...managerPermissions, 'product_group.read'] }
  );
  expect(matrixResponse.status()).toBe(403);
  expect(recordOf(recordOf(await matrixResponse.json()).error).code).toBe('PERMISSION_DENIED');

  const ownUpdate = await adminRequest(request, delegatedSession, 'PUT',
    `/song-thanh/admin-users/${managerUserId}`,
    { display_name: `QA Role Guard Updated ${runId}` }
  );
  expect(ownUpdate.status()).toBe(403);
  for (const [method, path, body] of [
    ['POST', '/song-thanh/admin-roles', { name: `Denied ${runId}` }],
    ['PUT', `/song-thanh/admin-roles/${managerRoleId}`, { name: `Denied ${runId}` }],
    ['POST', `/song-thanh/admin-roles/${managerRoleId}/archive`, {}],
    ['POST', `/song-thanh/admin-users/${managerUserId}/status`, { status: 'locked' }],
    ['POST', `/song-thanh/admin-users/${managerUserId}/reset-password`, {}]
  ] as const) {
    const response = await adminRequest(request, delegatedSession, method, path, body);
    expect(response.status()).toBe(403);
    expect(recordOf(recordOf(await response.json()).error).code).toBe('PERMISSION_DENIED');
  }
  expect((await adminRequest(request, delegatedSession, 'GET', '/song-thanh/admin-users')).status()).toBe(200);
});

test('role and user management remain usable on a narrow screen', async ({ page }) => {
  await seedAuth(page, session);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(adminPath('/roles'));
  await expect(page.getByRole('heading', { name: 'Vai trò & quyền', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo vai trò' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto(adminPath('/users'));
  await expect(page.getByRole('heading', { name: 'Tài khoản quản trị', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo người dùng' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('role and user workspaces meet WCAG A and AA checks', async ({ page }) => {
  await seedAuth(page, session);
  for (const route of ['/roles', '/users']) {
    await page.goto(adminPath(route));
    const workspace = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(workspace.violations, `${route}: ${workspace.violations.map(
      (violation) => `${violation.id} (${violation.nodes.length})`
    ).join(', ')}`).toEqual([]);
    await page.getByRole('button', {
      name: route === '/roles' ? 'Tạo vai trò' : 'Tạo người dùng'
    }).click();
    const dialog = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(dialog.violations, `${route} dialog: ${dialog.violations.map(
      (violation) => `${violation.id} (${violation.nodes.length})`
    ).join(', ')}`).toEqual([]);
  }
});

function permissionCheckbox(page: Page, code: string) {
  return page.locator('input[data-permission-code="' + code + '"]');
}

function normalizeAdminBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminPath(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${ADMIN_BASE_PATH}${normalized}`;
}

function recordOf(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

function unwrap(value: unknown): RecordMap {
  const record = recordOf(value);
  return 'data' in record ? recordOf(record.data) : record;
}

async function login(request: APIRequestContext): Promise<AdminSession> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.221' },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBe(true);
  const payload = unwrap(await response.json());
  return payload as unknown as AdminSession;
}

async function seedAuth(page: Page, state: AdminSession): Promise<void> {
  await page.addInitScript(
    ({ storageKey, value }) =>
      window.sessionStorage.setItem(storageKey, JSON.stringify(value)),
    {
      storageKey: STORAGE_KEY,
      value: {
        accessToken: state.access_token,
        refreshToken: state.refresh_token,
        user: state.user,
        permissions: state.permissions,
        roles: state.roles
      }
    }
  );
}

function adminRequest(
  request: APIRequestContext,
  currentSession: AdminSession,
  method: 'GET' | 'POST' | 'PUT',
  pathname: string,
  data?: RecordMap
) {
  return request.fetch(`${API_BASE_URL}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${currentSession.access_token}` },
    data
  });
}

function assertSafeTarget(): void {
  const hostname = new URL(API_BASE_URL).hostname;
  if (
    !['localhost', '127.0.0.1', '::1'].includes(hostname) &&
    process.env.ALLOW_QA_MUTATIONS !== '1'
  ) {
    throw new Error(`Refusing to mutate non-local API ${API_BASE_URL}.`);
  }
}
