import { expect, test } from '@playwright/test';
import { getQaAuth } from './qaAuth';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('banner page picker shows main pages and finds a service detail in one search', async ({ page, request }, testInfo) => {
  const auth = await getQaAuth(request, api);
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: []
  });

  await page.route('**/public/search-suggestions?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { items: [{
        type: 'service',
        title: 'Bảo trì, sửa chữa',
        subtitle: 'Dịch vụ kỹ thuật',
        href: '/dich-vu/bao-tri-sua-chua'
      }] } })
    });
  });

  await page.goto(`${admin}/banners/new`);
  const picker = page.locator('#banner-position');
  await picker.click();
  const dialog = page.getByRole('dialog', { name: 'Banner hiển thị ở đâu?' });
  await expect(dialog.getByRole('button', { name: 'Trang Dịch vụ' })).toBeVisible();
  await testInfo.attach('bannerPickerDesktop.png', { body: await page.screenshot({ path: 'tmp/bannerPickerDesktop.png' }), contentType: 'image/png' });
  await dialog.getByRole('textbox', { name: 'Tìm trang hiển thị' }).fill('Bảo trì');
  const service = dialog.getByRole('button', { name: /Bảo trì, sửa chữa/ });
  await expect(service).toContainText('/dich-vu/bao-tri-sua-chua');
  await service.click();

  await expect(picker).toContainText('Bảo trì, sửa chữa');
  await expect(picker).toContainText('/dich-vu/bao-tri-sua-chua');

  await picker.click();
  await dialog.getByRole('button', { name: 'Nhập đường dẫn riêng' }).click();
  await dialog.getByRole('textbox', { name: 'Đường dẫn trang trên website' }).fill('/dich-vu/bao-tri-sua-chua');
  await dialog.getByRole('button', { name: 'Dùng trang này' }).click();
  await expect(picker).toContainText('/dich-vu/bao-tri-sua-chua');

  await page.unroute('**/public/search-suggestions?*');
  await page.route('**/public/search-suggestions?*', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await picker.click();
  await dialog.getByRole('textbox', { name: 'Tìm trang hiển thị' }).fill('khong tai duoc');
  await expect(dialog.getByRole('alert')).toContainText('Chưa tải được kết quả');
  await expect(dialog.getByRole('button', { name: 'Nhập đường dẫn riêng' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 320, height: 844 });
  await picker.click();
  await expect(dialog.getByRole('button', { name: 'Trang Dịch vụ' })).toBeVisible();
  await testInfo.attach('bannerPickerMobile.png', { body: await page.screenshot({ path: 'tmp/bannerPickerMobile.png' }), contentType: 'image/png' });
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(picker).toBeFocused();
});

test('banner CTA keeps its destination prominent and hides irrelevant image-click choices', async ({ page, request }, testInfo) => {
  const auth = await getQaAuth(request, api);
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: []
  });

  await page.route('**/public/search-suggestions?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { items: [{
        type: 'service', title: 'Bảo trì, sửa chữa', subtitle: 'Dịch vụ kỹ thuật', href: '/dich-vu/bao-tri-sua-chua'
      }] } })
    });
  });

  await page.goto(`${admin}/banners/new`);
  const imageChoices = page.getByRole('group', { name: 'Click vào ảnh sẽ' });
  await expect(imageChoices).toBeVisible();
  await imageChoices.getByRole('button', { name: /Mở trang trong website/ }).click();
  await page.locator('#banner-link-target').click();
  await page.getByRole('dialog', { name: 'Chọn trang đích' }).getByRole('button', { name: 'Trang Liên hệ' }).click();
  await expect(page.locator('#banner-link-target')).toContainText('/lien-he');
  await page.getByRole('button', { name: 'Thêm nút' }).click();
  await expect(page.getByRole('group', { name: 'Click vào ảnh sẽ' })).toHaveCount(0);
  await expect(page.getByText('Ảnh banner không mở trang khác')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tùy chỉnh giao diện nút' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chọn màu #1d4ed8' })).toHaveCount(0);
  await page.locator('#banner-cta-url-0').click();
  const destination = page.getByRole('dialog', { name: 'Chọn trang đích' });
  await expect(destination.getByRole('button', { name: 'Trang Dịch vụ' })).toBeVisible();
  await destination.getByRole('textbox', { name: 'Tìm trang, sản phẩm hoặc thương hiệu' }).fill('Bảo trì');
  await destination.getByRole('button', { name: /Bảo trì, sửa chữa/ }).click();
  await expect(page.locator('#banner-cta-url-0')).toContainText('/dich-vu/bao-tri-sua-chua');
  await page.locator('#banner-cta-url-0').click();
  await destination.getByRole('button', { name: 'Nhập đường dẫn riêng' }).click();
  await destination.getByRole('textbox', { name: 'Đường dẫn trang hoặc website khác' }).fill('javascript:alert(1)');
  await expect(destination.getByRole('button', { name: 'Dùng đường dẫn này' })).toBeDisabled();
  await destination.getByRole('textbox', { name: 'Đường dẫn trang hoặc website khác' }).fill('https://example.com');
  await destination.getByRole('button', { name: 'Dùng đường dẫn này' }).click();
  await expect(page.locator('#banner-cta-url-0')).toContainText('https://example.com');
  await testInfo.attach('bannerCtaCompact.png', { body: await page.screenshot({ path: 'tmp/bannerCtaCompact.png' }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Tùy chỉnh giao diện nút' }).click();
  await expect(page.getByRole('button', { name: 'Chọn màu #1d4ed8' })).toBeVisible();
  await testInfo.attach('bannerCtaControls.png', { body: await page.screenshot({ path: 'tmp/bannerCtaControls.png' }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Xóa nút 1' }).click();
  await expect(page.getByRole('group', { name: 'Click vào ảnh sẽ' })).toBeVisible();
  await expect(page.locator('#banner-link-target')).toContainText('/lien-he');
  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: 'Thêm nút' }).click();
  await page.locator('#banner-cta-url-0').click();
  const box = await destination.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
