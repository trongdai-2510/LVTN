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
  { id: 'about', label: 'Giới thiệu công ty', formTitle: 'Chỉnh trang Giới thiệu', slug: 'gioi-thieu' },
  { id: 'products', label: 'Sản phẩm', formTitle: 'Chỉnh trang Sản phẩm', slug: 'san-pham' },
  {
    id: 'capability-profile',
    label: 'Hồ sơ năng lực',
    formTitle: 'Chỉnh trang Hồ sơ năng lực',
    slug: 'ho-so-nang-luc'
  },
  { id: 'services', label: 'Dịch vụ', formTitle: 'Chỉnh trang Dịch vụ', slug: 'dich-vu' },
  { id: 'projects', label: 'Dự án', formTitle: 'Chỉnh trang Dự án', slug: 'du-an' },
  {
    id: 'brands',
    label: 'Thương hiệu sản phẩm',
    formTitle: 'Chỉnh trang Thương hiệu sản phẩm',
    slug: 'doi-tac-thuong-hieu'
  },
  { id: 'news-index', label: 'Trang Tin tức', formTitle: 'Chỉnh trang Tin tức', slug: 'tin-tuc' },
  { id: 'contact', label: 'Liên hệ', formTitle: 'Chỉnh trang Liên hệ', slug: 'lien-he' }
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

