import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from '@playwright/test';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const FRONTEND_BASE_URL = (
  process.env.FRONTEND_BASE_URL || 'http://localhost:3000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const ADMIN_BASE_PATH = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const STORAGE_KEY = 'song-thanh-admin-auth';

type AdminSession = {
  access_token: string;
  refresh_token: string;
  user: Record<string, unknown>;
  permissions: string[];
};

let session: AdminSession;

const ADMIN_A11Y_ROUTES = [
  '/dashboard',
  '/audit-logs',
  '/banners',
  '/brands',
  '/contacts',
  '/customers',
  '/files',
  '/home-page',
  '/import',
  '/menu',
  '/page-contents',
  '/page-contents/new?template=about',
  '/page-contents/brand-pages',
  '/product-categories',
  '/product-categories/main',
  '/product-categories/sub',
  '/product-groups',
  '/product-variants',
  '/projects',
  '/quotes',
  '/redirects',
  '/roles',
  '/services',
  '/technical-documents',
  '/users',
  '/website-settings'
] as const;

const PUBLIC_A11Y_ROUTES = [
  '/',
  '/gioi-thieu',
  '/ho-so-nang-luc',
  '/san-pham',
  '/san-pham/danh-sach',
  '/doi-tac-thuong-hieu',
  '/tin-tuc',
  '/dich-vu',
  '/du-an',
  '/lien-he',
  '/tim-kiem'
] as const;

test.beforeAll(async ({ request }) => {
  session = await login(request);
});

test('A11Y-01: login and representative admin routes satisfy WCAG A/AA automation', async ({
  page
}) => {
  test.setTimeout(300_000);
  await page.goto(adminPath('/login'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await assertWcag(page, 'admin login');

  await seedAuth(page, session);
  for (const pathname of ADMIN_A11Y_ROUTES) {
    await page.goto(adminPath(pathname));
    await expect(page.locator('main')).toBeVisible();
    await expect(page).toHaveTitle('Song Thanh Admin');
    await waitForUiToSettle(page);
    await assertWcag(page, `admin ${pathname}`);
  }
});

test('A11Y-02: representative public routes satisfy WCAG A/AA automation', async ({
  page
}) => {
  // This is a whole-public-surface audit: 11 server-rendered routes plus an
  // Axe scan for each. The default 60s budget was expiring during navigation
  // even after the capability-profile page had rendered, so retain every
  // route and give the complete audit a realistic, explicit budget.
  test.setTimeout(300_000);

  for (const pathname of PUBLIC_A11Y_ROUTES) {
    await page.goto(`${FRONTEND_BASE_URL}${pathname}`);
    await expect(page.locator('main')).toBeVisible();
    await waitForUiToSettle(page);
    await assertWcag(page, `public ${pathname}`);
  }
});

test('A11Y-03: mobile drawers trap focus, restore focus and pages do not overflow', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FRONTEND_BASE_URL}/`);
  await assertNoHorizontalOverflow(page, 'public home');
  await assertMinimumControlTargets(page, 'public home');

  const publicTrigger = page.getByRole('button', { name: 'Mở menu' });
  await publicTrigger.focus();
  await publicTrigger.click();
  const publicDialog = page.getByRole('dialog', { name: 'Menu điều hướng' });
  await expect(publicDialog).toBeVisible();
  await expect(publicDialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(publicDialog).toHaveCount(0);
  await expect(publicTrigger).toBeFocused();

  await seedAuth(page, session);
  await page.goto(adminPath('/dashboard'));
  await assertNoHorizontalOverflow(page, 'admin dashboard');
  await assertMinimumControlTargets(page, 'admin dashboard');

  const adminTrigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
  await adminTrigger.focus();
  await adminTrigger.click();
  const adminDialog = page.getByRole('dialog', { name: 'Điều hướng quản trị' });
  await expect(adminDialog).toBeVisible();
  await expect(adminDialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(adminDialog).toHaveCount(0);
  await expect(adminTrigger).toBeFocused();

  await page.goto(adminPath('/page-contents'));
  await waitForUiToSettle(page);
  await assertNoHorizontalOverflow(page, 'admin page-content library');
  await assertMinimumControlTargets(page, 'admin page-content library');

  await page.goto(adminPath('/page-contents/new?template=about'));
  await expect(page.getByRole('heading', { name: 'Thiết lập nội dung trang Giới thiệu' })).toBeVisible();
  await assertNoHorizontalOverflow(page, 'admin page-content editor');
  await assertMinimumControlTargets(page, 'admin page-content editor');
});

test('RESP-UI-04: product and customer lists prioritize usable mobile data', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAuth(page, session);

  await page.goto(adminPath('/product-groups'));
  await expect(page.getByRole('heading', { name: 'Sản phẩm', exact: true })).toBeVisible();
  await waitForUiToSettle(page);

  const filterToggle = page.getByRole('button', { name: 'Hiện bộ lọc sản phẩm' });
  await expect(filterToggle).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Danh mục chính', exact: true })
  ).not.toBeVisible();
  await expect(page.getByLabel('Cập nhật trạng thái quản trị hàng loạt')).not.toBeVisible();

  const firstProduct = page.locator('article').first();
  await expect(firstProduct).toBeVisible();
  const firstProductBox = await firstProduct.boundingBox();
  expect(firstProductBox, 'product card must have a measurable mobile position').not.toBeNull();
  expect(firstProductBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(844);

  await filterToggle.click();
  await expect(
    page.getByRole('combobox', { name: 'Danh mục chính', exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Ẩn bộ lọc sản phẩm' }).click();

  await firstProduct.getByRole('checkbox').check({ force: true });
  await expect(page.getByLabel('Cập nhật trạng thái quản trị hàng loạt')).toBeVisible();
  await expect(page.getByLabel('Cập nhật hiển thị website hàng loạt')).toBeVisible();
  await assertNoHorizontalOverflow(page, 'admin product list');
  await assertMinimumControlTargets(page, 'admin product list');

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(adminPath('/product-groups'));
  await waitForUiToSettle(page);
  const productStatusCell = page.locator('[data-product-status-cell="true"]').first();
  await expect(productStatusCell).toBeVisible();
  await expect(productStatusCell.getByText(/Đang hiển thị|Chưa hiển thị/)).toBeVisible();
  await expect(productStatusCell).toContainText(/Đang dùng|Tạm ngưng|Chưa đặt/);
  await expect(productStatusCell).toContainText(/Đã duyệt|Chờ duyệt|Từ chối|Chưa đặt/);
  const productStatusBox = await productStatusCell.boundingBox();
  expect(productStatusBox).not.toBeNull();
  expect(productStatusBox!.height).toBeLessThanOrEqual(150);

  await page.setViewportSize({ width: 1536, height: 960 });
  await page.goto(adminPath('/projects'));
  await waitForUiToSettle(page);
  const firstProjectCard = page.locator('[data-domain-card="project"]').first();
  await expect(firstProjectCard).toBeVisible();
  const projectCardBox = await firstProjectCard.boundingBox();
  expect(projectCardBox).not.toBeNull();
  expect(projectCardBox!.width).toBeGreaterThanOrEqual(260);
  await assertNoHorizontalOverflow(page, 'admin project grid');

  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(adminPath('/customers'));
  await expect(page.getByRole('heading', { name: 'Thông tin khách hàng' })).toBeVisible();
  await waitForUiToSettle(page);
  const firstCustomerTitle = page.locator('article').first().locator('a').first();
  await expect(firstCustomerTitle).toHaveAttribute('href', /^\/admin\/customers\//);
  const customerTitleStyle = await firstCustomerTitle.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return { textOverflow: style.textOverflow, whiteSpace: style.whiteSpace };
  });
  expect(customerTitleStyle.whiteSpace).not.toBe('nowrap');
  expect(customerTitleStyle.textOverflow).not.toBe('ellipsis');
  const customerActions = page.locator('article').first().locator('[data-customer-actions="true"]');
  await expect(customerActions).toBeVisible();
  await customerActions.locator('summary').click();
  await expect(customerActions.getByRole('link', { name: /Sửa hồ sơ/ })).toBeVisible();
  const customerLifecycleAction = customerActions.getByRole('button', {
    name: /Lưu trữ hồ sơ|Khôi phục hồ sơ/
  });
  await expect(customerLifecycleAction).toBeVisible();
  await customerLifecycleAction.click();
  const customerLifecycleDialog = page.getByRole('dialog', {
    name: /Lưu trữ hồ sơ khách hàng|Khôi phục hồ sơ khách hàng/
  });
  await expect(customerLifecycleDialog).toBeVisible();
  await expect(customerLifecycleDialog).toContainText(/không bị xóa|xuất hiện lại/);
  await customerLifecycleDialog.getByRole('button', { name: 'Hủy' }).click();
  await assertNoHorizontalOverflow(page, 'admin customer list');
  await assertMinimumControlTargets(page, 'admin customer list');
});

test('RESP-UI-06: import batches remain compact and keep destructive actions secondary', async ({
  page
}) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/import'));
  await waitForUiToSettle(page);

  const firstBatch = page.locator('[data-import-batch-row="true"]').first();
  await expect(firstBatch).toBeVisible();
  await expect(firstBatch.locator('[data-import-batch-metrics="true"]')).toBeVisible();
  await expect(firstBatch.getByRole('button', { name: /Thao tác khác/ })).toBeVisible();
  const desktopBox = await firstBatch.boundingBox();
  expect(desktopBox).not.toBeNull();
  expect(desktopBox!.height).toBeLessThanOrEqual(180);

  await page.setViewportSize({ width: 320, height: 844 });
  await assertNoHorizontalOverflow(page, 'admin import batches');
  await assertMinimumControlTargets(page, 'admin import batches');
});

test('A11Y-04: quote and file dialogs are named, trap focus and restore the opener', async ({
  page,
  request
}) => {
  const productSlug = await firstPublishedProductSlug(request);
  await page.goto(`${FRONTEND_BASE_URL}/san-pham/${encodeURIComponent(productSlug)}`);

  const addToQuoteList = page.getByRole('button', { name: 'Lưu vào danh sách' });
  const requestQuoteButton = page.locator('[data-quote-action="open"]');
  await requestQuoteButton.scrollIntoViewIfNeeded();
  const requestQuoteBox = await requestQuoteButton.boundingBox();
  expect(requestQuoteBox).not.toBeNull();
  expect(requestQuoteBox!.y).toBeLessThan(page.viewportSize()!.height);
  await addToQuoteList.click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Sản phẩm đã có trong danh sách yêu cầu' })
  ).toBeVisible();

  const contactTrigger = page.locator('[data-floating-contact-trigger="true"]');
  await expect(contactTrigger).toBeVisible();
  await expect(contactTrigger).toHaveAccessibleName(/1 sản phẩm trong danh sách yêu cầu/);
  await contactTrigger.click();
  const quoteTrigger = page.locator('[data-floating-contact-panel="true"]')
    .getByRole('button', { name: /Danh sách yêu cầu/ });
  await quoteTrigger.click();

  const quoteDialog = page.getByRole('dialog', { name: 'Danh sách yêu cầu' });
  await expect(quoteDialog).toBeVisible();
  await expect(quoteDialog.locator(':focus')).toHaveCount(1);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await assertWcag(page, 'public quote dialog');
  await page.keyboard.press('Escape');
  await expect(quoteDialog).toHaveCount(0);
  await expect(quoteTrigger).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(contactTrigger).toBeFocused();

  await page.setViewportSize({ width: 360, height: 844 });
  await expect(contactTrigger).toBeVisible();
  await contactTrigger.click();
  const mobileQuoteTrigger = page.locator('[data-floating-contact-panel="true"]')
    .getByRole('button', { name: /Danh sách yêu cầu/ });
  await expect(mobileQuoteTrigger).toBeVisible();
  await mobileQuoteTrigger.click();
  await expect(quoteDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(quoteDialog).toHaveCount(0);
  await expect(mobileQuoteTrigger).toBeFocused();

  await seedAuth(page, session);
  await page.goto(adminPath('/files'));
  await waitForUiToSettle(page);
  await page.locator('[data-file-mode="files"]').click();

  const fileTrigger = page.locator('[data-file-detail-open="true"]').first();
  await expect(fileTrigger).toBeVisible();
  await fileTrigger.focus();
  await fileTrigger.click();

  const fileDialog = page.getByRole('dialog');
  await expect(fileDialog).toBeVisible();
  await expect(fileDialog).toHaveAccessibleName(/\S+/);
  await expect(fileDialog.locator(':focus')).toHaveCount(1);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await assertWcag(page, 'admin file detail dialog');
  await page.keyboard.press('Escape');
  await expect(fileDialog).toHaveCount(0);
  await expect(fileTrigger).toBeFocused();
});

test('A11Y-05: shell skip links move focus and admin field errors describe the control', async ({
  page
}) => {
  await page.goto(`${FRONTEND_BASE_URL}/`);
  await page.keyboard.press('Tab');
  const publicSkip = page.getByRole('link', { name: 'Đi đến nội dung chính' });
  await expect(publicSkip).toBeFocused();
  await publicSkip.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await seedAuth(page, session);
  await page.goto(adminPath('/dashboard'));
  await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible();
  await page.keyboard.press('Tab');
  if (await page.evaluate(() => document.activeElement?.tagName === 'NEXTJS-PORTAL')) {
    await page.keyboard.press('Tab');
  }
  const adminSkip = page.getByRole('link', { name: 'Đi đến nội dung chính' });
  await expect(adminSkip).toBeFocused();
  await adminSkip.press('Enter');
  await expect(page.locator('#admin-main-content')).toBeFocused();

  await page.goto(adminPath('/page-contents/new?template=about'));
  const title = page.getByLabel('Tiêu đề trang');
  await title.clear();
  await page.getByRole('button', { name: 'Lưu thiết lập' }).click();

  const error = page.locator('#page-content-title-error');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('Tiêu đề không được để trống.');
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(title).toHaveAttribute('aria-required', 'true');
  const errorId = await error.getAttribute('id');
  expect(errorId).toBeTruthy();
  await expect(title).toHaveAttribute('aria-errormessage', errorId!);
  await expect(title).toHaveAttribute('aria-describedby', new RegExp(`(^|\\s)${errorId}(\\s|$)`));
  await expect(title).toBeFocused();
});

test('RESP-UI-02: mobile contact actions stay collapsed until the customer opens them', async ({
  page
}) => {
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${FRONTEND_BASE_URL}/`);
    await waitForUiToSettle(page);

    expect(
      await countVisibleFixedContactActions(page),
      `${width}px must not show a vertical rail of contact actions`
    ).toBeLessThanOrEqual(1);

    const trigger = page.locator('[data-floating-contact-trigger="true"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();

    const panel = page.locator('[data-floating-contact-panel="true"]');
    await expect(panel).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(await panel.locator('a, button').count()).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await assertNoHorizontalOverflow(page, `public home ${width}px contact disclosure`);
  }
});

