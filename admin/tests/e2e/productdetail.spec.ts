import { expect, test } from '@playwright/test';

const frontend = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const slug = 'den-led-ong-bo-chieu-roi-emerald';

test('quote-only product omits the price panel but keeps inquiry actions', async ({ page }, testInfo) => {
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":{"recorded":true,"view_count":0}}' })
  );
  await page.goto(`${frontend}/san-pham/${slug}`);
  const actions = page.locator('[data-product-primary-actions]');
  await expect(actions).toBeVisible();
  await expect(page.locator('[data-product-public-price]')).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'Nhận báo giá ngay' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Lưu vào danh sách' })).toBeVisible();
  await actions.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('quoteActionsDesktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(actions.getByRole('button', { name: 'Nhận báo giá ngay' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await actions.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('quoteActionsMobile.png') });
});

test('product gallery follows the active variant from the first render', async ({ browser, page, request }) => {
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":{"recorded":true,"view_count":0}}' })
  );
  const response = await request.get(`${api}/public/product-groups/${slug}`);
  expect(response.ok()).toBeTruthy();
  const { data } = await response.json();
  const firstVariant = data.variants.find((variant: { model_code: string }) =>
    variant.model_code.includes('-OBR-')
  );
  const secondVariant = data.variants.find((variant: { id: string; model_code: string }) =>
    variant.id !== firstVariant.id &&
    variant.model_code.includes('-OBR-') &&
    data.images.some((image: { product_variant_id: string }) => image.product_variant_id === variant.id)
  );
  expect(firstVariant).toBeTruthy();
  expect(secondVariant).toBeTruthy();

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto(`${frontend}/san-pham/${slug}`);
  await expect(noScriptPage.getByRole('group', { name: 'Ảnh sản phẩm' })).toHaveCount(0);
  await noScriptContext.close();

  await page.goto(`${frontend}/san-pham/${slug}`);
  const gallery = page.locator('[data-product-gallery-current]');
  await expect(gallery.locator('[data-product-gallery-image="true"]')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Ảnh sản phẩm' })).toHaveCount(0);
  await expect(page.getByText(firstVariant.variant_name, { exact: true }).first()).toBeVisible();

  await page.goto(`${frontend}/san-pham/${slug}?variant=${encodeURIComponent(secondVariant.model_code)}`);
  await expect(gallery.locator('[data-product-gallery-image="true"]')).toHaveCount(1);
  await expect(page.getByRole('group', { name: 'Ảnh sản phẩm' })).toHaveCount(0);
  await expect(page.getByText(secondVariant.variant_name, { exact: true }).first()).toBeVisible();
});

test('switching a product attribute keeps specs and gallery on the same variant', async ({ page }) => {
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":{"recorded":true,"view_count":0}}' })
  );
  await page.goto(`${frontend}/san-pham/${slug}`);
  const currentImage = page.locator('[data-product-gallery-image="true"]');
  const originalSource = await currentImage.getAttribute('src');
  const powerOption = page.getByRole('button', { name: '15W', exact: true });
  await expect(powerOption).toBeEnabled();
  await powerOption.click();
  await expect(powerOption).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/OBR-15SS/).first()).toBeVisible();
  await expect.poll(() => currentImage.getAttribute('src')).not.toBe(originalSource);
  await expect(page.getByRole('group', { name: 'Ảnh sản phẩm' })).toHaveCount(0);
  await expect(page).toHaveURL(/\?variant=[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByText(/OBR-15SS/).first()).toBeVisible();
});

test('product actions and overview use the available width responsively', async ({ page }, testInfo) => {
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":{"recorded":true,"view_count":0}}' })
  );
  for (const width of [390, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${frontend}/san-pham/${slug}`);
    const actions = page.locator('[data-product-primary-actions]');
    const quote = actions.getByRole('button', { name: 'Nhận báo giá ngay' });
    const save = actions.getByRole('button', { name: 'Lưu vào danh sách' });
    const quoteBox = await quote.boundingBox();
    const saveBox = await save.boundingBox();
    expect(quoteBox).not.toBeNull();
    expect(saveBox).not.toBeNull();
    if (width >= 1440) {
      expect(Math.abs(quoteBox!.y - saveBox!.y)).toBeLessThan(2);
      expect(quoteBox!.height).toBeLessThanOrEqual(48);
    }
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1);
    if (width !== 1440) {
      await page.screenshot({ path: testInfo.outputPath(`productdetail${width}.png`), fullPage: true });
    }
  }
});

test('contact bubble remains available on a product detail page', async ({ page }) => {
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"data":{"recorded":true,"view_count":0}}' })
  );
  await page.goto(`${frontend}/san-pham/${slug}`);
  const trigger = page.getByRole('button', { name: 'Liên hệ Song Thanh' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('group', { name: 'Kênh liên hệ Song Thanh' })).toBeVisible();
});
