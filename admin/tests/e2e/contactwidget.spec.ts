import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const frontendUrl = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

test('one contact launcher contains the saved quote list and contact channels', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('song-thanh:quote-request-items', JSON.stringify([{
      product_group_id: 'contact-widget-test-product',
      product_name: 'Sản phẩm thử nghiệm',
      quantity: 1
    }]));
  });
  await page.goto(frontendUrl);

  const trigger = page.locator('[data-floating-contact-trigger="true"]');
  await expect(trigger).toHaveCount(1);
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName(/1 sản phẩm trong danh sách yêu cầu/);
  await expect(page.locator('[data-floating-action="quote-request-list"]')).toBeHidden();
  await expect(trigger).toHaveText('1');
  await expect(trigger.locator('[data-floating-contact-label]')).toHaveCount(0);
  const closedTriggerBox = await trigger.boundingBox();
  expect(closedTriggerBox?.width).toBe(56);
  expect(closedTriggerBox?.height).toBe(56);
  const countBox = await trigger.locator('[data-floating-contact-count]').boundingBox();
  expect(countBox).not.toBeNull();
  expect(countBox!.x + countBox!.width).toBeLessThanOrEqual(closedTriggerBox!.x + closedTriggerBox!.width);
  await page.screenshot({ path: testInfo.outputPath('contactTriggerDesktop.png') });

  await trigger.click();
  const panel = page.locator('[data-floating-contact-panel="true"]');
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await expect(panel).toHaveAccessibleName('Kênh liên hệ Song Thanh');
  await expect(panel).toHaveAttribute('data-floating-contact-style', 'speed-dial');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName('Đóng liên hệ Song Thanh');
  await expect(trigger).toHaveText('');
  expect(await panel.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  await expect(panel.locator('[data-floating-contact-primary]')).toBeVisible();
  await expect(panel.locator('[data-floating-contact-socials]')).toBeVisible();
  const hotlineBox = await panel.getByRole('link', { name: /Gọi hotline/ }).boundingBox();
  const facebookBox = await panel.getByRole('link', { name: 'Facebook' }).boundingBox();
  const zaloBox = await panel.getByRole('link', { name: 'Zalo' }).boundingBox();
  const quoteBox = await panel.getByRole('button', { name: /Danh sách yêu cầu/ }).boundingBox();
  expect(hotlineBox).not.toBeNull();
  expect(facebookBox).not.toBeNull();
  expect(zaloBox).not.toBeNull();
  expect(quoteBox).not.toBeNull();
  expect(Math.abs(hotlineBox!.x - facebookBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(hotlineBox!.x - quoteBox!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(hotlineBox!.x + hotlineBox!.width - zaloBox!.x - zaloBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(facebookBox!.width - zaloBox!.width)).toBeLessThanOrEqual(1);
  await expect(panel.getByRole('button', { name: /Danh sách yêu cầu/ })).toContainText('1 sản phẩm đã chọn');
  await expect(panel.getByRole('link', { name: /Gọi hotline/ })).toHaveAttribute('href', /^tel:/);
  const hotlineNumber = panel.locator('[data-floating-hotline-number]').first();
  await expect(hotlineNumber).toBeVisible();
  expect(await hotlineNumber.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  await expect(panel.getByRole('link', { name: /Zalo/ })).toHaveAttribute('href', /^https:\/\//);
  await expect(trigger).toBeFocused();
  const accessibility = await new AxeBuilder({ page }).include('[data-floating-contact-panel="true"]').analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('contactPanelDesktop.png') });
  await trigger.press('Tab');
  await expect(panel.getByRole('link', { name: /Gọi hotline/ })).toBeFocused();

  await panel.getByRole('button', { name: /Danh sách yêu cầu/ }).click();
  const quoteDialog = page.getByRole('dialog', { name: 'Danh sách yêu cầu' });
  await expect(quoteDialog).toBeVisible();
  await expect(panel).toBeHidden();
  await expect(trigger).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(quoteDialog).toHaveCount(0);
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeVisible();
  await expect(trigger).toBeFocused();
  expect(browserErrors).toEqual([]);
});

test('keyboard opening moves focus into the contact choices', async ({ page }) => {
  await page.goto(frontendUrl);
  const trigger = page.locator('[data-floating-contact-trigger="true"]');
  await trigger.focus();
  await trigger.press('Enter');
  const panel = page.locator('[data-floating-contact-panel="true"]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('link', { name: /Gọi hotline/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('contact panel fits narrow screens and returns to its launcher', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('song-thanh:quote-request-items', JSON.stringify([{
      product_group_id: 'contact-widget-test-product',
      product_name: 'Sản phẩm thử nghiệm',
      quantity: 1
    }]));
  });
  await page.goto(frontendUrl);

  const trigger = page.locator('[data-floating-contact-trigger="true"]');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveText('1');
  expect((await trigger.boundingBox())?.width).toBe(56);
  const panel = page.locator('[data-floating-contact-panel="true"]');
  await trigger.click();
  await expect(panel).toBeVisible();
  await trigger.click();
  await expect(panel).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('contactTriggerMobile.png') });
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  const facebookLabel = panel.getByRole('link', { name: 'Facebook' }).locator('span.truncate');
  expect(await facebookLabel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const hotlineNumber = panel.locator('[data-floating-hotline-number]').first();
  expect(await hotlineNumber.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(panel.getByRole('button', { name: /Danh sách yêu cầu/ })).toBeVisible();
  const panelBox = await panel.boundingBox();
  const triggerBox = await trigger.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(triggerBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(320);
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(triggerBox!.y - 4);
  await expect(trigger).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('contactPanelMobile.png') });
  await trigger.click();
  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAccessibleName(/1 sản phẩm trong danh sách yêu cầu/);
});

