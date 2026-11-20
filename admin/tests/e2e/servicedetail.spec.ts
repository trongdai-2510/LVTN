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

test('service detail shows its real content once without generic explanatory sections', async ({ page }) => {
  await page.goto(`${frontend}/dich-vu/thiet-ke-he-thong`);

  await expect(page.getByText(/Song Thanh phối hợp với khách hàng để rà soát mặt bằng, bản vẽ/)).toHaveCount(1);
  const hero = page.locator('main section').first();
  await expect(hero.getByText('Chuyển yêu cầu công trình thành phương án vật tư và bố trí dễ thi công.')).toBeVisible();
  await expect(hero.getByText(/Hỗ trợ khách hàng chuyển yêu cầu kỹ thuật thành phương án vật tư/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Từ nhu cầu ban đầu đến hướng xử lý rõ ràng/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tình huống phù hợp' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kết quả khách nhận được' })).toBeVisible();
});

test('service index keeps admin content but avoids repeating service summaries and section labels', async ({ page }) => {
  await page.goto(`${frontend}/dich-vu`);

  const firstService = page.locator('#service-tu-van-ky-thuat');
  await expect(firstService.getByText('Làm rõ nhu cầu, thông số và điều kiện lắp đặt trước khi chọn vật tư.')).toBeVisible();
  await expect(firstService.getByText(/Song Thanh giúp khách hàng làm rõ nhu cầu sử dụng/)).toHaveCount(0);
  const situations = page.locator('details[data-service-guidance="situations"]');
  const process = page.locator('details[data-service-guidance="process"]');
  await expect(situations).not.toHaveAttribute('open');
  await expect(process).not.toHaveAttribute('open');
  await situations.locator('summary').click();
  await expect(situations.getByText('Khi nào cần hỗ trợ?')).toBeVisible();
  await process.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(process).toHaveAttribute('open', '');
  await expect(page.getByText('Quy trình hợp tác')).toBeVisible();
  await expect(page.getByText('Thông tin nên gửi')).toBeVisible();
  await expect(page.getByText('Biểu mẫu trực tuyến', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Những tình huống dưới đây giúp bạn xác định dịch vụ phù hợp với nhu cầu hiện tại.')).toHaveCount(0);
  await expect(page.getByText('Trước khi liên hệ', { exact: true })).toHaveCount(0);
});

test('service index and each published service stay usable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    '/dich-vu',
    '/dich-vu/tu-van-ky-thuat',
    '/dich-vu/thiet-ke-he-thong',
    '/dich-vu/bao-tri-sua-chua',
    '/dich-vu/dao-tao-van-hanh'
  ]) {
    await page.goto(`${frontend}${route}`);
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});