test('the create hub exposes every page type and opens the matching editor', async ({ page }) => {
  test.setTimeout(120_000);
  await seedAuth(page, session);

  await page.goto(adminPath('/page-contents/new'));
  await expect(page.locator('[data-page-content-create-hub="true"]')).toBeVisible();

  for (const template of SYSTEM_PAGE_TEMPLATE_CASES) {
    await expect(page.getByRole('button', { name: new RegExp(template.label) })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Bài tin tức / SEO', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trang tĩnh khác', exact: true })).toBeVisible();

  for (const template of SYSTEM_PAGE_TEMPLATE_CASES) {
    await page.goto(adminPath(`/page-contents/new?template=${template.id}`));
    await expect(page.getByRole('heading', { name: template.formTitle })).toBeVisible();
    await expect(page.locator(`input[value="${template.slug}"]`)).toBeVisible();
  }

  await page.goto(adminPath('/page-contents/new?template=news'));
  await expect(page.getByRole('heading', { name: 'Viết bài tin tức' })).toBeVisible();
  await expect(page.getByText('/tin-tuc/', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('duong-dan-trang')).toBeVisible();

  await page.goto(adminPath('/page-contents/new?template=generic'));
  await expect(page.getByRole('heading', { name: 'Tạo trang tĩnh' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đổi loại' })).toBeVisible();
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
      page.getByRole('heading', { name: 'Bạn muốn chỉnh phần nào của website?' })
    ).toBeVisible();
    await page.getByRole('button', { name: /Trang tĩnh khác/ }).click();
    await expect(page.getByRole('heading', { name: 'Tạo trang tĩnh' })).toBeVisible();
  });

  await test.step('create a draft with generated slug and body content', async () => {
    await page.getByPlaceholder('Chính sách hoặc trang thông tin').fill(`QA UI page ${RUN_ID}`);
    await page.getByPlaceholder('duong-dan-trang').fill(SLUG);
    await page
      .getByPlaceholder('Một đoạn ngắn giải thích trang này dùng để làm gì.')
      .fill('Trang tạm dùng để kiểm tra đầy đủ luồng biên tập nội dung.');
    await page.locator('.ProseMirror').fill('Nội dung QA ban đầu được tạo từ giao diện quản trị.');
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page).toHaveURL(
      new RegExp(`${ADMIN_BASE_PATH}/page-contents/[0-9a-f]{8}-[0-9a-f-]{27}$`, 'i')
    );
    pageContentId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1) || '';
    expect(pageContentId).not.toBe('');

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

  await test.step('send for review, approve, then publish in separate workflow steps', async () => {
    await page.getByRole('button', { name: 'Chọn ảnh' }).first().click();
    const imageDialog = page.getByRole('dialog', { name: 'Chọn ảnh' });
    await expect(imageDialog).toBeVisible();
    await imageDialog.locator('button.block').first().click();

    await page.getByRole('button', { name: /SEO và chia sẻ/ }).click();
    await page
      .getByPlaceholder('Nếu để trống sẽ dùng tiêu đề trang')
      .fill(`QA UI SEO ${RUN_ID}`);
    await page
      .getByPlaceholder('Tóm tắt 140-160 ký tự cho Google và chia sẻ link')
      .fill('Mô tả SEO tạm dùng để xác nhận trang hợp lệ trước khi được đăng công khai.');

    await page.getByRole('button', { name: 'Gửi duyệt' }).click();
    await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();

    let adminResponse = await apiRequest(request, 'GET', `/song-thanh/page-contents/${pageContentId}`);
    expect(adminResponse.ok()).toBe(true);
    let adminRecord = pageRecord(await adminResponse.json());
    expect(adminRecord.review_status).toBe('pending_review');
    expect(adminRecord.publish_status).toBe('unpublished');

    await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();
    adminResponse = await apiRequest(request, 'GET', `/song-thanh/page-contents/${pageContentId}`);
    expect(adminResponse.ok()).toBe(true);
    adminRecord = pageRecord(await adminResponse.json());
    expect(adminRecord.review_status).toBe('approved');
    expect(adminRecord.publish_status).toBe('unpublished');

    await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
    await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.ok()).toBe(true);
    const record = publicPageRecord(await publicResponse.json());
    expect(record.slug).toBe(SLUG);

    adminResponse = await apiRequest(request, 'GET', `/song-thanh/page-contents/${pageContentId}`);
    expect(adminResponse.ok()).toBe(true);
    expect(pageRecord(await adminResponse.json()).publish_status).toBe('published');

    const publicPage = await page.context().newPage();
    await publicPage.goto(`http://localhost:3000/${SLUG}`);
    await expect(publicPage.getByRole('heading', { name: `QA UI page ${RUN_ID}` })).toBeVisible();
    await expect(publicPage.getByText('Nội dung QA ban đầu')).toBeVisible();
    await publicPage.close();
  });

  await test.step('major edit returns published content to review', async () => {
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
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();

    const adminResponse = await apiRequest(
      request,
      'GET',
      `/song-thanh/page-contents/${pageContentId}`
    );
    expect(adminResponse.ok()).toBe(true);
    const record = pageRecord(await adminResponse.json());
    expect(record.review_status).toBe('pending_review');
    expect(record.publish_status).toBe('unpublished');

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.status()).toBe(404);
  });

  await test.step('reviewed edit can be approved and republished explicitly', async () => {
    const updatedTitle = `QA UI page updated ${RUN_ID}`;
    await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();
    await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
    await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.ok()).toBe(true);
    const record = publicPageRecord(await publicResponse.json());
    expect(record.title).toBe(updatedTitle);
    expect(String(record.content_html)).toContain('Nội dung QA đã cập nhật');
    expect(record.seo_title).toBe(`QA UI SEO ${RUN_ID}`);
  });

  await test.step('archive hides the page but keeps it recoverable', async () => {
    await page.getByRole('button', { name: 'Lưu trữ' }).click();
    const dialog = page.getByRole('dialog', { name: 'Lưu trữ nội dung?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Lưu trữ' }).click();
    await expect(page.getByText('Đã lưu trữ bản ghi.')).toBeVisible();
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
    const adminResponse = await apiRequest(request, 'GET', `/song-thanh/page-contents/${pageContentId}`);
    expect(adminResponse.ok()).toBe(true);
    expect(pageRecord(await adminResponse.json()).publish_status).toBe('unpublished');

    const publicResponse = await request.get(`${API_BASE_URL}/public/page-contents/${SLUG}`);
    expect(publicResponse.status()).toBe(404);
  });
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