test('RESP-UI-03: mobile hero keeps carousel pagination clear of its quote action', async ({
  page
}) => {
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${FRONTEND_BASE_URL}/`);
    await waitForUiToSettle(page);

    const hero = page.getByRole('region', { name: 'Banner trang chủ' });
    const quoteAction = hero.getByRole('link', { name: 'Yêu cầu báo giá', exact: true });
    const pagination = hero.getByRole('button', { name: /Chuyển tới banner/ }).first();
    if ((await quoteAction.count()) === 0 || (await pagination.count()) === 0) continue;

    const actionBox = await quoteAction.boundingBox();
    const paginationBox = await pagination.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(paginationBox).not.toBeNull();
    expect(
      rectanglesOverlap(actionBox!, paginationBox!),
      `${width}px quote action overlaps carousel pagination`
    ).toBe(false);
    expect(
      paginationBox!.y - (actionBox!.y + actionBox!.height),
      `${width}px quote action needs a readable gap before pagination`
    ).toBeGreaterThanOrEqual(8);
  }
});

test('RESP-UI-05: product discovery stays concise and expands its grid on wide screens', async ({
  page,
  request
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FRONTEND_BASE_URL}/san-pham`);
  await waitForUiToSettle(page);

  const categoryExplorer = page.locator('[data-product-category-explorer="true"]');
  await expect(categoryExplorer).toBeVisible();
  const categoryTabs = categoryExplorer.getByRole('tab');
  const categoryCount = await categoryTabs.count();
  expect(categoryCount).toBeGreaterThan(1);
  await expect(categoryExplorer.getByRole('tabpanel')).toHaveCount(1);
  const previewCards = categoryExplorer.locator('[data-product-grid="true"] article');
  const previewCardCount = await previewCards.count();
  expect(previewCardCount).toBeGreaterThan(0);
  expect(previewCardCount).toBeLessThanOrEqual(4);

  const secondCategory = categoryTabs.nth(1);
  const secondCategoryLabel =
    (await secondCategory.locator('[data-category-name="true"]').textContent())?.trim() ?? '';
  await secondCategory.click();
  await expect(secondCategory).toHaveAttribute('aria-selected', 'true');
  await expect(categoryExplorer.getByRole('tabpanel')).toContainText(secondCategoryLabel);
  await assertNoHorizontalOverflow(page, 'public product overview at 390px');

  await page.goto(`${FRONTEND_BASE_URL}/san-pham/danh-sach`);
  await waitForUiToSettle(page);
  const visibleListingSearches = page.locator('input[type="search"]:visible');
  await expect(visibleListingSearches).toHaveCount(1);
  const firstListingCard = page.locator('[data-product-card="true"]').first();
  await expect(firstListingCard).toBeVisible();
  await expect(firstListingCard.getByRole('link', { name: /Xem chi tiết/ }).first()).toBeVisible();
  await expect(firstListingCard.locator('[data-product-card-primary-action="true"]')).toBeVisible();
  await expect(firstListingCard.locator('[data-product-card-secondary-action="true"]')).toBeVisible();
  const firstListingCardBox = await firstListingCard.boundingBox();
  expect(firstListingCardBox).not.toBeNull();
  expect(firstListingCardBox!.height).toBeLessThanOrEqual(410);
  await assertNoHorizontalOverflow(page, 'public product listing at 390px');

  const productSlug = await firstPublishedProductSlug(request);
  await page.goto(`${FRONTEND_BASE_URL}/san-pham/${encodeURIComponent(productSlug)}`);
  await waitForUiToSettle(page);
  const mobileRequestAction = page.locator('[data-product-primary-actions] [data-quote-action="open"]');
  const mobileRequestBox = await mobileRequestAction.boundingBox();
  expect(mobileRequestBox).not.toBeNull();
  expect(mobileRequestBox!.y).toBeLessThanOrEqual(1100);
  const mobileQuickSpecs = page.locator('[data-product-quick-specs="true"]');
  await expect(mobileQuickSpecs).toBeVisible();
  const mobileQuickSpecsBox = await mobileQuickSpecs.boundingBox();
  expect(mobileQuickSpecsBox).not.toBeNull();
  expect(mobileQuickSpecsBox!.height).toBeLessThanOrEqual(260);
  expect(
    mobileQuickSpecsBox!.y + mobileQuickSpecsBox!.height,
    'core specifications should be read before the quote decision'
  ).toBeLessThanOrEqual(mobileRequestBox!.y);
  await expect(page.locator('[data-current-product-crumb="true"]')).toBeHidden();
  await assertNoHorizontalOverflow(page, 'public product detail at 390px');

  await page.setViewportSize({ width: 3840, height: 1200 });
  await page.goto(`${FRONTEND_BASE_URL}/san-pham`);
  await waitForUiToSettle(page);
  const productHero = page.getByRole('region', { name: 'Banner trang sản phẩm' });
  if ((await productHero.count()) > 0) {
    const heroBox = await productHero.boundingBox();
    expect(heroBox).not.toBeNull();
    expect(heroBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.6);
  }

  await page.setViewportSize({ width: 2560, height: 1200 });
  await page.goto(`${FRONTEND_BASE_URL}/san-pham/danh-sach`);
  await waitForUiToSettle(page);
  const listingGrid = page.locator('[data-product-grid="true"]').first();
  await expect(listingGrid).toBeVisible();
  const listingColumns = await listingGrid.evaluate(
    (element) => window.getComputedStyle(element).gridTemplateColumns.split(' ').length
  );
  expect(listingColumns).toBeGreaterThanOrEqual(2);
  await assertNoHorizontalOverflow(page, 'public product listing at 2560px');
});

