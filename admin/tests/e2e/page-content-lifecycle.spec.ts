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
const RUN_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const SLUG = `qa-ui-page-${RUN_ID}`;

type RecordMap = Record<string, unknown>;
type AdminSession = {
  access_token: string;
  refresh_token: string;
  user: RecordMap;
  permissions: string[];
  roles: string[];
};

let session: AdminSession;
let pageContentId = '';

const SYSTEM_PAGE_TEMPLATE_CASES = [
  { id: 'about', label: 'Giới thiệu công ty', formTitle: 'Thiết lập nội dung trang Giới thiệu', slug: 'gioi-thieu' },
  { id: 'products', label: 'Sản phẩm', formTitle: 'Thiết lập nội dung trang Sản phẩm', slug: 'san-pham' },
  {
    id: 'capability-profile',
    label: 'Hồ sơ năng lực',
    formTitle: 'Thiết lập nội dung trang Hồ sơ năng lực',
    slug: 'ho-so-nang-luc'
  },
  { id: 'services', label: 'Dịch vụ', formTitle: 'Thiết lập nội dung trang Dịch vụ', slug: 'dich-vu' },
  { id: 'projects', label: 'Dự án', formTitle: 'Thiết lập nội dung trang Dự án', slug: 'du-an' },
  {
    id: 'brands',
    label: 'Thương hiệu sản phẩm',
    formTitle: 'Thiết lập nội dung trang Thương hiệu',
    slug: 'doi-tac-thuong-hieu'
  },
  { id: 'news-index', label: 'Trang Tin tức', formTitle: 'Thiết lập nội dung trang Tin tức', slug: 'tin-tuc' },
  { id: 'contact', label: 'Liên hệ', formTitle: 'Thiết lập nội dung trang Liên hệ', slug: 'lien-he' }
] as const;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  assertSafeTarget();
  session = await login(request);
});

test.afterAll(async ({ request }) => {
  if (!session || !pageContentId) return;
  const response = await apiRequest(request, 'GET', `/song-thanh/page-contents/${pageContentId}`);
  if (!response.ok()) return;
  const record = pageRecord(await response.json());
  if (!record.deleted_at) {
    await apiRequest(request, 'POST', `/song-thanh/page-contents/${pageContentId}/archive`, {}).catch(
      () => undefined
    );
  }
});

test('a cached Super Admin session with missing roles reloads its access before showing the editor', async ({ page }) => {
  await seedAuth(page, { ...session, roles: [] });
  await page.goto(adminPath('/page-contents/new?template=about'));

  await expect(page.getByRole('heading', { name: 'Thiết lập nội dung trang Giới thiệu' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(window.sessionStorage.getItem('song-thanh-admin-auth') || '{}');
    return state.roles || [];
  })).toContain('super_admin');
  await expect(page.getByText('Duyệt nội dung', { exact: true })).toHaveCount(0);
});

