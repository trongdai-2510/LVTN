import { expect, test } from '@playwright/test';

const frontendUrl = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

test('public footer keeps its columns and link rows compact without mobile overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(frontendUrl);

  const footer = page.locator('footer');
  await expect(footer).toBeVisible();
  const main = footer.locator(':scope > div > div').first();
  const meta = footer.locator(':scope > div > div').nth(1);
  const logo = footer.getByRole('link', { name: /Trang chủ/ }).first();
  const quickSection = footer.getByRole('heading', { name: 'Liên kết nhanh' }).locator('..');
  const quickHeading = quickSection.getByRole('heading');
  const quickLink = quickSection.getByRole('link').first();

  const footerBox = await footer.boundingBox();
  const mainBox = await main.boundingBox();
  const metaBox = await meta.boundingBox();
  const logoBox = await logo.boundingBox();
  const headingBox = await quickHeading.boundingBox();
  const linkBox = await quickLink.boundingBox();
  expect(footerBox && mainBox && metaBox && logoBox && headingBox && linkBox).toBeTruthy();

  expect(logoBox!.y - footerBox!.y).toBeLessThanOrEqual(48);
  expect(parseFloat(await main.evaluate((element) => getComputedStyle(element).columnGap))).toBeLessThanOrEqual(40);
  expect(linkBox!.y - headingBox!.y - headingBox!.height).toBeLessThanOrEqual(16);
  expect(linkBox!.height).toBeLessThanOrEqual(44);
  expect(metaBox!.y - mainBox!.y - mainBox!.height).toBeLessThanOrEqual(40);
  await footer.screenshot({ path: testInfo.outputPath('footerDesktop.png') });

  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 640 });
    await expect(footer).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 320) await footer.screenshot({ path: testInfo.outputPath('footerMobile.png') });
  }
});