test('contact launcher stays compact on the product catalog and closes on outside click', async ({ page }, testInfo) => {
  await page.goto(`${frontendUrl}/san-pham`);

  const trigger = page.locator('[data-floating-contact-trigger="true"]');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAccessibleName('Liên hệ Song Thanh');
  await trigger.click();

  const panel = page.locator('[data-floating-contact-panel="true"]');
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  await page.screenshot({ path: testInfo.outputPath('contactPanelProducts.png') });

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.x).toBeGreaterThanOrEqual(0);
    expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(width);
  }

  await page.mouse.click(200, 300);
  await expect(panel).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('quote form separates selected products from contact details and adapts to mobile', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('song-thanh:quote-request-items', JSON.stringify([{
      product_group_id: 'contact-widget-test-product',
      product_name: 'Sản phẩm thử nghiệm',
      quantity: 1
    }]));
  });
  await page.goto(frontendUrl);
  await page.locator('[data-floating-contact-trigger="true"]').click();
  await page.locator('[data-floating-action="quote-request-list"]').click();

  const dialog = page.getByRole('dialog', { name: 'Danh sách yêu cầu' });
  await expect(dialog).toBeVisible();
  const products = dialog.locator('[data-quote-products]');
  const contact = dialog.locator('[data-quote-contact-fields]');
  const desktopProducts = await products.boundingBox();
  const desktopContact = await contact.boundingBox();
  expect(desktopProducts).not.toBeNull();
  expect(desktopContact).not.toBeNull();
  expect(desktopProducts!.x + desktopProducts!.width).toBeLessThanOrEqual(desktopContact!.x);
  await expect(dialog.getByRole('textbox', { name: 'Công ty' })).toBeHidden();
  const formAccessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  expect(formAccessibility.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('quoteFormDesktop.png') });

  await page.setViewportSize({ width: 320, height: 640 });
  const mobileProducts = await products.boundingBox();
  const mobileContact = await contact.boundingBox();
  expect(mobileProducts).not.toBeNull();
  expect(mobileContact).not.toBeNull();
  expect(mobileProducts!.y + mobileProducts!.height).toBeLessThanOrEqual(mobileContact!.y);
  await page.screenshot({ path: testInfo.outputPath('quoteFormMobileInitial.png') });
  await dialog.getByText('Thông tin bổ sung').click();
  await expect(dialog.getByRole('textbox', { name: 'Công ty' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.screenshot({ path: testInfo.outputPath('quoteFormMobile.png') });
});

test('clearing the quote list keeps keyboard focus inside the dialog', async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('song-thanh:quote-request-items', JSON.stringify([{
      product_group_id: 'contact-widget-test-product',
      product_name: 'Sản phẩm thử nghiệm',
      quantity: 1
    }]));
  });
  await page.goto(frontendUrl);
  await page.locator('[data-floating-contact-trigger="true"]').click();
  await page.locator('[data-floating-action="quote-request-list"]').click();

  const dialog = page.getByRole('dialog', { name: 'Danh sách yêu cầu' });
  await dialog.getByRole('button', { name: 'Xóa hết' }).click();
  await expect(dialog.getByText(/Danh sách yêu cầu đang trống/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Đóng', exact: true })).toBeFocused();
});
