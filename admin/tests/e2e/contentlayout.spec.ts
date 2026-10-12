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

test('the page composer reorders, hides, previews, and restores project sections', async ({
  page,
  request
}) => {
  const session = await login(request);
  await seedAuth(page, session);
  await page.goto(`${ADMIN_BASE_PATH}/page-contents/new?template=projects`);

  const adminBrand = page.locator('[data-admin-brand-logo="true"]:visible');
  await expect(adminBrand.locator('img')).toBeVisible();
  await expect
    .poll(() => adminBrand.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgba(0, 0, 0, 0)');
  const editorHeader = page.locator('[data-page-editor-summary="true"]');
  await expect(editorHeader).toBeVisible();
  const editorHeaderBox = await editorHeader.boundingBox();
  expect(editorHeaderBox?.height, 'page editor summary should stay compact').toBeLessThanOrEqual(64);

  const workspace = page.locator('[data-page-studio-workspace="single-column"]');
  await expect(workspace).toBeVisible();
  await expect(page.locator('[data-page-editor-sidebar="true"]')).toHaveCount(0);

  const sectionNav = page.getByRole('navigation', { name: 'Mục lục biên tập trang' });
  const layoutNavItem = sectionNav.getByRole('link', { name: 'Bố cục hiển thị' });
  await expect(layoutNavItem).toHaveAttribute('aria-current', 'location');

  const bodyNavItem = sectionNav.getByRole('link', { name: 'Lời dẫn trang dự án' });
  await bodyNavItem.click();
  await expect(bodyNavItem).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('#page-section-body')).toHaveAttribute('data-editor-attention', 'true');
  const stuckSectionNavTop = (await sectionNav.boundingBox())?.y ?? 0;
  expect(stuckSectionNavTop).toBeGreaterThanOrEqual(0);
  expect(stuckSectionNavTop).toBeLessThan(320);
  await sectionNav.getByRole('link', { name: 'Ảnh đại diện trang dự án' }).click();
  await expect
    .poll(async () => Math.abs(((await sectionNav.boundingBox())?.y ?? 0) - stuckSectionNavTop))
    .toBeLessThanOrEqual(2);

  await layoutNavItem.click();

  const layout = page.getByRole('list', { name: 'Thứ tự bố cục Dự án' });
  const rows = layout.locator('[data-page-layout-section]');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(1)).toContainText('Lời mở đầu danh mục dự án');
  await expect(rows.nth(2)).toContainText('Hồ sơ dự án');
  await expect(
    page
      .locator('[data-page-layout-section="projects-evidence"]')
      .getByRole('button', { name: 'Đang hiện' })
  ).toBeDisabled();

  await page
    .getByRole('button', { name: 'Đưa Hồ sơ dự án lên trên' })
    .click();
  await expect(rows.nth(1)).toContainText('Hồ sơ dự án');
  await expect(rows.nth(2)).toContainText('Lời mở đầu danh mục dự án');
  await expect(page.getByRole('status')).toContainText(
    'Đã chuyển Hồ sơ dự án lên vị trí 2'
  );
  await expect(page.locator('[data-page-layout-section="projects-list"]')).toHaveAttribute(
    'data-recently-moved',
    'true'
  );

  const ctaRow = page.locator('[data-page-layout-section="projects-cta"]');
  await ctaRow.getByRole('button', { name: 'Đang hiện' }).click();
  await expect(ctaRow.getByRole('button', { name: 'Đang ẩn' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await expect(page.getByText(/Chưa lưu lần đầu|thay đổi chưa lưu/)).toBeVisible();

  await page.getByRole('button', { name: 'Xem trước' }).click();
  const preview = page.getByRole('dialog', { name: 'Xem trước Dự án' });
  await expect(preview).toBeVisible();
  const frame = preview.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Bắt đầu dự án cùng chuyên gia' })).toHaveCount(0);
  await expect(frame.getByRole('heading', { name: 'Dự án đã thực hiện' })).toBeVisible();
  await preview.getByRole('button', { name: 'Đóng', exact: true }).click();

  await page.getByRole('button', { name: 'Khôi phục mặc định' }).click();
  await expect(rows.nth(1)).toContainText('Lời mở đầu danh mục dự án');
  await expect(rows.nth(2)).toContainText('Hồ sơ dự án');
  await expect(ctaRow.getByRole('button', { name: 'Đang hiện' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  await page.setViewportSize({ width: 320, height: 844 });
  await expect(page.locator('[data-admin-brand-logo="true"]:visible img')).toBeVisible();
  await bodyNavItem.click();
  const mobileCommandBar = page.locator('[data-page-lifecycle-bar="true"]');
  await expect(mobileCommandBar).toBeVisible();
  await expect(sectionNav).toBeVisible();
  await expect
    .poll(async () => (await mobileCommandBar.boundingBox())?.height ?? 1000)
    .toBeLessThanOrEqual(300);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    )
    .toBe(true);
});

test('readiness actions take an editor directly to the field that needs work', async ({
  page,
  request
}) => {
  const session = await login(request);
  await seedAuth(page, session);
  await page.goto(`${ADMIN_BASE_PATH}/page-contents/new?template=generic`);

  const readiness = page.locator('[data-content-readiness="blocked"]');
  await readiness.locator('summary').click();
  const titleIssue = readiness.locator('[data-content-issue="content.title.required"]');
  await titleIssue.getByRole('button', { name: /Bổ sung tiêu đề/ }).click();
  await expect(page.locator('#page-content-title')).toBeFocused();
  await expect(page.locator('#page-content-title').locator('xpath=..')).toHaveAttribute(
    'data-editor-attention',
    'true'
  );
  expect(new URL(page.url()).hash).toBe('#page-content-title');

  await readiness.locator('summary').click();
  const bodyIssue = readiness.locator('[data-content-issue="content.body.required"]');
  await bodyIssue.getByRole('button', { name: /Bổ sung nội dung/ }).click();
  await expect(page.locator('#page-section-body')).toHaveAttribute('data-editor-attention', 'true');
  await expect(page.locator('#page-section-body [contenteditable="true"]')).toBeFocused();
  await expect
    .poll(async () => {
      const box = await page.locator('#page-section-body').boundingBox();
      return Boolean(box && box.y >= 0 && box.y < (page.viewportSize()?.height ?? 720) * 0.7);
    })
    .toBe(true);
  expect(new URL(page.url()).hash).toBe('#page-section-body');
});

test('system page setup explains sharing media and exposes brand profiles as a primary workspace', async ({
  page,
  request
}) => {
  const session = await login(request);
  await seedAuth(page, session);

  await page.goto(`${ADMIN_BASE_PATH}/page-contents`);
  await expect(page.getByRole('link', { name: 'Hồ sơ thương hiệu' })).toBeVisible();
  await expect(page.getByText('Khu khác', { exact: true })).toHaveCount(0);

  await page.goto(`${ADMIN_BASE_PATH}/page-contents/new?template=products`);
  await expect(
    page.getByRole('heading', { name: 'Thiết lập nội dung trang Sản phẩm', level: 1 })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ảnh chia sẻ & xem trước' })).toBeVisible();
  await expect(page.getByText('Không phải banner', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu thiết lập' })).toBeVisible();
});

test('brand page editor uses four plain-language work areas and truthful readiness rules', async ({
  page,
  request
}) => {
  const session = await login(request);
  const response = await request.get(`${API_BASE_URL}/song-thanh/brand-pages?page=1&page_size=100`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  expect(response.ok(), `Brand pages failed with HTTP ${response.status()}`).toBe(true);
  const payload = (await response.json()) as { data?: { items?: RecordMap[] } };
  const items = payload.data?.items ?? [];
  const record = items.find((item) => item.page_id);
  expect(record, 'A brand page is required for the editor regression test').toBeTruthy();

  await seedAuth(page, session);
  await page.goto(`${ADMIN_BASE_PATH}/page-contents/brand-pages/${String(record?.page_id)}`);

  await expect(page.getByRole('link', { name: 'Hồ sơ thương hiệu', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Brand Pages', { exact: true })).toHaveCount(0);
  const navigation = page.getByRole('navigation', { name: 'Các bước hoàn thiện hồ sơ thương hiệu' });
  await expect(navigation.getByRole('button')).toHaveCount(4);
  for (const label of ['Nhận diện', 'Giới thiệu', 'Sản phẩm & tài liệu', 'Xuất bản']) {
    await expect(navigation.getByRole('button', { name: new RegExp(label) })).toBeVisible();
  }
  await expect(page.getByText('Sẵn sàng public', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/sản phẩm đã ghim/)).toHaveCount(0);
  await expect(page.getByText('Có thể xuất bản', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Banner', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sản phẩm trưng bày', exact: true })).toHaveCount(0);
  await navigation.getByRole('button', { name: /Sản phẩm & tài liệu/ }).click();
  await expect(page.getByRole('heading', { name: 'Sản phẩm trưng bày', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tài liệu và nguồn tham khảo', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Banner', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'CTA cuối trang', exact: true })).toHaveCount(0);
  await expect(page.getByText('Public', { exact: true })).toHaveCount(0);

  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
});

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
    headers: { 'X-Forwarded-For': '192.0.2.91' },
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