test('SEC-UI-01: web surfaces and API emit baseline browser security headers', async ({
  page,
  request
}) => {
  const publicResponse = await page.goto(`${FRONTEND_BASE_URL}/robots.txt`);
  expect(publicResponse).not.toBeNull();
  assertSecurityHeaders(publicResponse!.headers(), 'public');

  const adminResponse = await page.goto(adminPath('/login'));
  expect(adminResponse).not.toBeNull();
  assertSecurityHeaders(adminResponse!.headers(), 'admin');
  const adminFrameSources = getCspDirectiveTokens(
    adminResponse!.headers()['content-security-policy'],
    'frame-src'
  );
  expect(cspAllowsOrigin(adminFrameSources, new URL(FRONTEND_BASE_URL).origin)).toBe(true);

  const previewResponse = await request.get(
    `${FRONTEND_BASE_URL}/admin-preview/page-content`
  );
  expect(previewResponse.ok()).toBe(true);
  const previewHeaders = previewResponse.headers();
  expect(previewHeaders['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(previewHeaders['content-security-policy']).not.toContain("frame-ancestors 'none'");
  expect(previewHeaders['x-frame-options']).toBeUndefined();
  expect(previewHeaders['x-content-type-options']).toBe('nosniff');

  const apiResponse = await request.get(`${API_BASE_URL}/health`);
  expect(apiResponse.ok()).toBe(true);
  const apiHeaders = apiResponse.headers();
  expect(apiHeaders['x-content-type-options']).toBe('nosniff');
  expect(apiHeaders['x-frame-options']).toBe('SAMEORIGIN');
  expect(apiHeaders['referrer-policy']).toBe('no-referrer');
});

test('SEC-UI-02: login refuses an external returnTo target', async ({ page }) => {
  await page.goto(adminPath('/login?returnTo=%2F%2Fexample.com'));
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_BASE_PATH}/dashboard$`));
});

test('SEC-UI-03: login returns to the complete internal path including its query', async ({ page }) => {
  await page.goto(adminPath('/page-contents/new?template=about'));
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(
    `${adminPath('/page-contents/new')}?template=about`
  );
  await expect(page.getByRole('heading', { name: 'Thiết lập nội dung trang Giới thiệu' })).toBeVisible();
});

test('RES-UI-01: contact form preserves input and recovers after a network failure', async ({
  page
}) => {
  await page.goto(`${FRONTEND_BASE_URL}/lien-he`);

  const fullName = page.getByLabel('Họ và tên');
  const phone = page.getByLabel('Số điện thoại');
  const message = page.getByLabel('Nội dung liên hệ');
  const submit = page.getByRole('button', { name: 'Gửi yêu cầu' });

  await fullName.fill('Nguyễn Văn Kiểm Thử');
  await phone.fill('0901234567');
  await message.fill('Kiểm thử khả năng phục hồi khi kết nối mạng bị gián đoạn.');

  await page.context().setOffline(true);
  try {
    await submit.click();
    await expect(page.locator('form [role="alert"]')).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(fullName).toHaveValue('Nguyễn Văn Kiểm Thử');
    await expect(phone).toHaveValue('0901234567');
    await expect(message).toHaveValue(
      'Kiểm thử khả năng phục hồi khi kết nối mạng bị gián đoạn.'
    );
  } finally {
    await page.context().setOffline(false);
  }
});

async function assertWcag(page: Page, surface: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const details = results.violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 6)
        .map((node) => `${node.target.join(' ')}: ${node.failureSummary ?? violation.help}`)
        .join('\n');
      return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${nodes}`;
    })
    .join('\n\n');

  expect.soft(results.violations, `${surface} accessibility violations:\n${details}`).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page, surface: string) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(
    dimensions.scrollWidth,
    `${surface} horizontally overflows: ${JSON.stringify(dimensions)}`
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertMinimumControlTargets(page: Page, surface: string) {
  const undersized = await page.locator('button, a[href], input, select, textarea').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        rect.width === 0 ||
        rect.height === 0 ||
        htmlElement.closest('[aria-hidden="true"]')
      ) {
        return [];
      }
      if (htmlElement.getAttribute('aria-label') === 'Open Next.js Dev Tools') {
        return [];
      }
      if (htmlElement.matches('a.sr-only')) {
        return [];
      }
      const controlLabel = htmlElement.closest('label');
      if (
        htmlElement.matches('input.sr-only') &&
        controlLabel &&
        controlLabel.getBoundingClientRect().width >= 44 &&
        controlLabel.getBoundingClientRect().height >= 44
      ) {
        return [];
      }
      if (rect.width >= 44 && rect.height >= 44) {
        return [];
      }
      return [
        {
          tag: htmlElement.tagName.toLowerCase(),
          label:
            htmlElement.getAttribute('aria-label') ||
            htmlElement.getAttribute('name') ||
            htmlElement.textContent?.trim().slice(0, 80) ||
            '(unlabeled)',
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      ];
    })
  );

  expect(undersized, `${surface} controls smaller than 44x44: ${JSON.stringify(undersized)}`).toEqual(
    []
  );
}

