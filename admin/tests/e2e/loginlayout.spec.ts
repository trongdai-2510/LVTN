import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const adminUrl = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const screenshotDir = path.resolve(__dirname, '../../tmp/qa-artifacts/login');

test('login uses the company logo and keeps the form usable on desktop and mobile', async ({ page }) => {
  await mkdir(screenshotDir, { recursive: true });
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${adminUrl}/admin/login`);
  await expect(page.getByRole('heading', { name: 'Đăng nhập quản trị' })).toBeVisible();
  const logo = page.locator('[data-admin-brand-logo] img');
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText('Tài khoản của bạn', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Biểu mẫu đăng nhập' })).toBeVisible();
  await expect(page.locator('img[src*="cable.jpg"], img[src*="switchgear.jpg"]')).toHaveCount(0);
  const desktopAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(desktopAccessibility.violations).toEqual([]);
  await page.screenshot({ path: path.join(screenshotDir, 'desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: 'Biểu mẫu đăng nhập' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const mobileAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(mobileAccessibility.violations).toEqual([]);
  await page.screenshot({ path: path.join(screenshotDir, 'mobile.png'), fullPage: true });

  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByLabel('Email').fill('admin@songthanh.local');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('example-password');
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'password');

  await page.route('**/auth/login', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng.' } })
  }));
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.locator('form [role="alert"]')).toHaveText('Email hoặc mật khẩu không đúng.');
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('aria-invalid', 'true');

  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
