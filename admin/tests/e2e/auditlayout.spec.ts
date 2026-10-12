import { expect, test, type Page } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const detailId = '11111111-1111-4111-8111-111111111111';
const user = { id: 'audit-admin', email: 'audit@example.com', display_name: 'Super Admin' };
const permissions = ['audit_log.read', 'admin_role.read', 'admin_user.read'];
const oldValue = {
  title: 'Danh mục sản phẩm',
  publish_status: 'draft',
  seo_title: 'Tiêu đề cũ',
  content_html: `<p>${'Nội dung không đổi. '.repeat(50)}</p>`,
  updated_at: '2026-10-05T07:13:01.410Z'
};
const newValue = {
  ...oldValue,
  publish_status: 'published',
  seo_title: 'Tiêu đề mới',
  updated_at: '2026-10-05T07:13:36.856Z'
};
const entry = {
  id: detailId,
  entity_type: 'page_content',
  entity_id: 'page-content-1',
  actor_id: user.id,
  actor_name: user.display_name,
  actor_email: user.email,
  action: 'publish',
  created_at: '2026-10-05T07:13:36.856Z',
  old_value: oldValue,
  new_value: newValue,
  changed_fields: ['title', 'publish_status', 'seo_title', 'content_html']
};

async function mockAudit(page: Page, detailEntry: Record<string, unknown> = entry) {
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'audit-token', refreshToken: 'audit-refresh', user, permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: { user, permissions, roles: ['super_admin'] } } });
    if (path === '/song-thanh/audit-logs') {
      const items = Array.from({ length: 25 }, (_, index) => ({
        ...entry,
        id: index === 24 ? detailId : `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`
      }));
      return route.fulfill({ json: { ok: true, data: { items, pagination: { page: 1, page_size: 25, total: 25 } } } });
    }
    if (path === `/song-thanh/audit-logs/${detailId}`) {
      return route.fulfill({ json: { ok: true, data: { audit_log: detailEntry } } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not mocked' } } });
  });
}

test('audit detail opens at its heading after navigating from a scrolled list', async ({ page }) => {
  await mockAudit(page);
  await page.goto(`${adminUrl}/admin/audit-logs`);
  await expect(page.getByRole('link', { name: 'Xem', exact: true })).toHaveCount(25);
  await page.getByRole('link', { name: 'Xem', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Chi tiết hoạt động' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('audit detail explains changes in everyday language without showing codes', async ({ page }, testInfo) => {
  await mockAudit(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${adminUrl}/admin/audit-logs/${detailId}`);
  await expect(page.getByRole('heading', { name: 'Chi tiết hoạt động' })).toBeVisible();
  await expect(page.getByText('Super Admin đã xuất bản trang nội dung “Danh mục sản phẩm”.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nội dung thay đổi' })).toBeVisible();
  await expect(page.getByText('Tiêu đề mới')).toBeVisible();
  await expect(page.getByText('Đã xuất bản', { exact: true })).toBeVisible();
  await expect(page.getByText('page_content', { exact: true })).toHaveCount(0);
  await expect(page.getByText('publish_status', { exact: true })).toHaveCount(0);
  await expect(page.getByText('published', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-audit-field="updated_at"]')).toHaveCount(0);
  await expect(page.getByText('Nội dung không đổi.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dữ liệu gốc (kỹ thuật)' })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('auditDetail.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath('auditPhone.png'), fullPage: true });
});

test('audit detail shows readable rich text, linked files and structured values', async ({ page }) => {
  const detailedEntry = {
    ...entry,
    action: 'update',
    old_value: { title: 'Giới thiệu', content_html: '<p>Nội dung cũ</p>', featured_image_file_id: null, extra_blocks: [{ title: 'Khối cũ' }] },
    new_value: { title: 'Giới thiệu', content_html: '<p>Nội dung mới <strong>rõ ràng</strong></p>', featured_image_file_id: '11111111-1111-4111-8111-111111111111', extra_blocks: [{ title: 'Khối mới' }] },
    changed_fields: ['content_html', 'featured_image_file_id', 'extra_blocks']
  };
  await mockAudit(page, detailedEntry);
  await page.goto(`${adminUrl}/admin/audit-logs/${detailId}`);
  await expect(page.getByText('Nội dung mới rõ ràng')).toBeVisible();
  await expect(page.getByText('Đã chọn ảnh')).toBeVisible();
  await expect(page.getByText('1 mục nội dung').first()).toBeVisible();
  await expect(page.getByText('11111111-1111-4111-8111-111111111111')).toHaveCount(0);
  await expect(page.getByText('<p>Nội dung mới <strong>rõ ràng</strong></p>')).toHaveCount(0);
  await expect(page.getByText('extra_blocks', { exact: true })).toHaveCount(0);
});

test('a partial response does not present omitted fields as deleted', async ({ page }) => {
  await mockAudit(page, {
    ...entry,
    action: 'update',
    old_value: { title: 'Tên cũ', description: 'Mô tả vẫn còn' },
    new_value: { title: 'Tên mới' },
    changed_fields: ['title']
  });
  await page.goto(`${adminUrl}/admin/audit-logs/${detailId}`);
  await expect(page.getByText('1 thông tin được thay đổi trong hoạt động này.')).toBeVisible();
  await expect(page.getByText('Mô tả vẫn còn')).toHaveCount(0);
  await expect(page.locator('[data-audit-field="description"]')).toHaveCount(0);
});

test('role permission changes use readable actions instead of permission codes', async ({ page }) => {
  await mockAudit(page, {
    ...entry,
    entity_type: 'admin_role',
    action: 'update',
    old_value: { name: 'Biên tập', permission_codes: ['admin_role.read'] },
    new_value: { name: 'Biên tập', permission_codes: ['admin_role.read', 'admin_role.update'] },
    changed_fields: ['permission_codes']
  });
  await page.goto(`${adminUrl}/admin/audit-logs/${detailId}`);
  const permissions = page.locator('[data-audit-field="permission_codes"]');
  await expect(permissions.getByText('2 quyền')).toBeVisible();
  await permissions.locator('summary').last().click();
  await expect(permissions.getByText('Sửa vai trò')).toBeVisible();
  await expect(page.getByText('admin_role.update')).toHaveCount(0);
});

test('human-readable values preserve punctuation in URLs and prose', async ({ page }) => {
  await mockAudit(page, {
    ...entry,
    action: 'update',
    old_value: { seo_description: 'Mô tả cũ', target_url: '/tin-cu' },
    new_value: { seo_description: 'Thiết bị A-B, bảo hành 2.0 năm.', target_url: 'https://songthanh.vn/a-b' },
    changed_fields: ['seo_description', 'target_url']
  });
  await page.goto(`${adminUrl}/admin/audit-logs/${detailId}`);
  await expect(page.getByText('Thiết bị A-B, bảo hành 2.0 năm.')).toBeVisible();
  await expect(page.getByText('https://songthanh.vn/a-b')).toBeVisible();
});

test('content type and review state are described in Vietnamese', async ({ page }) => {
  await mockAudit(page, {
    ...entry,
    action: 'update',
    old_value: { content_type: 'page', review_status: 'pending_review' },
    new_value: { content_type: 'news', review_status: 'rejected' },
    changed_fields: ['content_type', 'review_status']
  });
  await page.goto(`${adminUrl}/admin/audit-logs/${detailId}`);
  await expect(page.locator('[data-audit-field="content_type"]').getByText('Bài tin tức')).toBeVisible();
  await expect(page.locator('[data-audit-field="review_status"]').getByText('Bị từ chối')).toBeVisible();
  await expect(page.getByText('pending_review')).toHaveCount(0);
});