function assertSecurityHeaders(headers: Record<string, string>, surface: string) {
  expect(headers['content-security-policy'], `${surface} CSP missing`).toContain(
    "frame-ancestors 'none'"
  );
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
}

async function countVisibleFixedContactActions(page: Page): Promise<number> {
  return page.locator('a[aria-label], button[aria-label]').evaluateAll((elements) =>
    elements.filter((element) => {
      const label = element.getAttribute('aria-label') || '';
      if (!/Gọi hotline|Mở danh sách yêu cầu|Facebook|Zalo|Messenger|WhatsApp|Telegram|YouTube|LinkedIn|TikTok|Instagram|Twitter|Lên đầu trang|Mở các cách liên hệ/i.test(label)) {
        return false;
      }
      const rect = (element as HTMLElement).getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      let current: Element | null = element;
      while (current) {
        if (window.getComputedStyle(current).position === 'fixed') return true;
        current = current.parentElement;
      }
      return false;
    }).length
  );
}

function rectanglesOverlap(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

function getCspDirectiveTokens(policy: string | undefined, directiveName: string): string[] {
  if (!policy) return [];
  const directive = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === directiveName || part.startsWith(`${directiveName} `));
  if (!directive) return [];
  return directive.split(/\s+/).slice(1);
}

function cspAllowsOrigin(sources: string[], origin: string): boolean {
  if (sources.includes(origin)) return true;
  const url = new URL(origin);
  return sources.includes(`${url.protocol}//${url.hostname}:*`);
}

async function waitForUiToSettle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 3000 }).catch(
    () => undefined
  );
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

async function login(request: APIRequestContext): Promise<AdminSession> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.91' },
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

async function firstPublishedProductSlug(request: APIRequestContext): Promise<string> {
  const response = await request.get(
    `${API_BASE_URL}/public/product-groups?page=1&page_size=20`
  );
  expect(response.ok(), `Public product list returned HTTP ${response.status()}`).toBe(true);
  const body = (await response.json()) as {
    data?: { items?: Array<{ slug?: unknown }>; product_groups?: Array<{ slug?: unknown }> };
    items?: Array<{ slug?: unknown }>;
    product_groups?: Array<{ slug?: unknown }>;
  };
  const data = body.data ?? body;
  const items = data.items ?? data.product_groups ?? [];
  const product = items.find((item) => typeof item.slug === 'string' && item.slug.length > 0);
  expect(product, 'QA needs at least one published product group').toBeTruthy();
  return String(product!.slug);
}

function normalizeAdminBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminPath(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${ADMIN_BASE_PATH}${normalizedPath}`;
}
