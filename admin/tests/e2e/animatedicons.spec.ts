import { expect, test } from '@playwright/test';

const ADMIN_BASE_PATH = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const STORAGE_KEY = 'song-thanh-admin-auth';

test('admin icons use the shared animated outline system without overflowing controls', async ({
  page
}) => {
  await page.goto(`${ADMIN_BASE_PATH}/login`);

  const passwordToggle = page.getByRole('button', { name: /hiện mật khẩu/i });
  const icon = passwordToggle.locator('[data-admin-icon]').first();
  await expect(icon).toBeVisible();
  await expect(icon).toHaveAttribute('aria-hidden', 'true');

  const geometry = await icon.evaluate((element) => {
    const wrapper = element.getBoundingClientRect();
    const svg = element.querySelector('svg')?.getBoundingClientRect();
    return {
      wrapper: { width: wrapper.width, height: wrapper.height },
      svg: svg ? { width: svg.width, height: svg.height } : null
    };
  });

  expect(geometry.svg).not.toBeNull();
  expect(geometry.wrapper.width).toBeGreaterThan(0);
  expect(geometry.wrapper.height).toBeGreaterThan(0);
  expect(geometry.svg?.width).toBeLessThanOrEqual(geometry.wrapper.width + 0.5);
  expect(geometry.svg?.height).toBeLessThanOrEqual(geometry.wrapper.height + 0.5);

  const svg = icon.locator('svg');
  await expect(svg).toHaveAttribute('fill', 'none');
  await expect(svg).toHaveAttribute('stroke', 'currentColor');
});

test('admin shell exposes the current location and focuses quick navigation from the keyboard', async ({
  page,
  request
}) => {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: {
      email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
      password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
    }
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json();

  await page.addInitScript(
    ({ storageKey, auth }) => {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
          user: auth.user,
          permissions: auth.permissions,
          roles: []
        })
      );
    },
    { storageKey: STORAGE_KEY, auth: payload.data }
  );

  await page.goto(`${ADMIN_BASE_PATH}/dashboard`);
  const quickNavigation = page.getByRole('combobox', { name: 'Tìm trang hoặc dữ liệu' });
  await expect(quickNavigation).toBeVisible();

  await page.keyboard.press('Control+k');
  await expect(quickNavigation).toBeFocused();
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Tổng quan', exact: true })
  ).toHaveAttribute('aria-current', 'page');

  await page.setViewportSize({ width: 390, height: 844 });
  const menuTrigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
  await menuTrigger.click();
  const mobileNavigation = page.getByRole('dialog', { name: 'Điều hướng quản trị' });
  const closeButton = mobileNavigation.getByRole('button', { name: 'Đóng menu điều hướng' });
  await expect(closeButton).toBeVisible();
  await closeButton.click();
  await expect(mobileNavigation).toHaveCount(0);
  await expect(menuTrigger).toBeFocused();
});

function normalizeAdminBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}
