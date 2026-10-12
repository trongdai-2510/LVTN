import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');
let session: Record<string, unknown>;

test.beforeAll(async ({ request }) => {
  const response = await request.post(`${api}/auth/login`, {
    headers: { 'X-Forwarded-For': '198.51.100.231' },
    data: {
      email: process.env.ADMIN_QA_EMAIL,
      password: process.env.ADMIN_QA_PASSWORD
    }
  });
  expect(response.ok(), `Login returned HTTP ${response.status()}`).toBe(true);
  const { data } = await response.json();
  session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
    permissions: data.permissions,
    roles: data.roles || []
  };
});

async function login(page: Page) {
  await page.addInitScript((state) => {
    sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, session);
}

test('admin redirect validates input and persists create and edit across reloads', async ({ page }) => {
  await login(page);
  await page.goto(`${admin}/redirects/new`);
  await expect(page.getByRole('heading', { name: 'Tạo chuyển hướng' })).toBeVisible();

  await page.getByRole('button', { name: 'Tạo bản ghi' }).click();
  await expect(page.getByRole('dialog')).toContainText('Chưa lưu được');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click();

  const from = `/qa-admin-deep-${Date.now()}`;
  const to = '/san-pham';
  await page.getByLabel('Đường dẫn cũ (nguồn)').fill(from);
  await page.getByLabel('Đường dẫn mới (đích)').fill(to);
  await page.getByLabel('Kiểu chuyển hướng').selectOption('301');
  await page.getByLabel('Trạng thái').selectOption('active');
  await page.getByRole('button', { name: 'Tạo bản ghi' }).click();
  await expect(page.getByRole('dialog')).toContainText('Đã tạo nội dung');
  await page.getByRole('dialog').getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
  await expect(page).toHaveURL(/\/admin\/redirects\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByLabel('Đường dẫn cũ (nguồn)')).toHaveValue(from);
  await expect(page.getByLabel('Đường dẫn mới (đích)')).toHaveValue(to);
  await expect(page.getByLabel('Kiểu chuyển hướng')).toHaveValue('301');

  await page.getByLabel('Kiểu chuyển hướng').selectOption('302');
  await page.getByLabel('Trạng thái').selectOption('inactive');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog')).toContainText('Đã lưu thay đổi');
  await page.getByRole('dialog').getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click();
  await page.reload();
  await expect(page.getByLabel('Kiểu chuyển hướng')).toHaveValue('302');
  await expect(page.getByLabel('Trạng thái')).toHaveValue('inactive');
});

test('category shortcuts preselect the requested main or child level', async ({ page }) => {
  await login(page);
  await page.goto(`${admin}/product-categories/new?level=main`);
  await expect(page.getByLabel('Loại danh mục')).toHaveValue('level_1');

  await page.goto(`${admin}/product-categories/new?level=sub`);
  await expect(page.getByLabel('Loại danh mục')).toHaveValue('level_2');
  await expect(page.getByLabel('Danh mục cấp 1 cha')).toBeVisible();
});

test('admin creates a child category under the selected parent and reloads it', async ({ page }) => {
  await login(page);
  await page.goto(`${admin}/product-categories/new?level=sub`);
  await expect(page.getByLabel('Loại danh mục')).toHaveValue('level_2');
  await page.getByRole('button', { name: 'Tạo bản ghi' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cần bổ sung thông tin');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click();

  const name = `QA danh mục con ${Date.now()}`;
  const parent = page.getByLabel('Danh mục cấp 1 cha');
  const parentId = await parent.locator('option:not([value=""])').first().getAttribute('value');
  expect(parentId).toBeTruthy();
  await page.getByLabel('Tên danh mục').fill(name);
  await parent.selectOption(parentId!);
  await page.getByRole('button', { name: 'Tạo bản ghi' }).click();
  await expect(page).toHaveURL(/\/admin\/product-categories\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByLabel('Loại danh mục')).toHaveValue('level_2');
  await expect(page.getByLabel('Tên danh mục')).toHaveValue(name);
  await expect(page.getByLabel('Danh mục cấp 1 cha')).toHaveValue(parentId!);
});

test('admin customer form preserves input after invalid email and supports archive and restore', async ({ page }) => {
  await login(page);
  await page.goto(`${admin}/customers/new`);
  await expect(page.getByRole('heading', { name: 'Tạo khách hàng' })).toBeVisible();
  const name = `QA khách hàng ${Date.now()}`;
  await page.getByLabel('Họ và tên').fill(name);
  await page.getByLabel('Email').fill('invalid-email');
  await page.getByRole('button', { name: 'Tạo khách hàng' }).click();
  await expect(page).toHaveURL(/\/admin\/customers\/new$/);
  await expect(page.getByLabel('Họ và tên')).toHaveValue(name);

  const email = `qa-admin-${Date.now()}@example.test`;
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Tạo khách hàng' }).click();
  await expect(page).toHaveURL(/\/admin\/customers\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByLabel('Họ và tên')).toHaveValue(name);
  await expect(page.getByLabel('Email')).toHaveValue(email);

  await page.getByRole('button', { name: 'Sửa thông tin' }).click();
  await page.getByLabel('Công ty').fill('QA Song Thanh');
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await page.reload();
  await expect(page.getByLabel('Công ty')).toHaveValue('QA Song Thanh');
  await page.getByRole('button', { name: 'Lưu trữ', exact: true }).click();
  await expect(page.getByText('Hồ sơ này đang ở trạng thái lưu trữ.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Khôi phục', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sửa thông tin' })).toBeVisible();
});

test('admin file library rejects invalid upload and downloads the uploaded bytes', async ({ page }) => {
  await login(page);
  await page.goto(`${admin}/files`);
  await page.locator('[data-file-upload-open="true"]').click();
  const modal = page.locator('[data-file-upload-modal="true"]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-file-upload-submit="true"]')).toBeDisabled();

  await modal.locator('[data-file-upload-input="true"]').setInputFiles({
    name: 'qa-invalid.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('not an image')
  });
  await modal.locator('[data-file-upload-submit="true"]').click();
  await expect(modal).toContainText('Định dạng tệp chưa được hỗ trợ');

  const bytes = await readFile(resolve(__dirname, '../../public/assets/social/zalo-logo.png'));
  const name = `qa-admin-file-${Date.now()}.png`;
  await modal.locator('[data-file-upload-input="true"]').setInputFiles({
    name, mimeType: 'image/png', buffer: bytes
  });
  await modal.locator('[data-file-upload-purpose="true"]').selectOption('other');
  await modal.locator('[data-file-upload-submit="true"]').click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải xuống' }).click();
  const download = await downloadPromise;
  expect(await readFile(await download.path())).toEqual(bytes);

  await page.getByRole('button', { name: 'Lưu trữ', exact: true }).click();
  await page.getByRole('dialog', { name: 'Lưu trữ tệp' })
    .getByRole('button', { name: 'Lưu trữ', exact: true }).click();
  await page.getByRole('combobox', { name: 'Hiển thị' }).selectOption('deleted');
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByRole('button', { name: 'Khôi phục', exact: true }).click();
  await page.getByRole('dialog', { name: 'Khôi phục tệp' })
    .getByRole('button', { name: 'Khôi phục', exact: true }).click();
  await page.getByRole('combobox', { name: 'Hiển thị' }).selectOption('active');
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
});

test('admin technical document validates references and persists the selected file', async ({ page }) => {
  await login(page);
  await page.goto(`${admin}/technical-documents/new`);
  await expect(page.getByRole('heading', { name: 'Thêm tài liệu thủ công' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo bản ghi' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cần bổ sung thông tin');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click();

  const name = `QA tài liệu ${Date.now()}`;
  await page.getByLabel('Tên tài liệu').fill(name);
  const product = page.getByLabel('Sản phẩm', { exact: true });
  const productId = await product.locator('option:not([value=""])').first().getAttribute('value');
  expect(productId).toBeTruthy();
  await product.selectOption(productId!);
  await page.getByRole('button', { name: 'Tệp tài liệu', exact: true }).click();
  const chooser = page.getByRole('dialog', { name: 'Chọn tệp' });
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button', { name: /^Chọn: / }).first().click();
  await expect(chooser).toHaveCount(0);
  await page.getByRole('button', { name: 'Tạo bản ghi' }).click();
  await expect(page).toHaveURL(/\/admin\/technical-documents\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByLabel('Tên tài liệu')).toHaveValue(name);
  await expect(page.getByLabel('Sản phẩm', { exact: true })).toHaveValue(productId!);
  await expect(page.getByText('Chưa chọn', { exact: true })).toHaveCount(0);
});

test('admin banner draft saves an uploaded image and survives reload', async ({ page }) => {
  await login(page);
  await page.goto(`${admin}/banners/new?position=san-pham`);
  await expect(page.getByRole('heading', { name: 'Tạo banner mới' })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu banner' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cần bổ sung thông tin');
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).last().click();

  const name = `QA banner ${Date.now()}`;
  await page.getByLabel('Tên banner nội bộ').fill(name);
  await page.getByLabel('Trạng thái').selectOption('inactive');
  const bytes = await readFile(resolve(__dirname, '../../public/assets/social/zalo-logo.png'));
  await page.locator('[data-field="image_file_id"] input[type="file"]').first().setInputFiles({
    name: `qa-banner-${Date.now()}.png`, mimeType: 'image/png', buffer: bytes
  });
  await expect(page.getByRole('button', { name: 'Đổi ảnh' })).toBeVisible();
  await page.getByRole('button', { name: 'Lưu banner' }).click();
  await expect(page).toHaveURL(/\/admin\/banners\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByLabel('Tên banner nội bộ')).toHaveValue(name);
  await expect(page.getByLabel('Trạng thái')).toHaveValue('inactive');
  await expect(page.locator('[data-banner-preview-workspace="true"]')).toBeVisible();
});

test('admin service draft validates title, auto-generates slug, and stays private', async ({ page }) => {
  await login(page);
  await page.goto(`${admin}/services/new`);
  await expect(page.getByRole('heading', { name: 'Tạo dịch vụ mới' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu dịch vụ' })).toBeDisabled();

  const name = `QA dịch vụ ${Date.now()}`;
  await page.getByLabel('Tên dịch vụ').fill(name);
  const slug = await page.getByLabel('Đường dẫn website').inputValue();
  expect(slug).toMatch(/^qa-dich-vu-/);
  await page.getByRole('button', { name: 'Lưu dịch vụ' }).click();
  await expect(page).toHaveURL(/\/admin\/services\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByLabel('Tên dịch vụ')).toHaveValue(name);
  await expect(page.getByLabel('Đường dẫn website')).toHaveValue(slug);
  const publicResponse = await page.request.get(`http://localhost:4000/public/services/${slug}`);
  expect(publicResponse.status()).toBe(404);
});
