import { expect, test, type APIRequestContext, type Download, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const ADMIN_BASE_URL = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const ADMIN_BASE_PATH = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const STORAGE_KEY = 'song-thanh-admin-auth';
const EXPORT_PANEL = '[data-import-export-panel="true"]';
const EXPORT_SUBMIT = '[data-import-export-submit="true"]';

type RecordMap = Record<string, unknown>;

type AdminSession = {
  access_token: string;
  refresh_token: string;
  user: RecordMap;
  permissions: string[];
};

type SongThanhRequest = {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  url: string;
};

type ExportFixture = {
  brandWithData: RecordMap;
  brandWithoutData: RecordMap;
  brandAllowedParentCategoryIds: string[];
  brandParentCategoryWithData: RecordMap;
  brandChildIdsForParent: string[];
  childCategoryWithData: RecordMap;
  parentCategoryWithData: RecordMap;
  childIdsForParent: string[];
  productGroupForDocument: RecordMap;
  seededDocumentId: string;
  seededDocumentName: string;
};

let session: AdminSession;
let fixture: ExportFixture;

test.describe.configure({ mode: 'serial' });

function normalizeAdminBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminPath(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${ADMIN_BASE_PATH}${normalizedPath}`;
}

test.beforeAll(async ({ request }) => {
  session = await login(request);
  fixture = await buildExportFixture(request, session);
});

test.afterAll(async ({ request }) => {
  if (!session || !fixture?.seededDocumentId) return;
  await apiPost(request, session, `/song-thanh/technical-documents/${fixture.seededDocumentId}/archive`, {}).catch(
    () => undefined
  );
});

test('EXP-01, EXP-03, EXP-04, EXP-05: export tab renders in import workspace and loads references', async ({
  page
}) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/import'));
  await expect(page.locator('[data-import-export-tab-entry="true"]')).toBeVisible();

  const calls = recordSongThanhRequests(page);
  await page.locator('[data-import-export-tab-entry="true"]').click();
  await expect(page.locator(EXPORT_PANEL)).toBeVisible();
  await expect(page.locator('[data-file-zone-nav="true"]')).toHaveCount(0);
  await waitForExportReferences(page);

  const submit = page.locator(EXPORT_SUBMIT);
  await expect(submit).toBeDisabled();
  await expect(page.getByText(/Chọn ít nhất một điều kiện/)).toBeVisible();

  await page.getByRole('button', { name: /Xuất tất cả/ }).click();
  await expect(submit).toBeEnabled();

  expect(calls.some((call) => call.pathname === '/song-thanh/brands')).toBe(true);
  expect(calls.some((call) => call.pathname === '/song-thanh/product-categories')).toBe(true);
  for (const call of calls.filter((item) =>
    ['/song-thanh/brands', '/song-thanh/product-categories'].includes(item.pathname)
  )) {
    expect(call.method).toBe('GET');
    expect(call.searchParams.get('deleted_scope')).toBe('active');
    expect(call.searchParams.get('status')).toBe('all');
  }
});

test('EXP-02: missing import.read blocks the export workspace', async ({ page }) => {
  await seedAuth(page, {
    ...session,
    access_token: 'qa-no-import-read',
    refresh_token: 'qa-no-import-read',
    permissions: [],
    user: { id: 'qa-no-import-read', email: 'qa-no-import-read@songthanh.local' }
  });

  await page.goto(adminPath('/import'));
  await expect(page.getByText(/Không đủ quyền truy cập/)).toBeVisible();
  await expect(page.locator(EXPORT_PANEL)).toHaveCount(0);
  await expect(page.locator(EXPORT_SUBMIT)).toHaveCount(0);
});

test('EXP-06, EXP-08, EXP-20: product catalog export uses list endpoints and downloads .xls', async ({
  page
}) => {
  await openExportWorkspace(page);
  await selectBrandFilter(page, recordId(fixture.brandWithData));

  const calls = recordSongThanhRequests(page);
  const download = await clickAndWaitForDownload(page);
  const html = await readDownload(download);

  expect(download.suggestedFilename()).toMatch(/\.xls$/);
  expect(download.suggestedFilename()).toContain(filenameToken(recordName(fixture.brandWithData)));
  expect(html).toContain('<table>');
  expect(html).toContain('Nhóm sản phẩm');
  expect(html).toContain('Biến thể');

  const groupCalls = calls.filter((call) => call.pathname === '/song-thanh/product-groups');
  const variantCalls = calls.filter((call) => call.pathname === '/song-thanh/product-variants');
  expect(groupCalls.length).toBeGreaterThan(0);
  expect(variantCalls.length).toBeGreaterThan(0);
  expect(groupCalls.some((call) => call.searchParams.get('brand_id') === recordId(fixture.brandWithData))).toBe(
    true
  );
  assertNoForbiddenExportCalls(calls);
});

test('EXP-05B: brand filter narrows parent and child category choices', async ({ page }) => {
  await openExportWorkspace(page);
  await selectBrandFilter(page, recordId(fixture.brandWithData));

  const panel = page.locator(EXPORT_PANEL);
  const parentSelect = panel.locator('select').nth(1);
  const childSelect = panel.locator('select').nth(2);

  const parentValues = await optionValues(parentSelect);
  const selectedBrandParentValues = parentValues.filter(Boolean);
  expect(selectedBrandParentValues.length).toBeGreaterThan(0);
  for (const value of selectedBrandParentValues) {
    expect(fixture.brandAllowedParentCategoryIds).toContain(value);
  }

  await parentSelect.selectOption(recordId(fixture.brandParentCategoryWithData));
  await expect(childSelect).toBeEnabled();

  const childValues = (await optionValues(childSelect)).filter(Boolean);
  expect(childValues.length).toBeGreaterThan(0);
  for (const value of childValues) {
    expect(fixture.brandChildIdsForParent).toContain(value);
  }
});

test('EXP-07: product catalog can export without variant requests', async ({ page }) => {
  await openExportWorkspace(page);
  await selectBrandFilter(page, recordId(fixture.brandWithData));
  await openAdvancedOptions(page);
  await page.getByLabel(/Kèm biến thể/).uncheck();

  const calls = recordSongThanhRequests(page);
  const download = await clickAndWaitForDownload(page);
  const html = await readDownload(download);

  expect(html).toContain('Nhóm sản phẩm');
  expect(html).not.toContain('Biến thể</h2>');
  expect(calls.some((call) => call.pathname === '/song-thanh/product-variants')).toBe(false);
  assertNoForbiddenExportCalls(calls);
});

test('EXP-09, EXP-11, EXP-12: parent category public-safe export includes child products and documents', async ({
  page
}) => {
  await openExportWorkspace(page);
  await selectCategoryFilter(page, recordId(fixture.parentCategoryWithData));
  await openAdvancedOptions(page);
  await page.getByLabel(/Kèm tài liệu/).check();
  await page.getByLabel(/Chỉ dữ liệu public-safe/).check();

  const calls = recordSongThanhRequests(page);
  const download = await clickAndWaitForDownload(page);
  const html = await readDownload(download);

  expect(html).toContain('Nhóm sản phẩm');
  expect(html).toContain('Biến thể');
  expect(html).toContain('Tài liệu kỹ thuật');

  const groupCalls = calls.filter((call) => call.pathname === '/song-thanh/product-groups');
  expect(groupCalls.some((call) => fixture.childIdsForParent.includes(call.searchParams.get('category_id') || ''))).toBe(
    true
  );
  for (const call of groupCalls) {
    expect(call.searchParams.get('status')).toBe('active');
    expect(call.searchParams.get('review_status')).toBe('approved');
    expect(call.searchParams.get('publish_status')).toBe('published');
  }

  for (const call of calls.filter((item) => item.pathname === '/song-thanh/product-variants')) {
    expect(call.searchParams.get('status')).toBe('active');
    expect(call.searchParams.get('review_status')).toBe('approved');
    expect(call.searchParams.get('publish_status')).toBe('published');
  }

  expect(calls.some((call) => call.pathname === '/song-thanh/technical-documents')).toBe(true);
  for (const call of calls.filter((item) => item.pathname === '/song-thanh/technical-documents')) {
    expect(call.searchParams.get('status')).toBe('active');
    expect(call.searchParams.get('is_public')).toBe('true');
    expect(call.searchParams.get('product_group_id')).toBeNull();
  }
  assertNoForbiddenExportCalls(calls);
});

test('EXP-10, EXP-14, EXP-18: taxonomy export uses loaded references and keeps quick format Excel-only', async ({
  page
}) => {
  await openExportWorkspace(page);
  await page.getByRole('button', { name: /Danh mục, thương hiệu/ }).click();
  await selectExportStatus(page, 'active');
  await openAdvancedOptions(page);

  const formatSelect = page.locator(EXPORT_PANEL).locator('select').last();
  await expect(formatSelect).toBeDisabled();
  await expect(formatSelect.locator('option')).toHaveCount(1);
  await expect(page.getByText(/CSV\/PDF cần lô xuất chính thức/)).toBeVisible();
  await expect(page.getByLabel(/Kèm thông số chi tiết/)).toBeDisabled();

  const calls = recordSongThanhRequests(page);
  const download = await clickAndWaitForDownload(page);
  const html = await readDownload(download);

  expect(download.suggestedFilename()).toMatch(/danh-muc-thuong-hieu.*\.xls$/);
  expect(html).toContain('Danh mục');
  expect(html).toContain('Thương hiệu');
  expect(calls.some((call) => call.pathname === '/song-thanh/product-groups')).toBe(false);
  expect(calls.some((call) => call.pathname === '/song-thanh/product-variants')).toBe(false);
  assertNoForbiddenExportCalls(calls);
});

test('EXP-15, EXP-19: technical document export uses public-safe document query and escapes cells', async ({
  page
}) => {
  await openExportWorkspace(page);
  await page.getByRole('button', { name: /Tài liệu kỹ thuật/ }).click();
  await page.getByRole('button', { name: /Xuất tất cả/ }).click();

  const calls = recordSongThanhRequests(page);
  const download = await clickAndWaitForDownload(page);
  const html = await readDownload(download);

  expect(download.suggestedFilename()).toMatch(/tai-lieu-ky-thuat.*\.xls$/);
  expect(html).toContain('Tài liệu kỹ thuật');
  expect(html).toContain('QA_EXPORT_DOC');
  expect(html).toContain('&amp;');
  expect(html).toContain('&lt;spec&gt;');

  const documentCalls = calls.filter((call) => call.pathname === '/song-thanh/technical-documents');
  expect(documentCalls.length).toBeGreaterThan(0);
  for (const call of documentCalls) {
    expect(call.searchParams.get('status')).toBe('active');
    expect(call.searchParams.get('is_public')).toBe('true');
  }
  assertNoForbiddenExportCalls(calls);
});

test('EXP-16: no matching product data shows an action error and does not download', async ({ page }) => {
  await openExportWorkspace(page);
  await selectBrandFilter(page, recordId(fixture.brandWithoutData));

  const calls = recordSongThanhRequests(page);
  const downloadPromise = waitForNoDownload(page);
  await page.locator(EXPORT_SUBMIT).click();

  await expect(page.locator('[data-error-message-panel="true"]')).toBeVisible();
  await expect(downloadPromise).resolves.toBeNull();
  expect(calls.some((call) => call.pathname === '/song-thanh/product-groups')).toBe(true);
  assertNoForbiddenExportCalls(calls);
});

test('EXP-17: API read failure shows an error and blocks partial download', async ({ page }) => {
  await openExportWorkspace(page);
  await selectBrandFilter(page, recordId(fixture.brandWithData));
  await page.route('**/song-thanh/product-groups**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: {
          code: 'QA_EXPORT_FAILURE',
          message: 'QA export failure'
        }
      })
    });
  });

  const calls = recordSongThanhRequests(page);
  const downloadPromise = waitForNoDownload(page);
  await page.locator(EXPORT_SUBMIT).click();

  await expect(page.locator('[data-error-message-panel="true"]')).toBeVisible();
  await expect(downloadPromise).resolves.toBeNull();
  assertNoForbiddenExportCalls(calls);
});

async function openExportWorkspace(page: Page) {
  await seedAuth(page, session);
  await page.goto(adminPath('/import'));
  await expect(page.locator('[data-import-export-tab-entry="true"]')).toBeVisible();
  await page.locator('[data-import-export-tab-entry="true"]').click();
  await expect(page.locator(EXPORT_PANEL)).toBeVisible();
  await waitForExportReferences(page);
}

async function waitForExportReferences(page: Page) {
  const panel = page.locator(EXPORT_PANEL);
  await expect.poll(async () => panel.locator('select').nth(0).locator('option').count()).toBeGreaterThan(1);
  await expect.poll(async () => panel.locator('select').nth(1).locator('option').count()).toBeGreaterThan(1);
  await expect(panel.locator('select').nth(0)).toBeEnabled();
  await expect(panel.locator('select').nth(1)).toBeEnabled();
  await expect(panel.locator('select').nth(2)).toBeDisabled();
  await expect(panel.locator('select').nth(3)).toBeEnabled();
}

async function selectBrandFilter(page: Page, brandId: string) {
  await page.locator(EXPORT_PANEL).locator('select').nth(0).selectOption(brandId);
  await expect(page.locator(EXPORT_SUBMIT)).toBeEnabled();
}

async function selectCategoryFilter(page: Page, categoryId: string) {
  await page.locator(EXPORT_PANEL).locator('select').nth(1).selectOption(categoryId);
  await expect(page.locator(EXPORT_SUBMIT)).toBeEnabled();
}

async function selectExportStatus(page: Page, status: 'active' | 'inactive') {
  await page.locator(EXPORT_PANEL).locator('select').nth(3).selectOption(status);
  await expect(page.locator(EXPORT_SUBMIT)).toBeEnabled();
}

async function optionValues(select: Locator) {
  return select.locator('option').evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
  );
}

async function openAdvancedOptions(page: Page) {
  const details = page.locator(EXPORT_PANEL).locator('details');
  await details.evaluate((node) => {
    if (node instanceof HTMLDetailsElement) node.open = true;
  });
}

async function clickAndWaitForDownload(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(EXPORT_SUBMIT).click()
  ]);
  return download;
}

async function waitForNoDownload(page: Page) {
  return page.waitForEvent('download', { timeout: 1_500 }).catch(() => null);
}

async function readDownload(download: Download) {
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('Download path is not available.');
  return fs.readFile(downloadPath, 'utf8');
}

function recordSongThanhRequests(page: Page) {
  const calls: SongThanhRequest[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const directApiRequest = url.origin === API_BASE_URL && url.pathname.startsWith('/song-thanh/');
    const sameOriginProxyRequest =
      url.origin === ADMIN_BASE_URL && url.pathname.startsWith('/api/song-thanh/');
    if (!directApiRequest && !sameOriginProxyRequest) return;
    const pathname = sameOriginProxyRequest ? url.pathname.slice('/api'.length) : url.pathname;
    calls.push({
      method: request.method(),
      pathname,
      searchParams: url.searchParams,
      url: request.url()
    });
  });
  return calls;
}

function assertNoForbiddenExportCalls(calls: SongThanhRequest[]) {
  const forbidden = calls.filter((call) => {
    if (/\/export(?:-|\/|$)|\/export-batches(?:\/|$)/.test(call.pathname)) return true;
    if (call.method === 'POST' && call.pathname === '/song-thanh/files') return true;
    if (
      call.method !== 'GET' &&
      (call.pathname.startsWith('/song-thanh/import-batches') ||
        call.pathname.startsWith('/song-thanh/import-conflicts'))
    ) {
      return true;
    }
    if (/highlight-spec|spec-groups|variant-attributes/.test(call.pathname)) return true;
    return false;
  });

  expect(forbidden, `Forbidden export side effects: ${forbidden.map((call) => call.url).join(', ')}`).toEqual([]);
}

async function seedAuth(page: Page, auth: AdminSession) {
  await page.addInitScript(
    ({ storageKey, state }) => {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state));
    },
    {
      storageKey: STORAGE_KEY,
      state: {
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        user: auth.user,
        permissions: auth.permissions,
        roles: []
      }
    }
  );
}

async function login(request: APIRequestContext) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.80' },
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }
  });
  expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBe(true);
  const payload = await response.json();
  expect(payload.ok).toBe(true);
  return payload.data as AdminSession;
}

async function buildExportFixture(request: APIRequestContext, auth: AdminSession): Promise<ExportFixture> {
  const [brands, categories] = await Promise.all([
    apiListAll(request, auth, '/song-thanh/brands', {
      deleted_scope: 'active',
      status: 'all'
    }),
    apiListAll(request, auth, '/song-thanh/product-categories', {
      deleted_scope: 'active',
      status: 'all'
    })
  ]);

  const brandWithData = brands
    .filter((brand) => recordNumber(brand, 'active_product_group_count') > 0 && recordText(brand, 'status') === 'active')
    .sort((a, b) => recordNumber(a, 'active_product_group_count') - recordNumber(b, 'active_product_group_count'))[0];
  const brandWithoutData =
    brands.find((brand) => recordNumber(brand, 'active_product_group_count') === 0 && recordText(brand, 'status') === 'active') ||
    brands.find((brand) => recordId(brand) !== recordId(brandWithData));

  if (!brandWithData || !brandWithoutData) {
    throw new Error('Admin export E2E requires at least one active brand with data and one without data.');
  }

  const brandProductGroups = await apiListAll(request, auth, '/song-thanh/product-groups', {
    deleted_scope: 'active',
    status: 'all',
    brand_id: recordId(brandWithData)
  });
  const brandCategoryIds = collectCategoryIdsFromProductGroups(brandProductGroups, categories);
  const brandCategoryIdSet = new Set(brandCategoryIds);
  const activeRootCategories = categories.filter(
    (category) => recordText(category, 'status') === 'active' && !recordText(category, 'parent_id')
  );
  const activeChildCategories = categories.filter(
    (category) => recordText(category, 'status') === 'active' && Boolean(recordText(category, 'parent_id'))
  );
  const brandAllowedParentCategories = activeRootCategories.filter((category) => {
    const categoryId = recordId(category);
    return (
      brandCategoryIdSet.has(categoryId) ||
      activeChildCategories.some(
        (child) => recordText(child, 'parent_id') === categoryId && brandCategoryIdSet.has(recordId(child))
      )
    );
  });
  const brandParentCategoryWithData = brandAllowedParentCategories.find((category) =>
    activeChildCategories.some(
      (child) => recordText(child, 'parent_id') === recordId(category) && brandCategoryIdSet.has(recordId(child))
    )
  );
  if (!brandParentCategoryWithData) {
    throw new Error('Admin export E2E requires one brand-backed parent category with child product data.');
  }
  const brandChildIdsForParent = activeChildCategories
    .filter(
      (category) =>
        recordText(category, 'parent_id') === recordId(brandParentCategoryWithData) &&
        brandCategoryIdSet.has(recordId(category))
    )
    .map(recordId)
    .filter(Boolean);

  const activeChildrenWithData = categories.filter(
    (category) =>
      recordText(category, 'status') === 'active' &&
      Boolean(recordText(category, 'parent_id')) &&
      recordNumber(category, 'active_product_group_count') > 0
  );
  const childCategoryWithData = activeChildrenWithData.sort(
    (a, b) => recordNumber(a, 'active_product_group_count') - recordNumber(b, 'active_product_group_count')
  )[0];
  if (!childCategoryWithData) {
    throw new Error('Admin export E2E requires one active child category with product data.');
  }

  const parentCategoryWithData = categories.find(
    (category) => recordId(category) === recordText(childCategoryWithData, 'parent_id')
  );
  if (!parentCategoryWithData) {
    throw new Error('Admin export E2E requires the parent category for the selected child category.');
  }

  const childIdsForParent = categories
    .filter(
      (category) =>
        recordText(category, 'status') === 'active' &&
        recordText(category, 'parent_id') === recordId(parentCategoryWithData)
    )
    .map(recordId)
    .filter(Boolean);

  const productGroups = await apiListFirstPage(request, auth, '/song-thanh/product-groups', {
    deleted_scope: 'active',
    status: 'active',
    review_status: 'approved',
    publish_status: 'published',
    category_id: recordId(childCategoryWithData),
    page_size: '1'
  });
  const productGroupForDocument = productGroups[0];
  if (!productGroupForDocument) {
    throw new Error('Admin export E2E requires one public-safe product group in the selected category.');
  }

  const files = await apiListFirstPage(request, auth, '/song-thanh/files', {
    deleted_scope: 'active',
    storage_location: 'local',
    page_size: '1'
  });
  const file = files[0];
  if (!file) {
    throw new Error('Admin export E2E requires one active file metadata row for the technical document fixture.');
  }

  const seededDocumentName = `QA_EXPORT_DOC_${Date.now()} & <spec>`;
  const documentResult = await apiPost(request, auth, '/song-thanh/technical-documents', {
    product_group_id: recordId(productGroupForDocument),
    document_name: seededDocumentName,
    document_type: 'datasheet',
    file_id: recordId(file),
    version: 'qa-1',
    is_public: true,
    status: 'active'
  });
  const seededDocument = documentResult.technical_document as RecordMap | undefined;
  if (!seededDocument?.id) {
    throw new Error('Admin export E2E could not create a technical document fixture.');
  }

  return {
    brandWithData,
    brandWithoutData,
    brandAllowedParentCategoryIds: brandAllowedParentCategories.map(recordId).filter(Boolean),
    brandParentCategoryWithData,
    brandChildIdsForParent,
    childCategoryWithData,
    parentCategoryWithData,
    childIdsForParent,
    productGroupForDocument,
    seededDocumentId: String(seededDocument.id),
    seededDocumentName
  };
}

async function apiListAll(
  request: APIRequestContext,
  auth: AdminSession,
  path: string,
  params: Record<string, string> = {}
) {
  const items: RecordMap[] = [];
  let page = 1;
  let pageCount = 1;
  const requestedPageSize = Number(params.page_size || 100);

  do {
    const search = new URLSearchParams({
      ...params,
      page: String(page),
      page_size: String(Math.min(100, Math.max(1, requestedPageSize)))
    });
    const data = await apiGet(request, auth, `${path}?${search.toString()}`);
    const pageItems = extractItems(data);
    items.push(...pageItems);
    const pagination = data.pagination as { page_count?: number } | undefined;
    pageCount = Math.max(1, Number(pagination?.page_count || 1));
    page += 1;
  } while (page <= pageCount);

  return uniqueById(items);
}

async function apiListFirstPage(
  request: APIRequestContext,
  auth: AdminSession,
  path: string,
  params: Record<string, string> = {}
) {
  const search = new URLSearchParams({
    ...params,
    page: '1',
    page_size: params.page_size || '100'
  });
  const data = await apiGet(request, auth, `${path}?${search.toString()}`);
  return extractItems(data);
}

async function apiGet(request: APIRequestContext, auth: AdminSession, path: string) {
  const response = await request.get(`${API_BASE_URL}${path}`, {
    headers: authHeaders(auth)
  });
  expect(response.ok(), `GET ${path} failed with HTTP ${response.status()}`).toBe(true);
  const payload = await response.json();
  expect(payload.ok).toBe(true);
  return payload.data as RecordMap;
}

async function apiPost(
  request: APIRequestContext,
  auth: AdminSession,
  path: string,
  body: Record<string, unknown>
) {
  const response = await request.post(`${API_BASE_URL}${path}`, {
    headers: authHeaders(auth),
    data: body
  });
  expect(response.ok(), `POST ${path} failed with HTTP ${response.status()}`).toBe(true);
  const payload = await response.json();
  expect(payload.ok).toBe(true);
  return payload.data as RecordMap;
}

function authHeaders(auth: AdminSession) {
  return {
    Authorization: `Bearer ${auth.access_token}`
  };
}

function extractItems(data: RecordMap) {
  if (Array.isArray(data)) return data as RecordMap[];
  if (Array.isArray(data.items)) return data.items as RecordMap[];
  return [];
}

function uniqueById(items: RecordMap[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = recordId(item);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function collectCategoryIdsFromProductGroups(productGroups: RecordMap[], categories: RecordMap[]) {
  const categoriesById = new Map(categories.map((category) => [recordId(category), category]));
  const categoryIds = new Set<string>();

  function addCategoryAndParents(categoryId: string) {
    let nextId = categoryId;
    let guard = 0;

    while (nextId && guard < 4) {
      categoryIds.add(nextId);
      nextId = recordText(categoriesById.get(nextId) ?? {}, 'parent_id');
      guard += 1;
    }
  }

  for (const group of productGroups) {
    [
      recordText(group, 'category_level_1_id'),
      recordText(group, 'category_level_2_id'),
      recordText(group, 'category_id')
    ]
      .filter(Boolean)
      .forEach(addCategoryAndParents);
  }

  return Array.from(categoryIds);
}

function recordId(row: RecordMap) {
  const value = row.id;
  return value == null ? '' : String(value);
}

function recordName(row: RecordMap) {
  return recordText(row, 'name') || recordText(row, 'document_name') || recordText(row, 'variant_name') || recordId(row);
}

function recordText(row: RecordMap, key: string) {
  const value = row[key];
  return value == null ? '' : String(value);
}

function recordNumber(row: RecordMap, key: string) {
  const value = row[key];
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function filenameToken(value: string) {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'tat-ca'
  );
}
