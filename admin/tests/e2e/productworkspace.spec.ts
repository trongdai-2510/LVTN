import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { getQaAuth } from './qaAuth';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
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
let productGroup: RecordMap;
let dependencyCounts: RecordMap;
let productVariants: RecordMap[];

test.beforeAll(async ({ request }) => {
  session = await login(request);
  const listResponse = await request.get(
    `${API_BASE_URL}/song-thanh/product-groups?page=1&page_size=1&deleted_scope=active`,
    { headers: authHeaders(session) }
  );
  expect(listResponse.ok(), `Product list failed with HTTP ${listResponse.status()}`).toBe(true);
  const listData = unwrap((await listResponse.json()) as RecordMap);
  const items = Array.isArray(listData.items) ? (listData.items as RecordMap[]) : [];
  expect(items.length).toBeGreaterThan(0);

  const detailResponse = await request.get(
    `${API_BASE_URL}/song-thanh/product-groups/${String(items[0].id)}`,
    { headers: authHeaders(session) }
  );
  expect(detailResponse.ok(), `Product detail failed with HTTP ${detailResponse.status()}`).toBe(true);
  const detail = unwrap((await detailResponse.json()) as RecordMap);
  productGroup = asRecord(detail.product_group);
  dependencyCounts = asRecord(detail.dependency_counts);

  const variantsResponse = await request.get(
    `${API_BASE_URL}/song-thanh/product-variants?product_group_id=${encodeURIComponent(String(productGroup.id))}&page_size=100&deleted_scope=active`,
    { headers: authHeaders(session) }
  );
  expect(variantsResponse.ok(), `Variant list failed with HTTP ${variantsResponse.status()}`).toBe(true);
  productVariants = extractItems((await variantsResponse.json()) as RecordMap);
  expect(productVariants.length).toBeGreaterThan(0);
});

test('the product list presents one compact work surface', async ({ page }) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/product-groups'));

  const summary = page.locator('[data-product-list-summary="true"]');
  await expect(summary).toBeVisible();
  await expect(summary.locator('[data-product-list-total="true"]')).toBeVisible();
  await expect(summary.locator('[data-product-list-page-count="true"]')).toBeVisible();
  await expect(summary.locator('[data-product-list-attention="true"]')).toBeVisible();
  await expect(summary).toContainText('Thiếu ảnh chính / trang');
  await expect(page.locator('[data-product-list-table="true"]')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Dữ liệu chính' })).toBeVisible();

  const catalogWorkspace = page.locator('[data-product-catalog-workspace="true"]');
  const productRows = page.locator('[data-product-catalog-row="true"]');
  const inspector = page.locator('[data-product-list-inspector="true"]');

  await expect(catalogWorkspace).toBeVisible();
  await expect(catalogWorkspace).toHaveAttribute('data-product-catalog-layout', 'full-width');
  await expect(productRows.first()).toBeVisible();
  await expect(inspector).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Nhập từ Excel' })).toBeVisible();

  const firstProductName = await productRows.first().getAttribute('data-product-name');
  expect(firstProductName).toBeTruthy();
  await expect(
    productRows.first().getByRole('link', { name: new RegExp(`Mở hồ sơ ${escapeRegExp(firstProductName!)}`) })
  ).toBeVisible();
  await expect(productRows.first().getByText(/biến thể \/ SKU/i)).toBeVisible();
  await expect(productRows.first()).not.toContainText(/\b5 việc\b/i);

  // Danh sách ưu tiên thao tác chính; lưu trữ chỉ nằm trong hồ sơ chi tiết.
  await expect(page.locator('[data-product-delete-button="true"]')).toHaveCount(0);

  const bulkToolbar = page.locator('[data-product-bulk-toolbar="true"]');
  await expect(bulkToolbar).toHaveCount(0);
  await productRows.first().getByRole('checkbox').check({ force: true });
  await expect(bulkToolbar).toBeVisible();
  await expect(bulkToolbar.locator('[data-product-selected-count="true"]')).toContainText('1');

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(summary).toBeVisible();
  await expect(page.locator('[data-product-mobile-list="true"]')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('a catalogue completion notice opens the exact section that needs input', async ({
  page
}) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/product-groups'));

  const firstRow = page.locator('[data-product-catalog-row="true"]').first();
  const completionLink = firstRow.getByRole('link', { name: /Thiếu mô tả ngắn/i });
  await expect(completionLink).toBeVisible();
  await completionLink.click();

  await expect(page).toHaveURL(/view=content/);
  await expect(page.locator('#product-group-content')).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Khu vực sản phẩm' })
      .getByRole('link', { name: 'Nội dung', exact: true })
  ).toHaveAttribute('aria-current', 'page');
});

test('the variant catalogue stays compact and searchable without loading every parent product', async ({
  page
}) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/product-variants'));

  const catalogue = page.locator('[data-variant-catalog-layout="compact"]');
  await expect(catalogue).toBeVisible();
  await expect(page.getByPlaceholder(/tên biến thể.*sku.*sản phẩm/i)).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Biến thể / SKU' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Sản phẩm' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Nội dung riêng' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Báo giá' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Hiển thị' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Mô tả riêng' })).toHaveCount(0);
  await expect(page.getByLabel('Thuộc sản phẩm')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Nhập từ Excel' })).toBeVisible();
  await expect(catalogue.locator('[data-product-delete-button="true"]')).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.locator('[data-product-mobile-list="true"]')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('the variant record selects its parent product through bounded search', async ({ page }) => {
  const productListRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/song-thanh/product-groups') && request.method() === 'GET') {
      productListRequests.push(url.search);
    }
  });

  await seedAuth(page, session);
  await page.goto(adminPath(`/product-variants/${String(productVariants[0].id)}`));

  const productField = page.getByRole('button', { name: 'Sản phẩm dùng chung' });
  await expect(productField).toBeVisible();
  expect(productListRequests).toEqual([]);

  await productField.click();
  const picker = page.getByRole('dialog', { name: 'Chọn sản phẩm cho biến thể' });
  await expect(picker).toBeVisible();
  await expect(picker.getByPlaceholder('Nhập tên sản phẩm, mã hoặc danh mục...')).toBeVisible();
  await expect.poll(() => productListRequests.length).toBeGreaterThan(0);
  expect(productListRequests.every((search) => search.includes('page_size=20'))).toBe(true);
  const productResults = picker.getByRole('list', { name: 'Kết quả sản phẩm' }).getByRole('listitem');
  await expect(productResults.first()).toBeVisible();
  expect(await productResults.count()).toBeLessThanOrEqual(20);
  await page.keyboard.press('Escape');
  await expect(picker).toHaveCount(0);
});

