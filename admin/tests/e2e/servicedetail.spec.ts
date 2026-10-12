import { expect, test } from '@playwright/test';

const frontend = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

test('service without a public image uses its real content instead of a generated visual', async ({ page }) => {
  for (const width of [390, 1440, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${frontend}/dich-vu/thiet-ke-he-thong`);

    const hero = page.locator('main section').first();
    await expect(hero.locator('[data-service-hero-layout="text"]')).toBeVisible();
    await expect(hero.getByRole('heading', { level: 1, name: 'Thiết kế phương án' })).toHaveCount(1);
    await expect(hero.getByText('Tiếp nhận nhu cầu · Làm rõ điều kiện · Đề xuất hướng xử lý')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect((await hero.boundingBox())!.height).toBeLessThan(width === 390 ? 800 : 650);
  }
});
