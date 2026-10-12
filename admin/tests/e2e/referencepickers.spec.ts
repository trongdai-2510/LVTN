import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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

test('the product relation picker shows recognizable choices without technical identifiers', async ({
  page,
  request
}) => {
  const session = await login(request);
  const project = await findProjectWithRelatedProduct(request, session.access_token);
  await seedAuth(page, session);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ADMIN_BASE_PATH}/projects/${project.id}`);

  await page.getByRole('button', { name: 'Gắn sản phẩm' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chọn nhóm sản phẩm' });
  const chooser = dialog.locator('[data-reference-chooser="true"]');
  await expect(chooser).toBeVisible();
  await expect
    .poll(async () => (await dialog.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(720);
  await expect(dialog.getByRole('searchbox', { name: 'Tìm nhóm sản phẩm' })).toBeVisible();
  await expect(dialog).not.toContainText(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );

  await dialog.getByRole('searchbox', { name: 'Tìm nhóm sản phẩm' }).fill(project.productName);
  const relatedOption = dialog.locator('[data-reference-option="true"]').filter({
    hasText: project.productName
  });
  await expect(relatedOption).toBeVisible();
  await expect(relatedOption).toHaveAttribute('aria-label', new RegExp('^Đã gắn:'));
  await expect(relatedOption).toBeDisabled();
  await expect(dialog.locator('[data-reference-pagination="true"]')).toContainText(/Trang 1\//);
  await expect(dialog.getByRole('button', { name: /^\d+$/ })).toHaveCount(0);
});

test('the shared file chooser stays usable on a 320px screen', async ({ page, request }) => {
  const session = await login(request);
  await seedAuth(page, session);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`${ADMIN_BASE_PATH}/page-contents/new?template=projects`);

  await page.getByRole('button', { name: 'Chọn ảnh' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Chọn ảnh' });
  await expect(dialog.locator('[data-reference-chooser="true"]')).toBeVisible();
  await expect(dialog.getByRole('searchbox', { name: 'Tìm ảnh' })).toBeVisible();
  await expect(dialog).not.toContainText(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );
  await expect(dialog.locator('[data-reference-pagination="true"]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    )
    .toBe(true);
});

test('the homepage manual picker makes selection order explicit', async ({ page, request }) => {
  const session = await login(request);
  await seedAuth(page, session);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${ADMIN_BASE_PATH}/home-page`);

  await page.locator('button[aria-label="Mở rộng"]').nth(4).click();
  await page.getByRole('button', { name: 'Chọn thủ công' }).click();
  await page.getByRole('button', { name: 'Chọn / Sửa danh sách' }).click();

  const dialog = page.getByRole('dialog', { name: 'Chọn sản phẩm' });
  await expect(dialog.locator('[data-home-reference-chooser="true"]')).toBeVisible();
  await expect(dialog.getByRole('searchbox', { name: 'Tìm mục để đưa lên trang chủ' })).toBeVisible();
  await expect(dialog).not.toContainText(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );

  await dialog.getByRole('button', { name: /^Chọn:/ }).first().click();
  await expect(dialog.getByRole('heading', { name: 'Đã chọn (1)' })).toBeVisible();
  await expect(dialog.locator('[data-reference-pagination="true"]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    )
    .toBe(true);

  await dialog.getByRole('button', { name: 'Hủy' }).click();
});

async function findProjectWithRelatedProduct(request: APIRequestContext, accessToken: string) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const listResponse = await request.get(
    `${API_BASE_URL}/song-thanh/projects?page=1&page_size=100&deleted_scope=active`,
    { headers }
  );
  expect(listResponse.ok()).toBe(true);
  const listItems = extractItems(await listResponse.json());

  for (const item of listItems) {
    const id = String(item.id ?? '');
    if (!id) continue;
    const detailResponse = await request.get(`${API_BASE_URL}/song-thanh/projects/${id}`, {
      headers
    });
    if (!detailResponse.ok()) continue;
    const detailPayload = extractRecord(await detailResponse.json());
    const detail = extractRecord(detailPayload.data ?? detailPayload);
    const related = Array.isArray(detail.related_product_groups)
      ? (detail.related_product_groups as RecordMap[])
      : [];
    const active = related.find((entry) => {
      const association = extractRecord(entry.association);
      return !association.deleted_at;
    });
    if (!active) continue;
    const product = extractRecord(active.product_group ?? active.productGroup ?? active);
    const productName = String(product.name ?? product.title ?? '').trim();
    if (productName) return { id, productName };
  }

  throw new Error('Không tìm thấy dự án có sản phẩm đang gắn để kiểm thử bộ chọn.');
}

function extractItems(payload: unknown): RecordMap[] {
  const record = extractRecord(payload);
  const data = extractRecord(record.data);
  const value = Array.isArray(record.items)
    ? record.items
    : Array.isArray(data.items)
      ? data.items
      : [];
  return value as RecordMap[];
}

function extractRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

function normalizeAdminBasePath(basePath: string) {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

async function seedAuth(page: Page, auth: AdminSession) {
  await page.addInitScript(
    ({ storageKey, state }) => window.sessionStorage.setItem(storageKey, JSON.stringify(state)),
    {
      storageKey: STORAGE_KEY,
      state: {
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        user: auth.user,
        permissions: auth.permissions,
        roles: auth.roles
      }
    }
  );
}

async function login(request: APIRequestContext): Promise<AdminSession> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.95' },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBe(true);
  const payload = (await response.json()) as { ok: boolean; data: Omit<AdminSession, 'roles'> };
  expect(payload.ok).toBe(true);

  const meResponse = await request.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${payload.data.access_token}` }
  });
  expect(meResponse.ok(), `Auth me failed with HTTP ${meResponse.status()}`).toBe(true);
  const mePayload = (await meResponse.json()) as { data?: RecordMap } & RecordMap;
  const meData = (mePayload.data ?? mePayload) as RecordMap;
  return {
    ...payload.data,
    roles: Array.isArray(meData.roles) ? meData.roles.map(String) : []
  };
}