test('the category overview keeps large trees collapsed until an admin opens a branch', async ({
  page
}) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/product-categories'));

  const branches = page.locator('[data-category-branch="true"]');
  await expect(branches.first()).toBeVisible();
  await expect(page.locator('[data-category-children="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(2200);

  const expandableBranch = branches.filter({ has: page.locator('button[aria-expanded]') }).first();
  await expect(expandableBranch).toBeVisible();
  const firstToggle = expandableBranch.locator('button[aria-expanded]').first();
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
  await firstToggle.click();
  await expect(firstToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(expandableBranch.locator('[data-category-children="true"]')).toBeVisible();

  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('the product detail presents one workbench with clear navigation and variant rows', async ({
  page
}, testInfo) => {
  test.setTimeout(120_000);
  const detailRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (/\/product-variants\/[^/?]+\/attributes(?:\?|$)/.test(url)) {
      detailRequests.push('attributes');
    }
    if (/\/product-groups\/[^/?]+\/highlight-specs\?/.test(url)) {
      detailRequests.push('highlights');
    }
  });

  expect(typeof productVariants[0].attribute_count).toBe('number');
  expect(typeof productVariants[0].highlight_spec_count).toBe('number');
  await seedAuth(page, session);
  await page.goto(adminPath(`/product-groups/${String(productGroup.id)}`));

  const twin = page.locator('[data-product-digital-twin="true"]');
  await expect(twin).toBeVisible();
  await expect(twin).toHaveAttribute('data-product-workspace-layout', 'workbench');
  await expect(twin.locator('[data-product-twin-navigation="true"]')).toBeVisible();
  await expect(twin.locator('[data-product-twin-relations="true"]')).toBeVisible();
  await expect(twin.locator('[data-product-twin-readiness="true"]')).toBeVisible();
  await expect(twin).not.toContainText(/lỗi chặn|cảnh báo/i);
  await expect(twin.locator('aside')).toHaveCount(0);
  await expect(twin.getByRole('heading', { name: String(productGroup.name), level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(twin.getByRole('link', { name: 'Quay lại danh sách' })).toBeVisible();
  await expect(twin.getByText(`${Number(dependencyCounts.active_variants ?? 0)} biến thể`)).toBeVisible();
  await expect(twin.getByText(`${Number(dependencyCounts.active_images ?? 0)} ảnh`)).toBeVisible();
  await expect(twin.getByText(`${Number(dependencyCounts.active_documents ?? 0)} tài liệu`)).toBeVisible();

  const sectionNavigation = twin.getByRole('navigation', { name: 'Khu vực sản phẩm' });
  for (const label of ['Thông tin', 'Nội dung', 'Biến thể / SKU', 'Tài liệu']) {
    await expect(sectionNavigation.getByRole('link', { name: label, exact: true })).toBeVisible();
  }
  await expect(sectionNavigation.getByRole('link', { name: 'Hiển thị', exact: true })).toHaveCount(0);

  await expect(page.locator('#product-group-main')).toBeVisible();
  await expect(page.locator('#product-group-main #product-group-display')).toBeVisible();
  await expect(page.locator('#product-group-display [data-display-status-badge] > span')).toHaveCount(1);
  await expect(page.locator('#product-group-display')).toContainText('Duyệt: Đã duyệt');
  await expect(page.locator('#product-group-display').getByRole('button', { name: 'Lưu trữ hiển thị' })).toBeVisible();
  await page.locator('#product-group-display').getByRole('button', { name: 'Lưu trữ hiển thị' }).click();
  const archiveDisplayDialog = page.getByRole('dialog', { name: 'Lưu trữ hiển thị' });
  await expect(archiveDisplayDialog).toBeVisible();
  await archiveDisplayDialog.getByRole('button', { name: 'Hủy' }).click();
  await expect(archiveDisplayDialog).toHaveCount(0);
  await expect(page.locator('#product-group-variants')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('product-main-desktop.png') });
  const imageGallery = page.getByRole('heading', { name: 'Thư viện ảnh sản phẩm' });
  await imageGallery.scrollIntoViewIfNeeded();
  await expect(imageGallery).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('product-gallery-desktop.png') });
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.locator('#product-group-display').scrollIntoViewIfNeeded();
  await expect(page.locator('#product-group-display').getByRole('button', { name: 'Ngừng hiển thị' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('product-status-mobile.png') });
  await imageGallery.scrollIntoViewIfNeeded();
  await expect(page.getByRole('textbox', { name: 'Mô tả ảnh 1' })).toBeVisible();
  await expect
    .poll(() =>
      page.getByRole('textbox', { name: 'Mô tả ảnh 1' }).evaluate((element) =>
        element.getBoundingClientRect().width
      )
    )
    .toBeGreaterThan(180);
  await expect(page.getByRole('button', { name: 'Đưa ảnh 1 xuống dưới' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('product-gallery-mobile.png') });
  await page.setViewportSize({ width: 1280, height: 720 });

  await sectionNavigation.getByRole('link', { name: 'Nội dung', exact: true }).click();
  await expect(page.locator('#product-group-content')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('product-content-desktop.png') });
  await expect(page.locator('#product-group-display')).toHaveCount(0);

  await sectionNavigation.getByRole('link', { name: 'Biến thể / SKU', exact: true }).click();
  await expect(page).toHaveURL(/view=variants/);
  await expect(page.locator('#product-group-main')).toHaveCount(0);
  await expect(page.locator('#product-group-variants')).toBeVisible();
  await expect(page.locator('#product-group-variants').getByRole('button', { name: 'Thêm biến thể / SKU' })).toHaveCount(1);

  const firstVariant = page.locator('[data-variant-workspace-trigger="true"]').first();
  await expect(firstVariant).toBeVisible();
  await expect(firstVariant).toContainText(`${Number(productVariants[0].attribute_count)} thông số`);
  await expect(firstVariant).toContainText(`${Number(productVariants[0].highlight_spec_count)} nổi bật`);
  expect(detailRequests).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('product-variants-desktop.png') });

  await firstVariant.click();
  await expect(page.getByRole('dialog', { name: /Biến thể/ })).toBeVisible();
  await expect.poll(() => detailRequests.slice().sort()).toEqual(['attributes', 'highlights']);
  await page.keyboard.press('Escape');

  await sectionNavigation.getByRole('link', { name: 'Tài liệu', exact: true }).click();
  await expect(page).toHaveURL(/view=documents/);
  const documentWorkspace = page.locator('#product-group-documents');
  await expect(documentWorkspace.getByRole('heading', { name: 'Tài liệu kỹ thuật', exact: true })).toBeVisible();
  await expect(documentWorkspace.getByText('Toàn sản phẩm', { exact: true })).toBeVisible();
  await expect(documentWorkspace.getByText('Theo biến thể', { exact: true })).toBeVisible();
  await documentWorkspace.locator('details > summary').click();
  const documentScope = documentWorkspace.getByLabel('Phạm vi áp dụng');
  await expect(documentScope).toBeVisible();
  await expect(documentScope.locator('option').first()).toHaveText(
    'Toàn bộ sản phẩm và mọi biến thể'
  );
  await page.screenshot({ path: testInfo.outputPath('product-documents-desktop.png') });

  await page.reload();
  await expect(page).toHaveURL(/view=documents/);
  await expect(documentWorkspace).toBeVisible();
  expect(detailRequests.slice().sort()).toEqual(['attributes', 'highlights']);
  detailRequests.length = 0;

  await sectionNavigation.getByRole('link', { name: 'Thông tin', exact: true }).click();
  await page.goto(adminPath(`/product-groups/${String(productGroup.id)}?view=display`));
  await expect(page.locator('#product-group-main #product-group-display')).toBeVisible();
  await expect(sectionNavigation.getByRole('link', { name: 'Thông tin', exact: true })).toHaveAttribute('aria-current', 'page');

  const inspectorTrigger = twin.getByRole('button', { name: 'Kiểm tra toàn bộ' });
  await inspectorTrigger.click();
  const inspector = page.getByRole('dialog', {
    name: new RegExp(`Phạm vi ảnh hưởng: ${escapeRegExp(String(productGroup.name))}`)
  });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('heading', { name: 'Nơi sản phẩm xuất hiện' })).toBeVisible();
  await expect(inspector.getByRole('heading', { name: 'Kiểm tra hồ sơ' })).toBeVisible();
  await expect(inspector).not.toContainText(/backend|lỗi chặn|\bcảnh báo\b/i);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Escape');
  await expect(inspector).toHaveCount(0);
  await expect(inspectorTrigger).toBeFocused();

  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect
    .poll(() =>
      sectionNavigation.evaluate((element) => element.scrollWidth <= element.clientWidth)
    )
    .toBe(true);
  await expect(inspectorTrigger).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('product-mobile.png') });

  await sectionNavigation.getByRole('link', { name: 'Biến thể / SKU', exact: true }).click();
  await firstVariant.click();
  const mobileVariantDialog = page.getByRole('dialog', { name: /Biến thể/ });
  await expect(mobileVariantDialog).toBeVisible();
  await expect
    .poll(() =>
      mobileVariantDialog.evaluate(
        (element) => element.getBoundingClientRect().width <= window.innerWidth
      )
    )
    .toBe(true);
  expect(detailRequests.slice().sort()).toEqual(['attributes', 'highlights']);
  await page.keyboard.press('Escape');

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(twin.getByRole('heading', { name: String(productGroup.name), level: 1 })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await expect
      .poll(() =>
        sectionNavigation.evaluate((element) => element.scrollWidth <= element.clientWidth)
      )
      .toBe(true);
  }
});