test('the create hub exposes every page type and opens the matching editor', async ({ page }) => {
  test.setTimeout(120_000);
  await seedAuth(page, session);

  await page.goto(adminPath('/page-contents/new'));
  const createHub = page.locator('[data-page-content-create-hub="true"]');
  await expect(createHub).toBeVisible();

  for (const template of SYSTEM_PAGE_TEMPLATE_CASES) {
    await expect(
      createHub.getByRole('button', {
        name: new RegExp(`^(?:Thiết lập nội dung|Mở biên tập): ${template.label}$`)
      })
    ).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Bài tin tức / SEO', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trang tĩnh khác', exact: true })).toBeVisible();

  for (const template of SYSTEM_PAGE_TEMPLATE_CASES) {
    await page.goto(adminPath(`/page-contents/new?template=${template.id}`));
    await expect(page.getByRole('heading', { name: template.formTitle })).toBeVisible();
    await expect(page.locator(`input[value="${template.slug}"]`)).toBeVisible();
  }

  await page.goto(adminPath('/page-contents/new?template=contact'));
  await expect(page.getByRole('heading', { name: 'Lời mở đầu bổ sung' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ảnh chia sẻ trang liên hệ' })).toBeVisible();

  await page.locator(`a[href="${adminPath('/page-contents')}"]`).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => new URL(page.url()).pathname).toBe(adminPath('/page-contents'));

  await page.goto(adminPath('/page-contents/new?template=news'));
  await expect(page.getByRole('heading', { name: 'Viết bài tin tức' })).toBeVisible();
  await expect(page.getByText('/tin-tuc/', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('duong-dan-trang')).toBeVisible();

  await page.goto(adminPath('/page-contents/new?template=generic'));
  await expect(page.getByRole('heading', { name: 'Tạo trang tĩnh' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đổi loại' })).toBeVisible();
});

test('the publishing queue exposes deterministic lanes and keeps its filters in the URL', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  const listResponse = await apiRequest(
    request,
    'GET',
    '/song-thanh/page-contents?page=1&page_size=10&deleted_scope=all'
  );
  expect(listResponse.ok(), `List failed with HTTP ${listResponse.status()}`).toBe(true);
  const listData = unwrap((await listResponse.json()) as RecordMap);
  const listItems = Array.isArray(listData.items) ? (listData.items as RecordMap[]) : [];
  expect(listItems.length).toBeGreaterThan(0);
  for (const item of listItems) {
    expect(typeof item.has_meaningful_body).toBe('boolean');
    expect(typeof item.has_seo_title).toBe('boolean');
    expect(typeof item.has_seo_description).toBe('boolean');
  }

  await seedAuth(page, session);
  await page.goto(adminPath('/page-contents'));
  await expect(page.getByRole('heading', { name: 'Hàng đợi xuất bản' })).toBeVisible();

  const laneGroup = page.getByRole('group', { name: 'Lọc theo hàng đợi xuất bản' });
  for (const label of [
    'Cần xử lý',
    'Chờ duyệt',
    'Sẵn sàng xuất bản',
    'Đang hiển thị',
    'Lưu trữ',
    'Tất cả'
  ]) {
    await expect(laneGroup.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
  }

  await laneGroup.getByRole('button', { name: /^Tất cả/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('lane')).toBe('all');
  const kindFilter = page.getByRole('combobox', { name: 'Lọc theo loại nội dung' });
  await kindFilter.selectOption('news');
  await expect.poll(() => new URL(page.url()).searchParams.get('kind')).toBe('news');

  await page.reload();
  await expect(laneGroup.getByRole('button', { name: /^Tất cả/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(kindFilter).toHaveValue('news');

  const inspectorTrigger = page.locator('[data-content-inspector-open="true"]').first();
  await expect(inspectorTrigger).toBeVisible();
  await expect(inspectorTrigger).toHaveText(/mục cần sửa|cảnh báo|Đã kiểm tra/);
  await expect(page.getByText(/lỗi chặn/i)).toHaveCount(0);
  const firstContentRow = page.locator('[data-content-library-row="true"]').first();
  await expect(firstContentRow).toBeVisible();
  await expect(firstContentRow.locator('[data-content-row-actions="true"] a, [data-content-row-actions="true"] button')).toHaveCount(2);
  await inspectorTrigger.click();
  const inspector = page.getByRole('dialog', { name: /Kiểm tra:/ });
  await expect(inspector.locator('[data-content-inspector="true"]')).toBeVisible();
  await expect(inspector.getByRole('heading', { name: 'Nơi bị ảnh hưởng' })).toBeVisible();
  await expect(inspector.getByRole('heading', { name: 'Việc cần xử lý' })).toBeVisible();
  await expect(inspector).not.toContainText(/backend|api|guardrail|slug|public/i);
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Escape');
  await expect(inspector).toHaveCount(0);
  await expect(inspectorTrigger).toBeFocused();

  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    )
    .toBe(true);
});

test('the content workspace separates workflow, system pages and the content library', async ({
  page
}) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/page-contents'));

  const workspaceTabs = page.getByRole('tablist', { name: 'Chọn khu vực nội dung' });
  await expect(workspaceTabs).toBeVisible();
  await expect(page.locator('[data-content-workspace-tabs="compact"]')).toBeVisible();
  await expect(workspaceTabs.getByRole('tab', { name: 'Hàng đợi xuất bản' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByRole('heading', { name: 'Trang hệ thống', exact: true })).toHaveCount(0);

  await workspaceTabs.getByRole('tab', { name: 'Trang hệ thống' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('system');
  await expect(page.getByRole('heading', { name: 'Trang hệ thống', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hàng đợi xuất bản' })).toHaveCount(0);

  await workspaceTabs.getByRole('tab', { name: 'Thư viện nội dung' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('library');
  await expect(page.getByRole('heading', { name: 'Tin tức và trang phụ' })).toBeVisible();

  await page.goBack();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('system');
  await expect(workspaceTabs.getByRole('tab', { name: 'Trang hệ thống' })).toHaveAttribute(
    'aria-selected',
    'true'
  );

  await workspaceTabs.getByRole('tab', { name: 'Thư viện nội dung' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('view')).toBe('library');

  await page.reload();
  await expect(workspaceTabs.getByRole('tab', { name: 'Thư viện nội dung' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
});

test('the banner workspace restores its placement from a deep link', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await seedAuth(page, session);

  const listRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname.endsWith('/song-thanh/banners') &&
      url.searchParams.get('position') === '/san-pham'
    );
  });

  await page.goto(adminPath('/banners?position=/san-pham'));
  await listRequest;

  const placementFilter = page.locator('#banner-list-position');
  await expect(placementFilter).toContainText('Trang Sản phẩm');
  await testInfo.attach('bannerlist1440.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });

  await placementFilter.click();
  await page.getByRole('dialog', { name: 'Banner hiển thị ở đâu?' }).getByRole('button', { name: 'Trang chủ' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('position')).toBe('/');

  await page.reload();
  await expect(placementFilter).toContainText('Trang chủ');
});

test('the banner workspace warns when ordering is ambiguous inside one placement', async ({
  page
}) => {
  await seedAuth(page, session);
  await page.route('**/song-thanh/banners?*', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          items: [
            {
              id: '00000000-0000-4000-8000-000000000101',
              title: 'Banner A',
              position: 'san-pham',
              sort_order: 1,
              status: 'active',
              deleted_at: null,
              updated_at: '2026-08-14T08:00:00.000Z'
            },
            {
              id: '00000000-0000-4000-8000-000000000102',
              title: 'Banner B',
              position: 'san-pham',
              sort_order: 1,
              status: 'active',
              deleted_at: null,
              updated_at: '2026-08-14T07:00:00.000Z'
            }
          ],
          pagination: { page: 1, page_size: 20, total: 2 }
        }
      })
    });
  });

  await page.goto(adminPath('/banners?position=san-pham'));
  await expect(page.getByText('Thứ tự banner đang bị trùng.')).toBeVisible();
  await expect(page.getByText('Thứ tự 1 · Trùng')).toHaveCount(2);
});

test('the banner editor exposes ordering and desktop/mobile preview modes', async ({ page }, testInfo) => {
  await seedAuth(page, session);
  await page.goto(adminPath('/banners/new?position=san-pham'));

  await expect(page.getByRole('heading', { name: 'Tạo banner mới' })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Thứ tự hiển thị' })).toHaveValue('1');

  const previewMode = page.getByRole('group', { name: 'Chế độ xem banner' });
  await expect(previewMode.getByRole('button', { name: 'Máy tính' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await testInfo.attach('bannereditor1440.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  await previewMode.getByRole('button', { name: 'Điện thoại' }).click();
  await expect(page.locator('[data-banner-preview-mode="mobile"]')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  const previewBox = await page.locator('[data-banner-preview-workspace="true"]').boundingBox();
  const requiredBox = await page.locator('[data-banner-required="true"]').boundingBox();
  const creativeBox = await page.locator('[data-banner-creative="true"]').boundingBox();
  expect(previewBox).not.toBeNull();
  expect(requiredBox).not.toBeNull();
  expect(creativeBox).not.toBeNull();
  expect(previewBox!.y).toBeLessThan(requiredBox!.y);
  expect(requiredBox!.y).toBeLessThan(creativeBox!.y);
  await testInfo.attach('bannereditor320.png', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
});

test('banner image link is chosen by page name and keeps manual links optional', async ({ page }) => {
  await seedAuth(page, session);
  await page.route('**/public/search-suggestions?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { items: [{
        type: 'brand', title: 'CADIVI', subtitle: 'Thương hiệu', href: '/doi-tac-thuong-hieu/cadivi'
      }] } })
    });
  });
  await page.goto(adminPath('/banners/new?position=/'));
  const linkChoices = page.getByRole('group', { name: 'Click vào ảnh sẽ' });
  await linkChoices.getByRole('button', { name: /Mở trang trong website/ }).click();
  await page.locator('#banner-link-target').click();
  const dialog = page.getByRole('dialog', { name: 'Chọn trang đích' });
  await expect(dialog.getByRole('button', { name: 'Trang Dịch vụ' })).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Tìm trang, sản phẩm hoặc thương hiệu' }).fill('cadivi');
  await dialog.getByRole('button', { name: /CADIVI/ }).click();
  await expect(page.locator('#banner-link-target')).toContainText('CADIVI');
  await expect(page.locator('#banner-link-target')).toContainText('/doi-tac-thuong-hieu/cadivi');
  await linkChoices.getByRole('button', { name: /Mở website khác/ }).click();
  await expect(page.getByRole('textbox', { name: 'Địa chỉ website' })).toHaveValue('');
  await linkChoices.getByRole('button', { name: /Không mở trang nào/ }).click();
  await expect(page.locator('#banner-link-target')).toHaveCount(0);
});

test('banner editor chooses an exact page and a product link without entering a path', async ({ page }, testInfo) => {
  await seedAuth(page, session);
  await page.route('**/public/search-suggestions?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { items: [{
        type: 'product_group',
        title: 'Ống PVC D16 320N',
        subtitle: 'Sản phẩm',
        href: '/san-pham/ong-pvc-d16-320n'
      }, {
        type: 'brand', title: 'CADIVI', subtitle: 'Thương hiệu', href: '/doi-tac-thuong-hieu/cadivi'
      }] } })
    });
  });

  await page.goto(adminPath('/banners/new?position=/san-pham/danh-sach'));
  const pagePicker = page.locator('#banner-position');
  await expect(pagePicker).toContainText('Danh sách sản phẩm');
  await expect(page.getByText('Đây là kiểu trang, không phải danh sách từng thương hiệu.')).toHaveCount(0);
  await expect(page.getByText('Hiển thị trên ảnh ở chế độ Có nội dung; đồng thời dùng để quản lý và mô tả ảnh.')).toHaveCount(0);
  const pageHeightBeforePagePicker = await page.evaluate(() => document.documentElement.scrollHeight);
  await pagePicker.click();
  const pageDialog = page.getByRole('dialog', { name: 'Banner hiển thị ở đâu?' });
  await expect(pageDialog.getByRole('textbox', { name: 'Tìm trang hiển thị' })).toBeFocused();
  await testInfo.attach('bannerPagePickerDesktop.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
  await expect(pageDialog.getByRole('list', { name: 'Kết quả tìm trang hiển thị' }).getByRole('button')).toHaveCount(11);
  await expect(pageDialog.getByRole('button', { name: 'Trang Dịch vụ' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight)).toBe(pageHeightBeforePagePicker);
  await pageDialog.getByRole('textbox', { name: 'Tìm trang hiển thị' }).fill('giới thiệu');
  await pageDialog.getByRole('button', { name: 'Trang Giới thiệu' }).click();
  await expect(pagePicker).toContainText('Trang Giới thiệu');
  await pagePicker.click();
  await pageDialog.getByRole('textbox', { name: 'Tìm trang hiển thị' }).fill('CADIVI');
  await pageDialog.getByRole('button', { name: /CADIVI/ }).click();
  await expect(pagePicker).toContainText('CADIVI');
  await pagePicker.click();
  await pageDialog.getByRole('button', { name: 'Nhập đường dẫn riêng' }).click();
  await expect(pageDialog.getByRole('textbox', { name: 'Tìm trang hiển thị' })).toBeVisible();
  await pageDialog.getByRole('textbox', { name: 'Đường dẫn trang trên website' }).fill('/doi-tac-thuong-hieu/cadivi');
  await pageDialog.getByRole('button', { name: 'Dùng trang này' }).click();
  await expect(pagePicker).toContainText('/doi-tac-thuong-hieu/cadivi');
  await pagePicker.click();
  await pageDialog.getByRole('textbox', { name: 'Tìm trang hiển thị' }).fill('/doi-tac-thuong-hieu/cadivi');
  await pageDialog.getByRole('button', { name: /Dùng trang \/doi-tac-thuong-hieu\/cadivi/ }).click();
  await expect(pagePicker).toContainText('/doi-tac-thuong-hieu/cadivi');
  await page.getByRole('button', { name: 'Thêm nút' }).click();
  await page.getByRole('textbox', { name: 'Nhãn nút' }).fill('Xem ống PVC');
  const pageHeightBeforePicker = await page.evaluate(() => document.documentElement.scrollHeight);
  const firstPickerButton = page.locator('#banner-cta-url-0');
  const pickerButtonBefore = await firstPickerButton.boundingBox();
  await firstPickerButton.click();
  const pickerDialog = page.getByRole('dialog', { name: 'Chọn trang đích' });
  await expect(pickerDialog).toBeVisible();
  await testInfo.attach('bannerDestinationDesktop.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
  await expect(pickerDialog.getByRole('textbox', { name: 'Tìm trang, sản phẩm hoặc thương hiệu' })).toBeFocused();
  await expect(pickerDialog.getByRole('list', { name: 'Kết quả tìm đích' }).getByRole('button')).toHaveCount(11);
  await expect(pickerDialog.getByRole('button', { name: 'Trang Dịch vụ' })).toBeVisible();
  const pickerButtonAfter = await firstPickerButton.boundingBox();
  expect(pickerButtonBefore).not.toBeNull();
  expect(pickerButtonAfter).not.toBeNull();
  expect(Math.abs(pickerButtonAfter!.x - pickerButtonBefore!.x)).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight)).toBe(pageHeightBeforePicker);
  await page.keyboard.press('Escape');
  await expect(pickerDialog).toHaveCount(0);
  await expect(firstPickerButton).toBeFocused();
  await firstPickerButton.click();
  await pickerDialog.getByRole('textbox', { name: 'Tìm trang, sản phẩm hoặc thương hiệu' }).fill('ống PVC');
  await expect(pickerDialog.getByRole('button', { name: 'Trang chủ' })).toHaveCount(0);
  await page.getByRole('button', { name: /Ống PVC D16 320N/ }).click();
  await expect(firstPickerButton).toContainText('/san-pham/ong-pvc-d16-320n');
  await expect(page.getByRole('link', { name: 'Mở thử trang đích' })).toHaveAttribute('href', 'http://localhost:3000/san-pham/ong-pvc-d16-320n');

  await page.unroute('**/public/search-suggestions?*');
  await page.getByRole('button', { name: 'Thêm nút' }).click();
  await page.locator('#banner-cta-url-1').click();
  await page.getByRole('textbox', { name: 'Tìm trang, sản phẩm hoặc thương hiệu' }).fill('ống PVC');
  const liveResults = page.getByRole('list', { name: 'Kết quả tìm đích' });
  await expect(liveResults.getByRole('button').first()).toBeVisible();
  await liveResults.getByRole('button').first().click();
  await expect(page.locator('#banner-cta-url-1')).toContainText('/san-pham/');
  await page.setViewportSize({ width: 320, height: 844 });
  await firstPickerButton.click();
  const mobileDialog = page.getByRole('dialog', { name: 'Chọn trang đích' });
  await expect(mobileDialog).toBeVisible();
  await testInfo.attach('bannerDestinationMobile.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
  const mobileDialogBox = await mobileDialog.boundingBox();
  expect(mobileDialogBox).not.toBeNull();
  expect(mobileDialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(mobileDialogBox!.y + mobileDialogBox!.height).toBeLessThanOrEqual(844);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await pagePicker.click();
  const mobilePageDialog = page.getByRole('dialog', { name: 'Banner hiển thị ở đâu?' });
  await expect(mobilePageDialog).toBeVisible();
  await testInfo.attach('bannerPagePickerMobile.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
  const mobilePageDialogBox = await mobilePageDialog.boundingBox();
  expect(mobilePageDialogBox).not.toBeNull();
  expect(mobilePageDialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(mobilePageDialogBox!.y + mobilePageDialogBox!.height).toBeLessThanOrEqual(844);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('a listing banner opens its exact product and does not repeat on filtered results', async ({ page, request }, testInfo) => {
  const publicBaseURL = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const publicHome = await request.get(`${publicBaseURL}/san-pham/danh-sach`).catch(() => null);
  test.skip(!publicHome?.ok(), 'Public website is not running for cross-application banner testing.');

  const availableBannersResponse = await request.get(`${API_BASE_URL}/public/banners?position=hero`);
  expect(availableBannersResponse.ok()).toBe(true);
  const availableBanners = (await availableBannersResponse.json()).data.items as Array<{ image_file_id: string }>;
  test.skip(availableBanners.length === 0, 'No existing public banner image is available for a safe test banner.');
  const title = `QA danh sách sản phẩm ${RUN_ID}`;
  const productHref = '/san-pham/ong-pvc-d16-320n';
  const createdResponse = await apiRequest(request, 'POST', '/song-thanh/banners', {
    position: 'san-pham-danh-sach',
    title,
    description: 'Kiểm tra banner và đường dẫn sản phẩm',
    image_file_id: availableBanners[0].image_file_id,
    display_mode: 'content_overlay',
    link_type: 'none',
    cta_buttons: [{ text: 'Nút tạm', url: '/san-pham', color: '#1e40af', text_color: '#ffffff', style: 'solid' }],
    status: 'active',
    sort_order: -32768
  });
  const createdBody = await createdResponse.json();
  expect(createdResponse.ok(), `Banner create failed: ${JSON.stringify(createdBody)}`).toBe(true);
  const created = createdBody.data.banner as { id: string };
  let secondBannerId: string | null = null;
  try {
    await seedAuth(page, session);
    await page.goto(adminPath(`/banners/${created.id}`));
    await page.getByRole('textbox', { name: 'Nhãn nút' }).fill('Xem ống PVC');
    await page.locator('#banner-cta-url-0').click();
    const targetDialog = page.getByRole('dialog', { name: 'Chọn trang đích' });
    await targetDialog.getByRole('button', { name: 'Nhập đường dẫn riêng' }).click();
    await expect(targetDialog.getByRole('textbox', { name: 'Tìm trang, sản phẩm hoặc thương hiệu' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Đường dẫn trang hoặc website khác' }).fill(productHref);
    await page.getByRole('button', { name: 'Dùng đường dẫn này' }).click();
    await page.getByRole('button', { name: 'Lưu banner' }).click();
    await expect(page.getByText('Đã lưu banner.')).toBeVisible();

    await page.goto(adminPath('/banners?position=/san-pham/danh-sach'));
    const bannerRow = page.locator('[data-banner-row="true"]').filter({ hasText: title });
    await expect(bannerRow).toBeVisible();
    await expect(bannerRow.getByText(`Xem ống PVC → ${productHref}`)).toBeVisible();

    await page.goto(`${publicBaseURL}/san-pham/danh-sach`);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await testInfo.attach('productListingBannerDesktop.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
    await page.getByRole('link', { name: 'Xem ống PVC' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(productHref);

    const imageOnlyResponse = await request.put(`${API_BASE_URL}/song-thanh/banners/${created.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: { display_mode: 'image_only' }
    });
    expect(imageOnlyResponse.ok()).toBe(true);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${publicBaseURL}/san-pham/danh-sach`);
    await expect(page.getByRole('link', { name: 'Xem ống PVC' })).toBeVisible();
    await expect(page.locator('[data-banner-action-bar="true"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach('productListingBannerMobile.png', { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });

    const secondResponse = await apiRequest(request, 'POST', '/song-thanh/banners', {
      position: 'san-pham-danh-sach', title: `QA banner thứ hai ${RUN_ID}`,
      image_file_id: availableBanners[0].image_file_id, display_mode: 'image_only',
      link_type: 'none', status: 'active', sort_order: -32767
    });
    expect(secondResponse.ok()).toBe(true);
    secondBannerId = (await secondResponse.json()).data.banner.id as string;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    const bannerCarousel = page.locator('section[aria-label="Banner danh sách sản phẩm"]');
    await expect(bannerCarousel.getByRole('button', { name: 'Chuyển tới banner 2' })).toBeVisible();
    await expect(bannerCarousel.getByRole('link', { name: 'Xem ống PVC' })).toHaveCount(0);
    await expect(page.locator('[data-banner-action-bar="true"]').getByRole('link', { name: 'Xem ống PVC' })).toBeVisible();

    await page.goto(`${publicBaseURL}/san-pham/danh-sach?brands=cadivi`);
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
    await page.goto(`${publicBaseURL}/san-pham/danh-sach?page=2`);
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
  } finally {
    if (secondBannerId) {
      const archivedSecond = await apiRequest(request, 'POST', `/song-thanh/banners/${secondBannerId}/archive`, {});
      expect(archivedSecond.ok()).toBe(true);
    }
    const archived = await apiRequest(request, 'POST', `/song-thanh/banners/${created.id}/archive`, {});
    expect(archived.ok()).toBe(true);
  }
});

test('brand detail honors configured banner CTA and image link', async ({ page, request }) => {
  const publicBaseURL = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const brandSlug = 'cadivi';
  const publicBrandResponse = await request.get(`${publicBaseURL}/doi-tac-thuong-hieu/${brandSlug}`).catch(() => null);
  test.skip(!publicBrandResponse?.ok(), 'Public brand detail is not available for cross-application testing.');

  const brandListResponse = await apiRequest(request, 'GET', '/song-thanh/brand-pages?page_size=100');
  expect(brandListResponse.ok()).toBe(true);
  const brandRows = (await brandListResponse.json()).data.items as Array<{ brand_slug: string; page_id: string }>;
  const brandPageId = brandRows.find((row) => row.brand_slug === brandSlug)?.page_id;
  test.skip(!brandPageId, 'No editable CADIVI brand detail exists for the banner test.');
  const originalResponse = await apiRequest(request, 'GET', `/song-thanh/brand-pages/${brandPageId}`);
  expect(originalResponse.ok()).toBe(true);
  const originalHeroBannerId = (await originalResponse.json()).data.brand_page.hero_banner_id as string | null;
  test.skip(Boolean(originalHeroBannerId), 'The test brand already has a banner; preserve its live assignment.');

  const availableBannersResponse = await request.get(`${API_BASE_URL}/public/banners?position=hero`);
  const availableBanners = (await availableBannersResponse.json()).data.items as Array<{ image_file_id: string }>;
  test.skip(availableBanners.length === 0, 'No usable banner image is available.');
  const title = `QA banner thương hiệu ${RUN_ID}`;
  const createdResponse = await apiRequest(request, 'POST', '/song-thanh/banners', {
    position: 'brand-hero', title, image_file_id: availableBanners[0].image_file_id,
    display_mode: 'content_overlay', link_type: 'none', status: 'active',
    cta_buttons: [{ text: 'Xem ống PVC', url: '/san-pham/ong-pvc-d16-320n', color: '#1e40af', text_color: '#ffffff', style: 'solid' }]
  });
  const createdBody = await createdResponse.json();
  expect(createdResponse.ok(), JSON.stringify(createdBody)).toBe(true);
  const bannerId = createdBody.data.banner.id as string;
  let assigned = false;
  try {
    const assignResponse = await request.put(`${API_BASE_URL}/song-thanh/brand-pages/${brandPageId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: { hero_banner_id: bannerId }
    });
    expect(assignResponse.ok(), `Assign failed: ${await assignResponse.text()}`).toBe(true);
    assigned = true;

    await page.goto(`${publicBaseURL}/doi-tac-thuong-hieu/${brandSlug}`);
    await expect(page.getByRole('link', { name: 'Xem ống PVC' })).toBeVisible();
    await page.getByRole('link', { name: 'Xem ống PVC' }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/san-pham/ong-pvc-d16-320n');

    const anchorResponse = await request.put(`${API_BASE_URL}/song-thanh/banners/${bannerId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: { cta_buttons: [{ text: 'Tới mục 123', url: '#123', color: '#1e40af', text_color: '#ffffff', style: 'solid' }] }
    });
    expect(anchorResponse.ok()).toBe(true);
    await page.goto(`${publicBaseURL}/doi-tac-thuong-hieu/${brandSlug}`);
    await page.getByRole('link', { name: 'Tới mục 123' }).click();
    await expect.poll(() => new URL(page.url()).hash).toBe('#123');

    const imageOnlyResponse = await request.put(`${API_BASE_URL}/song-thanh/banners/${bannerId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: { display_mode: 'image_only', cta_buttons: [{ text: 'Xem ống PVC', url: '/san-pham/ong-pvc-d16-320n', color: '#1e40af', text_color: '#ffffff', style: 'solid' }] }
    });
    expect(imageOnlyResponse.ok()).toBe(true);
    await page.goto(`${publicBaseURL}/doi-tac-thuong-hieu/${brandSlug}`);
    await expect(page.getByRole('link', { name: 'Xem ống PVC' })).toBeVisible();

    const imageLinkResponse = await request.put(`${API_BASE_URL}/song-thanh/banners/${bannerId}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: { cta_buttons: null, link_type: 'internal', link_target: '/san-pham/danh-sach' }
    });
    expect(imageLinkResponse.ok()).toBe(true);
    await page.goto(`${publicBaseURL}/doi-tac-thuong-hieu/${brandSlug}`);
    await expect(page.getByRole('link', { name: `Mở banner ${title}` })).toHaveAttribute('href', '/san-pham/danh-sach');

    await seedAuth(page, session);
    await page.goto(adminPath(`/page-contents/brand-pages/${brandPageId}`));
    await expect(page.getByRole('link', { name: new RegExp(`Sửa banner đã gán trước đây: ${title}`) })).toHaveAttribute('href', adminPath(`/banners/${bannerId}`));
  } finally {
    if (assigned) {
      const restored = await request.put(`${API_BASE_URL}/song-thanh/brand-pages/${brandPageId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        data: { hero_banner_id: originalHeroBannerId }
      });
      expect(restored.ok()).toBe(true);
    }
    const archived = await apiRequest(request, 'POST', `/song-thanh/banners/${bannerId}/archive`, {});
    expect(archived.ok()).toBe(true);
  }
});

test('a banner assigned to a brand page appears without a separate brand-page assignment', async ({ page, request }) => {
  const publicBaseURL = (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const pagePath = '/doi-tac-thuong-hieu/cadivi';
  const brandPage = await request.get(`${publicBaseURL}${pagePath}`).catch(() => null);
  test.skip(!brandPage?.ok(), 'CADIVI public page is not available.');
  const current = await request.get(`${API_BASE_URL}/public/banners?position=${encodeURIComponent(pagePath)}`);
  expect(current.ok()).toBe(true);
  test.skip(((await current.json()).data.items as unknown[]).length > 0, 'Preserve an existing page-specific CADIVI banner.');
  const imageResponse = await request.get(`${API_BASE_URL}/public/banners?position=hero`);
  const images = (await imageResponse.json()).data.items as Array<{ image_file_id: string }>;
  test.skip(images.length === 0, 'No public banner image is available.');

  const title = `QA trang CADIVI ${RUN_ID}`;
  const response = await apiRequest(request, 'POST', '/song-thanh/banners', {
    position: pagePath,
    title,
    image_file_id: images[0].image_file_id,
    display_mode: 'content_overlay',
    link_type: 'none',
    cta_buttons: [{ text: 'Xem ống PVC', url: '/san-pham/ong-pvc-d16-320n', color: '#1e40af', text_color: '#ffffff', style: 'solid' }],
    status: 'active',
    sort_order: -32768
  });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBe(true);
  const id = body.data.banner.id as string;
  try {
    await page.goto(`${publicBaseURL}${pagePath}`);
    await expect(page.getByRole('link', { name: 'Xem ống PVC' })).toBeVisible();
    await seedAuth(page, session);
    await page.goto(adminPath(`/banners?position=${encodeURIComponent(pagePath)}`));
    await expect(page.locator('[data-banner-row="true"]').filter({ hasText: title })).toBeVisible();
    await expect(page.locator('#banner-list-position')).toContainText(/cadivi/i);
  } finally {
    const archived = await apiRequest(request, 'POST', `/song-thanh/banners/${id}/archive`, {});
    expect(archived.ok()).toBe(true);
  }
});

test('banner assignment accepts a future page path longer than the old position limit', async ({ request }) => {
  const imageResponse = await request.get(`${API_BASE_URL}/public/banners?position=hero`);
  const images = (await imageResponse.json()).data.items as Array<{ image_file_id: string }>;
  test.skip(images.length === 0, 'No banner image is available for the API test.');
  const futurePath = `/doi-tac-thuong-hieu/qa-thuong-hieu-tuong-lai-${RUN_ID}`;
  expect(futurePath.length).toBeGreaterThan(32);
  const response = await apiRequest(request, 'POST', '/song-thanh/banners', {
    position: futurePath,
    title: `QA đường dẫn dài ${RUN_ID}`,
    image_file_id: images[0].image_file_id,
    display_mode: 'image_only',
    link_type: 'none',
    status: 'inactive'
  });
  const body = await response.json();
  expect(response.ok(), JSON.stringify(body)).toBe(true);
  const id = body.data.banner.id as string;
  try {
    const found = await apiRequest(request, 'GET', `/song-thanh/banners?position=${encodeURIComponent(futurePath)}`);
    expect(found.ok()).toBe(true);
    const items = (await found.json()).data.items as Array<{ id: string }>;
    expect(items.some((item) => item.id === id)).toBe(true);
  } finally {
    const archived = await apiRequest(request, 'POST', `/song-thanh/banners/${id}/archive`, {});
    expect(archived.ok()).toBe(true);
  }
});

test('the publishing queue and lifecycle bar remain usable at four responsive boundaries', async ({
  page
}, testInfo) => {
  test.setTimeout(180_000);
  await seedAuth(page, session);

  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 844 : 960 });
    await page.goto(adminPath('/page-contents?lane=all'));
    await expect(page.getByRole('heading', { name: 'Hàng đợi xuất bản' })).toBeVisible();
    await expect(page.locator('[data-page-content-ready="true"]')).toBeVisible();
    if (width === 320) {
      await expect(page.locator('[data-pagination-compact="true"]')).toBeVisible();
      await expect(page.locator('[data-pagination-pages="true"]')).toBeHidden();
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await testInfo.attach(`queue${width}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png'
    });

    await page.goto(adminPath('/page-contents/new?template=about'));
    const lifecycleBar = page.locator('[data-page-lifecycle-bar="true"]');
    const commandBar = page.locator('[data-page-commandbar="true"]');
    const sectionNav = page.locator('[data-page-editor-sections="true"]');
    await expect(lifecycleBar).toBeVisible();
    await expect(lifecycleBar.getByText('Chưa hiển thị')).toBeVisible();
    if (width >= 1024) {
      await expect(commandBar).toHaveCSS('position', 'sticky');
    } else {
      await expect(sectionNav).toHaveCSS('position', 'sticky');
      await expect(lifecycleBar).toHaveCSS('position', 'static');
    }
    await expect(lifecycleBar.getByText(/Chưa lưu lần đầu/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xem trước' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu thiết lập' })).toBeVisible();
    await expect
      .poll(async () => {
        const box = await lifecycleBar.boundingBox();
        return Boolean(box && box.x >= 0 && box.x + box.width <= width);
      })
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await testInfo.attach(`editor${width}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png'
    });
  }
});

test('news-category management exposes bounded fields and a recoverable archive flow', async ({
  page
}) => {
  test.setTimeout(90_000);
  await seedAuth(page, session);
  const categoryName = `QA category ${RUN_ID}`;
  const categorySlug = `qa-category-${RUN_ID}`;

  await page.goto(adminPath('/page-contents'));
  await page
    .getByRole('tablist', { name: 'Chọn khu vực nội dung' })
    .getByRole('tab', { name: 'Thư viện nội dung' })
    .click();
  await page.getByRole('button', { name: /Chuyên mục tin tức Nhóm bài viết/ }).click();
  await page.getByRole('button', { name: 'Mở quản lý' }).click();
  await page.getByRole('button', { name: 'Tạo chuyên mục' }).first().click();

  const nameInput = page.getByRole('textbox', { name: 'Tên chuyên mục' });
  const slugInput = page.getByRole('textbox', { name: 'Đường dẫn chuyên mục' });
  const sortInput = page.getByRole('spinbutton', { name: 'Thứ tự chuyên mục' });
  await expect(nameInput).toHaveAttribute('maxlength', '100');
  await expect(slugInput).toHaveAttribute('maxlength', '100');
  await expect(sortInput).toHaveAttribute('min', '0');
  await expect(sortInput).toHaveAttribute('max', '9999');
  await nameInput.fill(categoryName);
  await slugInput.fill(categorySlug);
  await sortInput.fill('9999');
  await page.getByRole('button', { name: 'Tạo', exact: true }).click();
  const createdDialog = page.getByRole('dialog', { name: 'Đã tạo chuyên mục' });
  await expect(createdDialog).toBeVisible();
  await createdDialog.getByRole('button', { name: 'Đóng' }).last().click();

  await page.getByRole('button', { name: `Sửa chuyên mục ${categoryName}` }).click();
  await expect(page.getByRole('spinbutton', { name: 'Thứ tự chuyên mục' })).toHaveValue('9999');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();

  await page.getByRole('button', { name: `Lưu trữ chuyên mục ${categoryName}` }).click();
  const archiveDialog = page.getByRole('dialog', { name: 'Lưu trữ chuyên mục tin tức?' });
  await expect(
    archiveDialog.getByText('Hệ thống sẽ chặn thao tác nếu vẫn còn bài viết đang dùng chuyên mục này.')
  ).toBeVisible();
  await archiveDialog.getByRole('button', { name: 'Lưu trữ' }).click();
  const archivedDialog = page.getByRole('dialog', { name: 'Đã lưu trữ chuyên mục' });
  await expect(archivedDialog).toBeVisible();
  await archivedDialog.getByRole('button', { name: 'Đóng' }).last().click();
  await page.getByRole('button', { name: `Khôi phục chuyên mục ${categoryName}` }).click();
  await expect(page.getByRole('dialog', { name: 'Đã khôi phục chuyên mục' })).toBeVisible();
});

test('the page editor validates deep blocks, previews draft content, and loads live data only on demand', async ({
  page
}) => {
  test.setTimeout(180_000);
  await seedAuth(page, session);
  const previewWarmup = await page.request.get(
    'http://localhost:3000/admin-preview/page-content'
  );
  expect(previewWarmup.ok(), `Preview warmup failed with HTTP ${previewWarmup.status()}`).toBe(true);
  const previewClientErrors: string[] = [];
  page.on('pageerror', (error) => {
    previewClientErrors.push(`pageerror: ${error.message}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/_next/static/chunks/')) {
      previewClientErrors.push(`http-${response.status()}: ${response.url()}`);
    }
  });
  await page.addInitScript(() => {
    const messages: Array<Record<string, unknown>> = [];
    Object.defineProperty(window, '__qaPreviewMessages', {
      configurable: true,
      value: messages
    });
    window.addEventListener('message', (event) => {
      const data =
        typeof event.data === 'object' && event.data !== null
          ? (event.data as Record<string, unknown>)
          : {};
      const payload =
        typeof data.payload === 'object' && data.payload !== null
          ? (data.payload as Record<string, unknown>)
          : {};
      const extraBlocks =
        typeof payload.extra_blocks === 'object' && payload.extra_blocks !== null
          ? (payload.extra_blocks as Record<string, unknown>)
          : {};
      messages.push({
        origin: event.origin,
        type: data.type,
        previewMode: payload.preview_mode,
        blockCount: Array.isArray(extraBlocks.blocks) ? extraBlocks.blocks.length : null
      });
    });
  });
  const liveDataRequests: string[] = [];
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    const loadsPageInventory =
      pathname.startsWith('/public/banners') ||
      pathname.startsWith('/public/brands') ||
      pathname.startsWith('/public/product-categories') ||
      pathname.startsWith('/public/product-groups') ||
      pathname.startsWith('/public/services') ||
      pathname.startsWith('/public/projects');
    if (loadsPageInventory) {
      liveDataRequests.push(request.url());
    }
  });

  await page.goto(adminPath('/page-contents/new?template=about'));
  await expect(page.getByRole('heading', { name: 'Thiết lập nội dung trang Giới thiệu' })).toBeVisible();
  await expect(
    page.getByRole('toolbar', { name: 'Nội dung giới thiệu công ty – công cụ định dạng' })
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nội dung giới thiệu công ty' })).toBeVisible();
  const publicStructureToggle = page.getByRole('button', { name: /Cấu trúc trang website/ });
  await expect(publicStructureToggle).toHaveAttribute('aria-expanded', 'false');
  await publicStructureToggle.click();
  await expect(publicStructureToggle).toHaveAttribute('aria-expanded', 'true');
  const publicStructure = page.getByRole('region', { name: 'Cấu trúc trang website' });
  await expect(publicStructure.getByText('Năng lực cốt lõi')).toBeVisible();

  const fixedComponentsToggle = page.getByText('Thành phần cố định', { exact: true });
  await fixedComponentsToggle.click();
  await expect(
    page
      .getByText('Website chỉ dùng block mẫu này khi trang Giới thiệu chưa có khối nội dung phụ.')
      .filter({ visible: true })
  ).toBeVisible();
  expect(liveDataRequests).toHaveLength(0);

  const liveDataToggle = page.getByRole('button', { name: /Đang hiện ngoài web/ });
  await expect(liveDataToggle).toHaveAttribute('aria-expanded', 'false');
  await liveDataToggle.click();
  await expect(liveDataToggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => liveDataRequests.length).toBeGreaterThanOrEqual(13);
  await expect(page.getByText('Đang lấy dữ liệu đang hiển thị...')).toBeHidden();

  await page.getByRole('button', { name: 'Thêm danh sách bullet' }).click();
  const bulletInput = page.getByRole('textbox', { name: 'Nội dung dòng 1' });
  await expect(bulletInput).toHaveAttribute('maxlength', '1000');
  await expect(page.getByRole('button', { name: 'Di chuyển dòng 1 lên' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Xóa Khối 1 chưa đặt tên/ })).toBeVisible();
  await bulletInput.fill('Nội dung block đang sửa chưa lưu');

  await page.getByRole('button', { name: 'Thêm liên kết cho dòng 1' }).click();
  const targetInput = page.getByRole('textbox', { name: 'Đích liên kết của dòng 1' });
  await expect(targetInput).toHaveAttribute('maxlength', '2048');
  await targetInput.fill('javascript:alert(1)');
  await expect(
    page.getByText('Liên kết chưa hợp lệ. Dùng đường dẫn bắt đầu bằng / hoặc #, hay địa chỉ http/https.')
  ).toBeVisible();
  await targetInput.fill('/san-pham');
  await expect(page.getByText('Liên kết chưa hợp lệ. Dùng đường dẫn bắt đầu bằng /')).toBeHidden();

  await page.getByRole('button', { name: 'Xem trước' }).click();
  const previewDialog = page.getByRole('dialog', { name: /Xem trước/ });
  await expect(previewDialog).toBeVisible();
  const previewFrame = previewDialog.frameLocator('iframe[title^="Preview"]');
  await expect
    .poll(async () =>
      previewFrame.locator('body').evaluate(() => {
        const state = window as typeof window & {
          __qaPreviewMessages?: Array<Record<string, unknown>>;
        };
        return state.__qaPreviewMessages?.length ?? 0;
      })
    )
    .toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const ready = await page.evaluate(() => {
        const state = window as typeof window & {
          __qaPreviewMessages?: Array<Record<string, unknown>>;
        };
        return Boolean(
          state.__qaPreviewMessages?.some(
            (item) =>
              item.origin === 'http://localhost:3000' &&
              item.type === 'song-thanh:page-content-preview:ready'
          )
        );
      });
      return ready ? 'ready' : previewClientErrors.join('\n') || 'waiting-for-ready';
    }
    )
    .toBe('ready');
  const previewMessageEvidence = await previewFrame.locator('body').evaluate(() => {
    const state = window as typeof window & {
      __qaPreviewMessages?: Array<Record<string, unknown>>;
    };
    return state.__qaPreviewMessages ?? [];
  });
  const parentMessageEvidence = await page.evaluate(() => {
    const state = window as typeof window & {
      __qaPreviewMessages?: Array<Record<string, unknown>>;
    };
    return state.__qaPreviewMessages ?? [];
  });
  await test.info().attach('preview-message-evidence.json', {
    body: JSON.stringify(
      { iframe: previewMessageEvidence, parent: parentMessageEvidence },
      null,
      2
    ),
    contentType: 'application/json'
  });
  expect(
    previewMessageEvidence.some(
      (item) =>
        item.origin === 'http://localhost:3001' &&
        item.type === 'song-thanh:page-content-preview' &&
        item.previewMode === 'about' &&
        item.blockCount === 1
    ),
    JSON.stringify(previewMessageEvidence)
  ).toBe(true);
  expect(
    parentMessageEvidence.some(
      (item) =>
        item.origin === 'http://localhost:3000' &&
        item.type === 'song-thanh:page-content-preview:ready'
    ),
    JSON.stringify(parentMessageEvidence)
  ).toBe(true);
  expect(previewClientErrors, previewClientErrors.join('\n')).toEqual([]);
  await expect(
    previewFrame.getByText('Nội dung block đang sửa chưa lưu'),
    `Preview received messages: ${JSON.stringify({ iframe: previewMessageEvidence, parent: parentMessageEvidence })}`
  ).toBeVisible();
  await previewDialog.getByRole('button', { name: 'Mobile' }).click();
  await expect.poll(async () => {
    const box = await previewDialog.locator('iframe[title^="Preview"]').boundingBox();
    return Math.round(box?.width ?? 9999);
  }).toBeLessThanOrEqual(390);

  await previewDialog.getByRole('button', { name: 'Đóng' }).click();
  await page.goto(adminPath('/page-contents/new?template=projects'));
  await expect(page.getByRole('heading', { name: 'Thiết lập nội dung trang Dự án' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm danh sách bullet' }).click();
  await page
    .getByPlaceholder('Nội dung dòng')
    .fill('Khối phụ Dự án chưa lưu phải xuất hiện trong preview');
  await page.getByRole('button', { name: 'Xem trước' }).click();
  const projectPreviewDialog = page.getByRole('dialog', { name: /Xem trước Dự án/ });
  const projectPreviewFrame = projectPreviewDialog.frameLocator('iframe[title^="Preview"]');
  await expect(
    projectPreviewFrame.getByText('Khối phụ Dự án chưa lưu phải xuất hiện trong preview')
  ).toBeVisible();
  await projectPreviewDialog.getByRole('button', { name: 'Đóng' }).click();
  await page.getByRole('link', { name: 'Trang nội dung', exact: true }).first().click();
  const unsavedDialog = page.getByRole('dialog', { name: 'Rời trang khi chưa lưu?' });
  await expect(unsavedDialog).toBeVisible();
  await unsavedDialog.getByRole('button', { name: 'Rời trang', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_BASE_PATH}/page-contents$`));

  await page.goto(adminPath('/page-contents/new?template=brands'));
  await expect(page.getByRole('heading', { name: 'Lời giới thiệu thương hiệu' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ảnh chia sẻ & xem trước' })).toBeVisible();
  await page.locator('[contenteditable="true"]').first().fill('Lời giới thiệu thương hiệu chưa lưu phải xuất hiện trong preview');
  await page.getByRole('button', { name: 'Xem trước' }).click();
  const brandsPreviewDialog = page.getByRole('dialog', { name: /Xem trước Thương hiệu/ });
  const brandsPreviewFrame = brandsPreviewDialog.frameLocator('iframe[title^="Preview"]');
  await expect(
    brandsPreviewFrame.getByText('Lời giới thiệu thương hiệu chưa lưu phải xuất hiện trong preview')
  ).toBeVisible();
  await brandsPreviewDialog.getByRole('button', { name: 'Đóng' }).click();

  await page.goto(adminPath('/page-contents/new?template=products'));
  await page.locator('[contenteditable="true"]').first().fill('Giới thiệu danh mục trong bản xem trước');
  await page.getByRole('button', { name: 'Xem trước' }).click();
  const productsPreviewFrame = page
    .getByRole('dialog', { name: /Xem trước Sản phẩm/ })
    .frameLocator('iframe[title^="Preview"]');
  await expect(productsPreviewFrame.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
  const productExplorer = productsPreviewFrame.locator('[data-product-category-explorer="true"]');
  const productEditorial = productsPreviewFrame.locator('[data-product-editorial-copy="true"]');
  await expect(productExplorer).toBeVisible();
  await expect(productEditorial).toContainText('Giới thiệu danh mục trong bản xem trước');
  expect((await productEditorial.boundingBox())!.y).toBeGreaterThan((await productExplorer.boundingBox())!.y);
  await expect(productsPreviewFrame.getByPlaceholder(/tên, model hoặc thương hiệu/i)).toHaveCount(0);
  await page.getByRole('dialog', { name: /Xem trước Sản phẩm/ }).getByRole('button', { name: 'Đóng' }).click();

  await page.goto(adminPath('/page-contents/new?template=capability-profile'));
  await page.getByRole('button', { name: 'Xem trước' }).click();
  const capabilityPreviewFrame = page
    .getByRole('dialog', { name: /Xem trước Hồ sơ năng lực/ })
    .frameLocator('iframe[title^="Preview"]');
  await expect(capabilityPreviewFrame.getByText('Tải PDF', { exact: true }).first()).toBeVisible();
  await expect(capabilityPreviewFrame.getByText('Trang 12', { exact: true })).toBeVisible();
  await page.getByRole('dialog', { name: /Xem trước Hồ sơ năng lực/ }).getByRole('button', { name: 'Đóng' }).click();

  await page.goto(adminPath('/page-contents/new?template=news-index'));
  await page.getByRole('button', { name: 'Xem trước' }).click();
  const newsIndexPreviewFrame = page
    .getByRole('dialog', { name: /Xem trước Tin tức/ })
    .frameLocator('iframe[title^="Preview"]');
  await expect(newsIndexPreviewFrame.getByPlaceholder('Nhập từ khóa...')).toBeVisible();
  await expect(newsIndexPreviewFrame.locator('[data-news-feed="true"]')).toBeVisible();
});

test('create, publish, edit, archive and restore a page through the admin UI', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  await seedAuth(page, session);

  await test.step('open the create hub and choose a custom static page', async () => {
    await page.goto(adminPath('/page-contents/new'));
    await expect(
      page.getByRole('heading', { name: 'Chọn đúng khu vực cần cập nhật' })
    ).toBeVisible();
    await page.getByRole('button', { name: /Trang tĩnh khác/ }).click();
    await expect(page.getByRole('heading', { name: 'Tạo trang tĩnh' })).toBeVisible();
    await expect(page.locator('[data-page-lifecycle-bar="true"]')).toBeVisible();
    await expect(page.locator('[data-page-lifecycle-bar="true"]').getByText('Chưa hiển thị')).toBeVisible();
  });

  await test.step('create a draft with generated slug and body content', async () => {
    await page.getByPlaceholder('Chính sách hoặc trang thông tin').fill(`QA UI page ${RUN_ID}`);
    await page.getByPlaceholder('duong-dan-trang').fill(SLUG);
    await page
      .getByPlaceholder('Một đoạn ngắn giải thích trang này dùng để làm gì.')
      .fill('Trang tạm dùng để kiểm tra đầy đủ luồng biên tập nội dung.');
    await page.locator('.ProseMirror').fill('Nội dung QA ban đầu được tạo từ giao diện quản trị.');
    await expect(page.locator('[data-page-lifecycle-bar="true"]').getByText(/thay đổi chưa lưu/)).toBeVisible();
    await page.getByRole('button', { name: 'Tạo nội dung' }).click();
    await page.getByRole('dialog', { name: 'Đã tạo nội dung' }).getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    await expect(page).toHaveURL(
      new RegExp(`${ADMIN_BASE_PATH}/page-contents/[0-9a-f]{8}-[0-9a-f-]{27}$`, 'i')
    );
    pageContentId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1) || '';
    expect(pageContentId).not.toBe('');
    await expect(page.locator('[data-page-lifecycle-bar="true"]').getByText('Đã lưu', { exact: true })).toBeVisible();

    const adminResponse = await apiRequest(
      request,
      'GET',
      `/song-thanh/page-contents/${pageContentId}`
    );
    const adminBody = (await adminResponse.json()) as RecordMap;
    expect(
      adminResponse.ok(),
      `GET page content ${pageContentId} returned HTTP ${adminResponse.status()}: ${JSON.stringify(adminBody)}`
    ).toBe(true);
    expect(pageRecord(adminBody).slug).toBe(SLUG);

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.status()).toBe(404);
  });

  await test.step('super admin saves, then publishes without self-approval', async () => {
    await expect(page.locator('[data-content-readiness="warning"]')).toContainText('Thiếu mô tả SEO');

    await page.getByRole('button', { name: /SEO và chia sẻ/ }).click();
    await page
      .getByPlaceholder('Nếu để trống sẽ dùng tiêu đề trang')
      .fill(`QA UI SEO ${RUN_ID}`);
    await page
      .getByPlaceholder('Tóm tắt 140-160 ký tự cho Google và chia sẻ link')
      .fill('Mô tả SEO tạm dùng để xác nhận trang hợp lệ trước khi được đăng công khai.');

    await expect(page.getByText(/thay đổi chưa lưu/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xuất bản', exact: true })).toHaveCount(0);
    const saveRequest = page.waitForRequest((request) =>
      request.method() === 'PUT' && request.url().endsWith(`/song-thanh/page-contents/${pageContentId}`)
    );
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    const savePayload = (await saveRequest).postDataJSON() as RecordMap;
    expect(savePayload).not.toHaveProperty('review_status');
    expect(savePayload).not.toHaveProperty('publish_status');
    await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();
    await page.getByRole('dialog', { name: 'Đã lưu thay đổi' }).getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    let adminResponse = await apiRequest(request, 'GET', `/song-thanh/page-contents/${pageContentId}`);
    expect(adminResponse.ok()).toBe(true);
    let adminRecord = pageRecord(await adminResponse.json());
    expect(adminRecord.review_status).toBe('draft');
    expect(adminRecord.publish_status).toBe('unpublished');
    await expect(page.getByRole('button', { name: 'Gửi duyệt', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Xuất bản', exact: true })).toBeEnabled();

    await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Xuất bản ra website?' })
      .getByRole('button', { name: 'Xuất bản' })
      .click();
    await expect(page.getByText('Đã xuất bản trên website.')).toBeVisible();
    await page.getByRole('dialog', { name: 'Đã xuất bản' }).getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.ok()).toBe(true);
    const record = publicPageRecord(await publicResponse.json());
    expect(record.slug).toBe(SLUG);

    adminResponse = await apiRequest(request, 'GET', `/song-thanh/page-contents/${pageContentId}`);
    expect(adminResponse.ok()).toBe(true);
    adminRecord = pageRecord(await adminResponse.json());
    expect(adminRecord.review_status).toBe('approved');
    expect(adminRecord.publish_status).toBe('published');

    const publicPage = await page.context().newPage();
    await publicPage.goto(`http://localhost:3000/${SLUG}`);
    await expect(publicPage.getByRole('heading', { name: `QA UI page ${RUN_ID}` })).toBeVisible();
    await expect(publicPage.getByText('Nội dung QA ban đầu')).toBeVisible();
    await publicPage.close();
  });

  await test.step('Super Admin edit keeps approved content public', async () => {
    const updatedTitle = `QA UI page updated ${RUN_ID}`;
    await page.getByPlaceholder('Chính sách hoặc trang thông tin').fill(updatedTitle);
    await page.locator('.ProseMirror').fill('Nội dung QA đã cập nhật từ giao diện quản trị.');
    if (!(await page.getByPlaceholder('Nếu để trống sẽ dùng tiêu đề trang').isVisible())) {
      await page.getByRole('button', { name: /SEO và chia sẻ/ }).click();
    }
    await page
      .getByPlaceholder('Nếu để trống sẽ dùng tiêu đề trang')
      .fill(`QA UI SEO ${RUN_ID}`);
    await page
      .getByPlaceholder('Tóm tắt 140-160 ký tự cho Google và chia sẻ link')
      .fill('Mô tả SEO tạm dùng để xác nhận dữ liệu admin được chuyển đúng sang API public.');
    const saveRequest = page.waitForRequest((request) =>
      request.method() === 'PUT' && request.url().endsWith(`/song-thanh/page-contents/${pageContentId}`)
    );
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    const savePayload = (await saveRequest).postDataJSON() as RecordMap;
    expect(savePayload).not.toHaveProperty('review_status');
    expect(savePayload).not.toHaveProperty('publish_status');
    await expect(page.getByRole('dialog', { name: 'Đã lưu thay đổi' })).toContainText('Đã lưu thay đổi.');
    await page.getByRole('dialog', { name: 'Đã lưu thay đổi' }).getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();

    const adminResponse = await apiRequest(
      request,
      'GET',
      `/song-thanh/page-contents/${pageContentId}`
    );
    expect(adminResponse.ok()).toBe(true);
    const record = pageRecord(await adminResponse.json());
    expect(record.review_status).toBe('approved');
    expect(record.publish_status).toBe('published');

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.ok()).toBe(true);
    const publicRecord = publicPageRecord(await publicResponse.json());
    expect(publicRecord.title).toBe(updatedTitle);
    expect(String(publicRecord.content_html)).toContain('Nội dung QA đã cập nhật');
    expect(publicRecord.seo_title).toBe(`QA UI SEO ${RUN_ID}`);
  });

  await test.step('archive hides the page but keeps it recoverable', async () => {
    await page.getByText('Thao tác khác', { exact: true }).click();
    await page.getByRole('button', { name: 'Lưu trữ nội dung' }).click();
    const dialog = page.getByRole('dialog', { name: 'Lưu trữ nội dung?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Lưu trữ' }).click();
    await expect(page.getByText('Đã lưu trữ bản ghi.')).toBeVisible();
    await page.getByRole('dialog', { name: 'Đã lưu trữ nội dung' }).getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    await expect(page.getByRole('button', { name: 'Khôi phục' })).toBeVisible();

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.status()).toBe(404);
  });

  await test.step('restore is safe and does not republish automatically', async () => {
    await page.getByRole('button', { name: 'Khôi phục' }).click();
    const dialog = page.getByRole('dialog', { name: 'Khôi phục nội dung?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Khôi phục' }).click();
    await expect(page.getByText('Đã khôi phục bản ghi.')).toBeVisible();
    await page.getByRole('dialog', { name: 'Đã khôi phục nội dung' }).getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
    const adminResponse = await apiRequest(request, 'GET', `/song-thanh/page-contents/${pageContentId}`);
    expect(adminResponse.ok()).toBe(true);
    expect(pageRecord(await adminResponse.json()).publish_status).toBe('unpublished');

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.status()).toBe(404);
  });
});

test('two admin sessions cannot silently overwrite the same page content', async ({
  page,
  request
}) => {
  test.setTimeout(90_000);
  expect(pageContentId).not.toBe('');
  await seedAuth(page, session);
  const secondAdmin = await page.context().newPage();
  await seedAuth(secondAdmin, session);

  const detailUrl = adminPath(`/page-contents/${pageContentId}`);
  await Promise.all([page.goto(detailUrl), secondAdmin.goto(detailUrl)]);
  const firstTitle = page.getByPlaceholder('Chính sách hoặc trang thông tin');
  const secondTitle = secondAdmin.getByPlaceholder('Chính sách hoặc trang thông tin');
  await expect(firstTitle).toBeVisible();
  await expect(secondTitle).toBeVisible();

  const winningTitle = `QA concurrent winner ${RUN_ID}`;
  await firstTitle.fill(winningTitle);
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog', { name: 'Đã lưu thay đổi' })).toContainText('Đã lưu bản sửa. Nội dung mới chưa hiện ngoài website');

  await secondTitle.fill(`QA stale overwrite ${RUN_ID}`);
  await secondAdmin.getByRole('button', { name: 'Lưu thay đổi' }).click();
  const conflictDialog = secondAdmin.getByRole('dialog', {
    name: 'Nội dung đã được người khác cập nhật'
  });
  await expect(
    conflictDialog.getByRole('heading', { name: 'Nội dung đã được người khác cập nhật' })
  ).toBeVisible();
  await expect(
    conflictDialog.getByText('hệ thống đã chặn ghi đè để tránh mất dữ liệu', { exact: false })
  ).toBeVisible();

  const response = await apiRequest(
    request,
    'GET',
    `/song-thanh/page-contents/${pageContentId}`
  );
  expect(response.ok()).toBe(true);
  expect(pageRecord(await response.json()).title).toBe(winningTitle);

  await secondAdmin.close({ runBeforeUnload: false });
});

test('the content library separates archived records and keeps restore available', async ({
  page,
  request
}) => {
  await seedAuth(page, session);
  expect(pageContentId).not.toBe('');

  const archiveResponse = await apiRequest(
    request,
    'POST',
    `/song-thanh/page-contents/${pageContentId}/archive`,
    {}
  );
  expect(archiveResponse.ok()).toBe(true);

  await page.goto(adminPath('/page-contents'));
  await expect(page.getByRole('textbox', { name: 'Tìm trang nội dung' })).toHaveAttribute(
    'maxlength',
    '255'
  );
  await page
    .getByRole('group', { name: 'Lọc theo hàng đợi xuất bản' })
    .getByRole('button', { name: /^Lưu trữ/ })
    .click();
  await page.getByRole('textbox', { name: 'Tìm trang nội dung' }).fill(SLUG);
  const archivedRow = page.getByRole('listitem').filter({ hasText: SLUG });
  await expect(archivedRow).toContainText(`/${SLUG}`);
  await expect(archivedRow).toContainText('Lưu trữ');
  await archivedRow.getByRole('button', { name: new RegExp(`Thêm thao tác cho QA .*${RUN_ID}`) }).click();
  await expect(page.getByRole('menuitem', { name: 'Khôi phục', exact: true })).toBeVisible();

  await page
    .getByRole('group', { name: 'Lọc theo hàng đợi xuất bản' })
    .getByRole('button', { name: /^Cần xử lý/ })
    .click();
  await expect(page.getByText(SLUG, { exact: true })).toHaveCount(0);
});

function normalizeAdminBasePath(basePath: string) {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminPath(pathname: string) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${ADMIN_BASE_PATH}${normalizedPath}`;
}

function assertSafeTarget() {
  const hostname = new URL(API_BASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname) && process.env.ALLOW_QA_MUTATIONS !== '1') {
    throw new Error(`Refusing to mutate non-local API ${API_BASE_URL}.`);
  }
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

async function login(request: APIRequestContext) {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.81' },
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBe(true);
  const payload = await response.json();
  expect(payload.ok).toBe(true);
  const session = payload.data as Omit<AdminSession, 'roles'>;
  const meResponse = await request.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  expect(meResponse.ok(), `Auth me failed with HTTP ${meResponse.status()}`).toBe(true);
  const mePayload = (await meResponse.json()) as RecordMap;
  const meData = unwrap(mePayload);
  return {
    ...session,
    roles: Array.isArray(meData.roles) ? meData.roles.map(String) : []
  };
}

function apiRequest(
  request: APIRequestContext,
  method: 'GET' | 'POST',
  pathname: string,
  data?: RecordMap
) {
  return request.fetch(`${API_BASE_URL}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}` },
    data
  });
}

function unwrap(body: RecordMap) {
  return body && typeof body === 'object' && 'data' in body ? (body.data as RecordMap) : body;
}

function pageRecord(body: RecordMap) {
  const data = unwrap(body);
  return (data.page_content as RecordMap) || data;
}

function publicPageRecord(body: RecordMap) {
  const data = unwrap(body);
  return (data.page_content as RecordMap) || (data.item as RecordMap) || data;
}
