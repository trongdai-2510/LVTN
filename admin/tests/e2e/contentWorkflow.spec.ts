import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const apiUrl = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

test('a live page stays in the displayed lane even when old editorial text is missing', async ({ page }, testInfo) => {
  const user = { id: 'admin', display_name: 'Super Admin', email: 'admin@example.com' };
  const permissions = ['page_content.read', 'page_content.update'];
  const record = {
    id: 'content-live', title: 'Tin tức', slug: 'tin-tuc', content_type: 'page',
    excerpt: '', content_html: '', extra_blocks: { blocks: [] },
    review_status: 'approved', publish_status: 'published', deleted_at: null,
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z'
  };
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'test-token', refreshToken: 'test-refresh', user,
    permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: {
      user, permissions, roles: ['super_admin']
    } } });
    if (path === '/song-thanh/page-contents') return route.fulfill({ json: { ok: true, data: {
      items: [record], pagination: { page: 1, page_size: 100, total: 1 }
    } } });
    return route.fulfill({ json: { ok: true, data: { items: [] } } });
  });
  await page.goto(`${adminUrl}/admin/page-contents?lane=published`);
  const displayedLane = page.getByRole('group', { name: 'Lọc theo hàng đợi xuất bản' })
    .getByRole('button', { name: /Đang hiển thị/ });
  await expect(displayedLane).toContainText('1');
  const row = page.locator('[data-content-library-row]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Đang hiển thị');
  await expect(row.getByRole('button', { name: /mục cần sửa/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('contentOverview.png'), fullPage: true });
  await page.getByRole('tab', { name: 'Trang hệ thống' }).click();
  await expect(page.getByRole('heading', { name: 'Trang hệ thống' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Các trang hệ thống' }).getByRole('listitem')).toHaveCount(8);
  await expect(page.getByRole('link', { name: /Mở đường dẫn .* trên website/ })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('systemPages.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('systemPagesMobile.png'), fullPage: true });
});

test('a published flag without approval is not presented as live', async ({ page }) => {
  const user = { id: 'admin', display_name: 'Super Admin', email: 'admin@example.com' };
  const permissions = ['page_content.read', 'page_content.update'];
  const record = {
    id: 'content-conflict', title: 'Tin tức', slug: 'tin-tuc', content_type: 'page',
    excerpt: 'Trang tin của Song Thanh', content_html: '<p>Nội dung đã có.</p>', extra_blocks: { blocks: [] },
    review_status: 'draft', publish_status: 'published', deleted_at: null,
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z'
  };
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'test-token', refreshToken: 'test-refresh', user,
    permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: {
      user, permissions, roles: ['super_admin']
    } } });
    if (path === '/song-thanh/page-contents') return route.fulfill({ json: { ok: true, data: {
      items: [record], pagination: { page: 1, page_size: 100, total: 1 }
    } } });
    return route.fulfill({ json: { ok: true, data: { items: [] } } });
  });
  await page.goto(`${adminUrl}/admin/page-contents?lane=published`);
  await expect(page.locator('[data-page-content-ready]')).toHaveAttribute('data-page-content-ready', 'true');
  await expect(page.locator('[data-content-library-row]')).toHaveCount(0);
  await page.getByRole('group', { name: 'Lọc theo hàng đợi xuất bản' })
    .getByRole('button', { name: /Cần xử lý/ }).click();
  await expect(page.locator('[data-content-library-row]')).toContainText('Tin tức');
  await expect(page.locator('[data-content-library-row]')).not.toContainText('Đang hiển thị');
});

test('hiding a published content item confirms the saved result after its row leaves the filter', async ({ page }, testInfo) => {
  const user = { id: 'admin', display_name: 'Super Admin', email: 'admin@example.com' };
  const permissions = ['page_content.read', 'page_content.update'];
  const record = {
    id: 'content-live', title: 'Tin tức', slug: 'tin-tuc', content_type: 'page',
    excerpt: 'Trang tin', content_html: '<p>Nội dung</p>', extra_blocks: { blocks: [] },
    review_status: 'approved', publish_status: 'published', deleted_at: null,
    created_at: '2026-09-01T00:00:00.000Z', updated_at: '2026-09-01T00:00:00.000Z'
  };
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'test-token', refreshToken: 'test-refresh', user,
    permissions, roles: ['super_admin'] });
  await page.route(`${apiUrl}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/auth/me') return route.fulfill({ json: { ok: true, data: {
      user, permissions, roles: ['super_admin']
    } } });
    if (path === '/song-thanh/page-contents' && route.request().method() === 'GET') {
      return route.fulfill({ json: { ok: true, data: {
        items: [record], pagination: { page: 1, page_size: 100, total: 1 }
      } } });
    }
    if (path === '/song-thanh/page-contents/content-live' && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      expect(body.publish_status).toBe('unpublished');
      record.publish_status = 'unpublished';
      return route.fulfill({ json: { ok: true, data: { item: record } } });
    }
    return route.fulfill({ json: { ok: true, data: { items: [] } } });
  });
  await page.goto(`${adminUrl}/admin/page-contents?lane=published`);
  const row = page.locator('[data-content-library-row]');
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: /Thêm thao tác cho/ }).click();
  await row.getByRole('menuitem', { name: 'Ẩn khỏi website' }).click();
  await expect(page.getByRole('dialog')).toContainText('Mục menu trỏ trực tiếp tới trang này cũng tạm ẩn');
  await page.getByRole('dialog').getByRole('button', { name: 'Ẩn', exact: true }).click();
  await expect(row).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Đã ẩn');
  await page.screenshot({ path: testInfo.outputPath('contentHideSaved.png'), fullPage: true });
});
