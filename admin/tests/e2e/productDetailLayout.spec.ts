import { expect, test } from '@playwright/test';

const frontendUrl = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const slug = 'en-led-panel-nho-tron-am-vien-bac';

test('gallery does not cover product configuration controls', async ({ page }, testInfo) => {
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ json: { ok: true, data: { recorded: true, view_count: 1 } } })
  );
  await page.goto(`${frontendUrl}/san-pham/${slug}`);
  const configuration = page.locator('#product-configuration');
  await expect(configuration).toBeVisible();
  await configuration.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('productConfiguration.png'), fullPage: false });

  const geometry = await page.evaluate(() => {
    const gallery = document.querySelector('[data-product-detail-overview] > div:first-child');
    const picker = document.querySelector('#product-configuration');
    if (!gallery || !picker) return null;
    const a = gallery.getBoundingClientRect();
    const b = picker.getBoundingClientRect();
    return {
      overlaps: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
      gallery: { left: a.left, right: a.right, top: a.top, bottom: a.bottom },
      picker: { left: b.left, right: b.right, top: b.top, bottom: b.bottom }
    };
  });
  expect(geometry).not.toBeNull();
  expect(geometry?.overlaps, JSON.stringify(geometry)).toBe(false);
});

test('a variant choice updates the selected configuration', async ({ page }) => {
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ json: { ok: true, data: { recorded: true, view_count: 1 } } })
  );
  await page.goto(`${frontendUrl}/san-pham/${slug}`);
  const selector = page.locator('#product-configuration');
  await expect(page.locator('[data-product-quick-specs] dd').first()).toHaveText('9W');
  await selector.getByRole('button', { name: '12W', exact: true }).click();
  await expect(selector.getByRole('button', { name: '12W', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(selector.getByRole('button', { name: '9W', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-product-quick-specs] dd').first()).toHaveText('12W');
});

test('gallery thumbnails change the main image and mobile controls stay usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ json: { ok: true, data: { recorded: true, view_count: 1 } } })
  );
  await page.goto(`${frontendUrl}/san-pham/${slug}`);
  const mainImage = page.locator('[data-product-gallery-image]');
  await expect(mainImage).toBeVisible();
  const initialImage = await mainImage.getAttribute('src');
  await page.getByRole('button', { name: /Xem ảnh 2 của/ }).click();
  await expect(page.getByRole('button', { name: /Xem ảnh 2 của/ })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => mainImage.getAttribute('src')).not.toBe(initialImage);
  const selector = page.locator('#product-configuration');
  await selector.getByRole('button', { name: '12W', exact: true }).click();
  await expect(selector.getByRole('button', { name: '12W', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('productMobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('wide product view keeps every variant option clickable beside the gallery', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ json: { ok: true, data: { recorded: true, view_count: 1 } } })
  );
  await page.goto(`${frontendUrl}/san-pham/${slug}`);
  const selector = page.locator('#product-configuration');
  await selector.scrollIntoViewIfNeeded();
  await selector.getByRole('button', { name: '3 chế độ màu', exact: true }).click();
  await expect(selector.getByRole('button', { name: '3 chế độ màu', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('[data-product-gallery-image]').evaluate((image: HTMLImageElement) =>
    image.complete && image.naturalWidth > 0
  )).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('productWide.png'), fullPage: false });
});

test('changing variant keeps the previous product photo visible while the next one loads', async ({ page }) => {
  await page.route('**/public/product-groups/*/view', (route) =>
    route.fulfill({ json: { ok: true, data: { recorded: true, view_count: 1 } } })
  );
  await page.goto(`${frontendUrl}/san-pham/${slug}`);
  await expect.poll(() => page.locator('[data-product-gallery-image]').evaluate((image: HTMLImageElement) =>
    image.complete && image.naturalWidth > 0
  )).toBe(true);

  let releaseImages: (() => void) | undefined;
  const imageGate = new Promise<void>((resolve) => { releaseImages = resolve; });
  let interceptedImages = 0;
  await page.route('**/_next/image?**', async (route) => {
    interceptedImages += 1;
    await imageGate;
    await route.continue();
  });
  try {
    await page.locator('#product-configuration').getByRole('button', { name: '12W', exact: true }).click();
    await expect.poll(() => interceptedImages).toBeGreaterThan(0);
    const photoVisible = await page.locator('[data-product-gallery-current]').evaluate((gallery) =>
      [...gallery.querySelectorAll('img')].some((image) =>
        image.complete && image.naturalWidth > 0 &&
        getComputedStyle(image).visibility !== 'hidden' &&
        Number(getComputedStyle(image).opacity) > 0
      )
    );
    expect(photoVisible).toBe(true);
  } finally {
    releaseImages?.();
  }
});