test('banner, service and project detail pages own their breadcrumbs without injected CSS', async ({
  page,
  request
}) => {
  await seedAuth(page, session);

  for (const domain of ['banners', 'services', 'projects']) {
    const response = await request.get(
      `${API_BASE_URL}/song-thanh/${domain}?page=1&page_size=1&deleted_scope=active`,
      { headers: authHeaders(session) }
    );
    expect(response.ok(), `${domain} list failed with HTTP ${response.status()}`).toBe(true);
    const [record] = extractItems((await response.json()) as RecordMap);
    expect(record?.id, `${domain} needs one record for the layout check`).toBeTruthy();

    await page.goto(adminPath(`/${domain}/${String(record.id)}`));
    await expect(page.locator('[data-admin-breadcrumbs="true"]')).toHaveCount(0);
    await expect(
      page.locator('style').filter({ hasText: 'data-admin-breadcrumbs' })
    ).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  }
});

function normalizeAdminBasePath(basePath: string) {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminPath(pathname: string) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${ADMIN_BASE_PATH}${normalizedPath}`;
}

function authHeaders(auth: AdminSession) {
  return { Authorization: `Bearer ${auth.access_token}` };
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
  const data = await getQaAuth(request, API_BASE_URL);
  const meResponse = await request.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${String(data.access_token)}` }
  });
  expect(meResponse.ok(), `Auth me failed with HTTP ${meResponse.status()}`).toBe(true);
  const me = unwrap((await meResponse.json()) as RecordMap);
  return {
    access_token: String(data.access_token),
    refresh_token: String(data.refresh_token),
    user: asRecord(data.user),
    permissions: Array.isArray(data.permissions) ? data.permissions.map(String) : [],
    roles: Array.isArray(me.roles) ? me.roles.map(String) : []
  };
}

function unwrap(body: RecordMap) {
  return body && typeof body === 'object' && 'data' in body
    ? (body.data as RecordMap)
    : body;
}

function asRecord(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordMap)
    : {};
}

function extractItems(body: RecordMap): RecordMap[] {
  const data = unwrap(body);
  return Array.isArray(data.items) ? (data.items as RecordMap[]) : [];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
