import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  filterRowsByExportDateRange,
  validateExportDateRange
} from '../../src/features/import-workspace/exportDateRange';

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

test('date range validation is inclusive and rejects a reversed range', () => {
  expect(validateExportDateRange({ from: '2026-09-01', to: '2026-09-30' })).toBe('');
  expect(validateExportDateRange({ from: '2026-09-30', to: '2026-09-01' })).toContain(
    'Ngày bắt đầu'
  );

  const rows = [
    { id: 'before', updated_at: '2026-08-31T12:00:00' },
    { id: 'start', updated_at: '2026-09-01T00:00:00' },
    { id: 'end', updated_at: '2026-09-30T23:59:59' },
    { id: 'after', updated_at: '2026-10-01T12:00:00' },
    { id: 'undated' }
  ];

  expect(
    filterRowsByExportDateRange(rows, {
      field: 'updated_at',
      from: '2026-09-01',
      to: '2026-09-30'
    }).map((row) => row.id)
  ).toEqual(['start', 'end']);
});

test('service and project editors use one full-width editing flow', async ({ page, request }) => {
  const session = await login(request);
  await seedAuth(page, session);
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const kind of ['services', 'projects'] as const) {
    const id = await firstRecordId(request, session, kind);
    await page.goto(`${ADMIN_BASE_PATH}/${kind}/${id}`);

    const editor = page.locator('[data-domain-editor="true"]');
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('data-domain-editor-layout', 'single-column');
    await expect(editor.locator('aside')).toHaveCount(0);
    await expect(editor.locator('[data-domain-editor-commandbar="true"]')).toBeVisible();
    await expect(editor.locator('[data-domain-editor-commandbar="true"]')).toHaveCSS(
      'position',
      'sticky'
    );
    await expect(editor.locator('[data-domain-editor-media="true"]')).toBeVisible();
    await expect(
      editor.locator('[data-domain-editor-commandbar="true"]')
    ).toContainText('Đã lưu đồng bộ');

    const title = page.getByLabel(kind === 'services' ? 'Tên dịch vụ' : 'Tên dự án');
    const originalTitle = await title.inputValue();
    await title.fill(`${originalTitle} kiểm tra`);
    await expect(
      editor.locator('[data-domain-editor-commandbar="true"]')
    ).toContainText('Có thay đổi chưa lưu');
    await title.fill(originalTitle);
    await expect(
      editor.locator('[data-domain-editor-commandbar="true"]')
    ).toContainText('Đã lưu đồng bộ');
  }
});

test('import workspace prioritizes the next action and supports a custom export date range', async ({
  page,
  request
}) => {
  const session = await login(request);
  await seedAuth(page, session);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ADMIN_BASE_PATH}/import`);

  await expect(page.getByText('Dễ hiểu nhất:')).toHaveCount(0);
  await expect(page.locator('[data-import-attention-strip="true"]')).toBeVisible();
  const firstBatch = page.locator('[data-import-batch-row="true"]').first();
  await expect(firstBatch).toBeVisible();
  await expect(firstBatch).not.toContainText(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );

  await page.locator('[data-import-export-tab-entry="true"]').click();
  const exportPanel = page.locator('[data-import-export-panel="true"]');
  await expect(exportPanel).toBeVisible();
  await expect(exportPanel.locator('aside')).toHaveCount(0);
  await expect(exportPanel.locator('[data-export-date-start="true"]')).toBeVisible();
  await expect(exportPanel.locator('[data-export-date-end="true"]')).toBeVisible();

  await exportPanel.locator('[data-export-date-start="true"]').fill('2026-09-30');
  await exportPanel.locator('[data-export-date-end="true"]').fill('2026-09-01');
  await expect(exportPanel.getByText(/Ngày bắt đầu.*không được sau ngày kết thúc/)).toBeVisible();
  await expect(exportPanel.locator('[data-import-export-submit="true"]')).toBeDisabled();

  await exportPanel.locator('[data-export-date-start="true"]').fill('2026-09-01');
  await exportPanel.locator('[data-export-date-end="true"]').fill('2026-09-30');
  await expect(exportPanel.getByText('01/09/2026 đến 30/09/2026')).toBeVisible();
  await expect(exportPanel.locator('[data-import-export-submit="true"]')).toBeEnabled();
});

test('an unavailable preview never tells the user that an applied import failed to be created', async ({
  page,
  request
}) => {
  const session = await login(request);
  await seedAuth(page, session);
  await page.goto(
    `${ADMIN_BASE_PATH}/import/f1aca236-79cb-47a4-a511-5fbd17e5363f`
  );

  await expect(page.getByRole('heading', { name: 'MINH HOA 42 cot v2' })).toBeVisible();
  await expect(page.getByText('Không tạo được lô nhập')).toHaveCount(0);
  await expect(page.getByText('Không có bản xem trước của tệp')).toBeVisible();
});

test('new import uses a localized dropzone and derives a useful batch name', async ({
  page,
  request
}) => {
  const session = await login(request);
  await seedAuth(page, session);
  await page.goto(`${ADMIN_BASE_PATH}/import/new`);

  await expect(page.locator('[data-import-upload-dropzone="true"]')).toContainText(
    'Chọn tệp hoặc kéo thả vào đây'
  );
  await page.locator('[data-import-upload-file="true"]').setInputFiles({
    name: 'danh_sach_san_pham_thang_9.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('ten,ma\nDen LED,LED-01')
  });

  await expect(page.locator('[data-import-batch-name="true"]')).toHaveValue(
    'danh sach san pham thang 9'
  );
  await expect(page.locator('[data-import-upload-dropzone="true"]')).toContainText(
    'Sẵn sàng đọc'
  );
});

test('redesigned domain and import screens stay within mobile and wide viewports', async ({
  page,
  request
}) => {
  const session = await login(request);
  await seedAuth(page, session);
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const serviceId = await firstRecordId(request, session, 'services');
  const projectId = await firstRecordId(request, session, 'projects');
  const pages = [
    `${ADMIN_BASE_PATH}/services/${serviceId}`,
    `${ADMIN_BASE_PATH}/projects/${projectId}`,
    `${ADMIN_BASE_PATH}/import`,
    `${ADMIN_BASE_PATH}/import/new`
  ];

  for (const width of [390, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of pages) {
      await page.goto(url);
      await expect(page.locator('main')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `${url} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  }

  expect(browserErrors).toEqual([]);
});

async function firstRecordId(
  request: APIRequestContext,
  session: AdminSession,
  kind: 'services' | 'projects'
) {
  const response = await request.get(
    `${API_BASE_URL}/song-thanh/${kind}?page=1&page_size=1&deleted_scope=active`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );
  expect(response.ok(), `${kind} request failed with HTTP ${response.status()}`).toBe(true);
  const items = extractItems(await response.json());
  const id = String(items[0]?.id || '');
  expect(id).not.toBe('');
  return id;
}

function extractItems(payload: unknown): RecordMap[] {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const items = Array.isArray(record.items)
    ? record.items
    : Array.isArray(data.items)
      ? data.items
      : [];
  return items as RecordMap[];
}

function asRecord(value: unknown): RecordMap {
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
    headers: { 'X-Forwarded-For': '192.0.2.97' },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBe(true);
  const payload = (await response.json()) as { ok: boolean; data: Omit<AdminSession, 'roles'> };

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
