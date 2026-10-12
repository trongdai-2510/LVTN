import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const frontend = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

async function expectNoOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  expect(sizes.content).toBeLessThanOrEqual(sizes.viewport + 1);
}

test('catalog pagination keeps the current page at both boundaries', async ({ page, request }) => {
  const response = await request.get(`${api}/public/product-groups?page_size=12`);
  expect(response.ok()).toBeTruthy();
  const { data: { pagination } } = await response.json();
  expect(pagination.page_count).toBeGreaterThan(5);

  for (const current of [1, 4, pagination.page_count - 1, pagination.page_count]) {
    await page.goto(`${frontend}/san-pham/danh-sach?page=${current}`);
    const activePage = page.getByRole('navigation', { name: 'Phân trang sản phẩm' }).locator('[aria-current="page"]');
    await expect(activePage).toHaveCount(1);
    await expect(activePage).toHaveText(String(current));
    await expectNoOverflow(page);
  }
});

test('catalog listing keeps the same global header search as other public pages', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['/san-pham', '/san-pham/danh-sach?parent=en-led', '/doi-tac-thuong-hieu']) {
    await page.goto(`${frontend}${path}`);
    await expect(page.locator('header.site-header-surface').getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' })).toBeVisible();
  }
});

test('catalog shows exact prices and variant price guidance without a misleading minimum', async ({ page }, testInfo) => {
  await page.goto(`${frontend}/san-pham/danh-sach`);
  await page.route('**/public/product-groups?**', async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    if (payload?.data?.items?.length >= 4) {
      payload.data.items[0].public_price_summary = {
        display_mode: 'exact_price', display_amount: 125000,
        priced_variant_count: 1, variant_count: 1
      };
      payload.data.items[1].public_price_summary = {
        display_mode: 'from_price', display_amount: 99000,
        priced_variant_count: 1, variant_count: 2
      };
      payload.data.items[3].public_price_summary = {
        display_mode: 'from_price', display_amount: 88000,
        priced_variant_count: 2, variant_count: 2
      };
    }
    await route.fulfill({ response, json: payload });
  });

  await page.getByRole('button', { name: /^Sắp xếp:/ }).click();
  await page.getByRole('button', { name: 'Phổ biến nhất', exact: true }).click();

  const cards = page.locator('[data-catalog-card="true"]');
  await expect(cards.first().locator('[data-public-price-summary="exact_price"]')).toContainText('125.000');
  await expect(cards.nth(1).locator('[data-public-price-summary="from_price"]')).toContainText('Một số mã sản phẩm có giá');
  await expect(cards.nth(1).locator('[data-public-price-summary="from_price"]')).not.toContainText('99.000');
  await expect(cards.nth(3).locator('[data-public-price-summary="from_price"]')).toContainText('Giá theo từng mã sản phẩm');
  await expect(cards.nth(3).locator('[data-public-price-summary="from_price"]')).not.toContainText('88.000');
  await expect(cards.first().locator('[data-product-card-secondary-action]')).toHaveCount(0);
  await expect(cards.nth(2).locator('[data-product-card-secondary-action]')).toBeVisible();
  await cards.first().locator('[data-public-price-summary]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('pricedcatalogdesktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('pricedcatalogmobile.png') });
});

test('price visibility filter remains selected on direct navigation', async ({ page }) => {
  await page.goto(`${frontend}/san-pham/danh-sach?status=has_price`);
  await expect(page).toHaveURL(/status=has_price/);
  await expect(page.locator('[data-active-filters]').getByRole('button', { name: /Có giá công khai/ })).toBeVisible();
});

test('public header only links to system pages exposed by the managed menu', async ({ page, request }) => {
  const shellResponse = await request.get(`${api}/public/site-shell`);
  expect(shellResponse.ok()).toBe(true);
  const shell = (await shellResponse.json()).data;
  expect(shell.header_menu).not.toBeNull();
  const managedTargets = new Set(shell.header_menu.items.map((item: { link_target: string }) => item.link_target));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(frontend);
  const headerTargets = await page.locator('header.site-header-surface nav a').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(headerTargets.length).toBeGreaterThan(0);
  for (const target of headerTargets) {
    expect(managedTargets.has(target), `Unexpected public header target: ${target}`).toBe(true);
  }
});

test('public favicon uses the configured image route without generic icon metadata', async ({ page, request }) => {
  await page.goto(`${frontend}/san-pham`);
  const iconLinks = await page.locator('link[rel="icon"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  expect(iconLinks).toEqual(['/favicon']);
  const response = await request.get(`${frontend}/favicon`);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
});

test('admin preview permits the local admin frame without opening normal pages to framing', async ({ request }) => {
  const preview = await request.get(`${frontend}/admin-preview/page-content`);
  const publicPage = await request.get(`${frontend}/san-pham`);
  expect(preview.ok()).toBe(true);
  expect(publicPage.ok()).toBe(true);
  expect(preview.headers()['content-security-policy']).toContain(
    "frame-ancestors 'self' http://localhost:3001 http://127.0.0.1:3001"
  );
  expect(preview.headers()['x-frame-options']).toBeUndefined();
  expect(publicPage.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(publicPage.headers()['x-frame-options']).toBe('DENY');
});

test('catalog category pages show eight sections at most and support keyboard navigation', async ({ page }) => {
  await page.goto(`${frontend}/san-pham`);
  const explorer = page.locator('[data-product-category-explorer]');
  const sections = explorer.locator('[data-product-category-section]');
  await expect(sections.first()).toBeVisible();
  expect(await sections.count()).toBeLessThanOrEqual(8);
  const next = explorer.getByRole('navigation', { name: 'Trang danh mục' }).first().getByRole('button', { name: 'Tiếp' });
  if (await next.count()) {
    const firstCategory = await sections.first().getAttribute('id');
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(sections.first()).not.toHaveAttribute('id', firstCategory!);
    await expect(explorer.getByRole('navigation', { name: 'Trang danh mục' }).first().getByRole('button', { name: 'Trước' })).toBeEnabled();
  }
});

test('catalog cards stay compact on phones and fit each desktop breakpoint', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto(`${frontend}/san-pham/danh-sach`);
  const card = page.locator('[data-product-card]').first();
  await expect(card).toBeVisible();
  for (const width of [320, 390, 480, 768, 1024, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (width < 480) expect(box!.height).toBeLessThanOrEqual(270);
    for (const selector of ['[data-product-card-primary-action]', '[data-product-card-secondary-action]']) {
      const action = card.locator(selector);
      if (await action.count() === 0) continue;
      const actionBox = await action.boundingBox();
      expect(actionBox!.height).toBeGreaterThanOrEqual(44);
      expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(box!.x + box!.width);
    }
    if ([390, 1440, 2560].includes(width)) {
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`catalog${width}.png`), caret: 'initial' });
    }
  }
});

test('product codes stay compact and keep variant links usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${frontend}/san-pham/danh-sach`);

  const summary = page.locator('[data-catalog-card] [data-product-code-summary]').first();
  await expect(summary).toBeVisible();
  const label = summary.getByText('Mã', { exact: true });
  const code = summary.locator('[data-product-code-value]');
  await expect(code).toBeVisible();
  const labelBox = await label.boundingBox();
  const codeBox = await code.boundingBox();
  expect(labelBox).not.toBeNull();
  expect(codeBox).not.toBeNull();
  expect(codeBox!.y).toBeLessThan(labelBox!.y + labelBox!.height);
  await expect(code).toHaveAttribute('href', /\/san-pham\/[^?]+\?variant=/);
  await expect(summary.locator('[data-product-code-count]')).toHaveCount(0);
  expect(await summary.evaluate((element) => getComputedStyle(element).borderLeftWidth)).toBe('0px');

  await summary.locator('xpath=ancestor::*[@data-catalog-card][1]').screenshot({ path: testInfo.outputPath('productCodeDesktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page);
  await summary.locator('xpath=ancestor::*[@data-catalog-card][1]').screenshot({ path: testInfo.outputPath('productCodeMobile.png') });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${frontend}/tim-kiem?q=c%C3%A1p`);
  const searchCard = page.locator('[data-product-card] [data-product-code-summary]').first().locator('xpath=ancestor::*[@data-product-card][1]');
  await expect(searchCard.locator('[data-product-code-value]')).toBeVisible();
  await searchCard.screenshot({ path: testInfo.outputPath('productCodeSearchDesktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoOverflow(page);
  await searchCard.screenshot({ path: testInfo.outputPath('productCodeSearchMobile.png') });
});

test('home featured products show available brand logos', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(frontend);
  const section = page.locator('[data-home-featured-products]');
  await expect(section).toBeVisible();
  await section.scrollIntoViewIfNeeded();
  const logo = section.locator('[data-product-card-brand-logo]').first();
  await expect(logo).toBeVisible();
  await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await section.screenshot({ path: testInfo.outputPath('featuredBrandLogos.png') });
});

test('search result cards align technical labels and values and adapt on phones', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${frontend}/tim-kiem?q=c%C3%A1p`);
  const card = page.locator('[data-product-card="true"]')
    .filter({ has: page.locator('dl > div:nth-child(2)') })
    .first();
  await expect(card).toBeVisible();
  const specs = card.locator('dl > div');
  await expect(specs).toHaveCount(2);
  const firstLabel = await specs.nth(0).locator('dt').boundingBox();
  const firstValue = await specs.nth(0).locator('dd').boundingBox();
  const secondLabel = await specs.nth(1).locator('dt').boundingBox();
  expect(firstLabel).not.toBeNull();
  expect(firstValue).not.toBeNull();
  expect(secondLabel).not.toBeNull();
  expect(Math.abs(firstValue!.y - firstLabel!.y)).toBeLessThanOrEqual(1);
  expect(firstValue!.x).toBeGreaterThan(firstLabel!.x);
  expect(secondLabel!.y).toBeGreaterThan(firstLabel!.y);
  expect(Math.abs(secondLabel!.x - firstLabel!.x)).toBeLessThanOrEqual(1);
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: testInfo.outputPath('searchCardDesktop.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(specs.nth(0)).toBeVisible();
  await expect(specs.nth(1)).toBeHidden();
  await expectNoOverflow(page);
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: testInfo.outputPath('searchCardMobile.png') });
});

test('product detail tabs fit phones and support Home and End', async ({ page, request }) => {
  const response = await request.get(`${api}/public/product-groups?page_size=1`);
  const { data: { items } } = await response.json();
  expect(items.length).toBe(1);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`${frontend}/san-pham/${encodeURIComponent(items[0].slug)}`);
  const tablist = page.getByRole('tablist', { name: 'Nội dung chi tiết sản phẩm' });
  const tabs = tablist.getByRole('tab');
  await tabs.first().focus();
  await page.keyboard.press('End');
  await expect(tabs.last()).toBeFocused();
  await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  const dimensions = await tablist.evaluate(el => ({ actual: el.scrollWidth, visible: el.clientWidth }));
  expect(dimensions.actual).toBeLessThanOrEqual(dimensions.visible + 1);
  await expectNoOverflow(page);
});

test('product explorer meets automated WCAG checks on desktop and mobile', async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${frontend}/san-pham`);
    await expect(page.locator('[data-product-category-explorer]')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  }
});

test('product listing meets automated WCAG checks on desktop and mobile', async ({ page }) => {
  test.setTimeout(120_000);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${frontend}/san-pham/danh-sach?parent=en-led`);
    await expect(page.locator('[data-catalog-card]').first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  }
});

test('product landing gives the managed banner full width without repeated search', async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${frontend}/san-pham`);

    const header = page.locator('[data-product-landing-header="true"]');
    const explorer = page.locator('[data-product-category-explorer="true"]');
    const campaign = page.getByRole('region', { name: 'Chiến dịch sản phẩm' });
    const campaignFrame = page.locator('[data-product-campaign-frame="true"]');
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(header).toHaveCount(1);
    await expect(header.getByRole('searchbox')).toHaveCount(0);
    await expect(campaign).toBeVisible();
    await expect(explorer).toHaveAttribute('data-product-catalog-layout', 'paged-categories');
    await expect(page.getByRole('navigation', { name: 'Đi nhanh tới danh mục sản phẩm' })).toHaveCount(0);
    await expect(page.getByText('Chọn nhóm thiết bị để bắt đầu', { exact: true })).toHaveCount(0);

    const headerBox = await header.boundingBox();
    const campaignBox = await campaign.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(campaignBox).not.toBeNull();
    expect(campaignBox!.y).toBeLessThan(headerBox!.y);
    expect((await breadcrumb.boundingBox())!.y).toBeLessThan(campaignBox!.y);
    if (width >= 1280) {
      const frameBox = await campaignFrame.boundingBox();
      expect(frameBox!.width / width).toBeGreaterThan(0.8);
    }
    await expectNoOverflow(page);

    if (width === 390 || width === 1920) {
      await page.screenshot({ path: testInfo.outputPath(`productlanding${width}.png`), caret: 'initial' });
    }
  }
});

test('image-only product campaigns fill their frame without cropping artwork on wide screens', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1200 });
  await page.goto(`${frontend}/san-pham`);
  const campaign = page.getByRole('region', { name: 'Banner trang sản phẩm' });
  const image = campaign.locator('[aria-hidden="false"] img');
  await expect(image).toHaveJSProperty('complete', true);
  const dimensions = await image.evaluate((element: HTMLImageElement) => {
    const frame = element.getBoundingClientRect();
    const renderedWidth = Math.min(frame.width, frame.height * element.naturalWidth / element.naturalHeight);
    return { frameWidth: frame.width, renderedWidth, naturalWidth: element.naturalWidth };
  });
  expect(dimensions.naturalWidth).toBeGreaterThan(0);
  expect(dimensions.renderedWidth / dimensions.frameWidth).toBeGreaterThanOrEqual(0.95);
  expect((await campaign.boundingBox())!.height).toBeLessThanOrEqual(900);
  await expectNoOverflow(page);
});

test('mobile product campaign controls sit below the artwork', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontend}/san-pham`);
  const campaign = page.getByRole('region', { name: 'Banner trang sản phẩm' });
  const image = campaign.locator('[aria-hidden="false"] img');
  await expect(image).toHaveJSProperty('complete', true);
  const controls = page.getByRole('button', { name: 'Chuyển tới banner 2' });
  await expect(controls).toBeVisible();
  const initialAlt = await image.getAttribute('alt');
  const imageBox = await image.boundingBox();
  const controlBox = await controls.boundingBox();
  expect(controlBox!.y).toBeGreaterThanOrEqual(imageBox!.y + imageBox!.height);
  await controls.click();
  await expect(controls).toHaveAttribute('aria-current', 'true');
  expect(await campaign.locator('[aria-hidden="false"] img').getAttribute('alt')).not.toBe(initialAlt);
  await expectNoOverflow(page);
});

test('brand directory hides placeholder copy and renders only public admin data', async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${frontend}/doi-tac-thuong-hieu`);

    await expect(page.getByRole('heading', { level: 1, name: 'Thương hiệu sản phẩm' })).toBeVisible();
    await expect(page.locator('[data-brand-hero-stage]')).toHaveCount(0);
    await expect(page.getByText('Nội dung đang cập nhật', { exact: false })).toHaveCount(0);
    await expect(page.getByText('Sản phẩm và tài liệu đang cập nhật', { exact: false })).toHaveCount(0);
    await expect(page.locator('a[href^="/doi-tac-thuong-hieu/"]')).not.toHaveCount(0);
    await expectNoOverflow(page);

    if (width === 390 || width === 1920) {
      await page.screenshot({ path: testInfo.outputPath(`branddirectory${width}.png`), caret: 'initial' });
    }
  }
});

test('brand detail uses public linked products to fill the hero without a fabricated banner', async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 900 });
  await page.goto(`${frontend}/doi-tac-thuong-hieu/anfaco`);
  const preview = page.locator('[data-brand-hero-preview="true"]');
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('link')).not.toHaveCount(0);
  await expect(page.locator('#san-pham')).toBeVisible();
  await expectNoOverflow(page);
});

test('brand pages keep navigation within Song Thanh and do not expose source-only outbound links', async ({ page }) => {
  await page.goto(`${frontend}/doi-tac-thuong-hieu`);
  await expect(page.getByText('Xem danh bạ', { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-brand-directory] a[href^="http"]')).toHaveCount(0);

  await page.goto(`${frontend}/doi-tac-thuong-hieu/duhal`);
  await expect(page.getByRole('heading', { name: 'Liên kết chính thức' })).toHaveCount(0);
  await expect(page.locator('main a[href^="https://duhal.com.vn"]')).toHaveCount(0);
  await expect(page.locator('#san-pham').getByRole('link', { name: 'Xem tất cả' })).toBeVisible();
});

test('brand products open the filtered catalog without changing the shared header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${frontend}/doi-tac-thuong-hieu/duhal`);
  await page.locator('#san-pham').getByRole('link', { name: 'Xem tất cả' }).click();
  await expect(page).toHaveURL(/\/san-pham\/danh-sach\?brands=duhal/);
  await expect(page.locator('[data-product-listing-heading] h1')).toContainText('DUHAL');
  await expect(page.locator('header.site-header-surface').getByRole('searchbox', { name: 'Tìm kiếm sản phẩm' })).toBeVisible();
  await expectNoOverflow(page);
});

test('mobile catalog keeps one search, removable filters and a working quote action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontend}/san-pham/danh-sach?parent=en-led`);
  await expect(page.locator('[data-catalog-card]').first()).toBeVisible();
  await expect(page.getByRole('searchbox')).toHaveCount(1);
  await expect(page.locator('button[aria-controls="product-filter-panel"]').filter({ hasText: 'Lọc' })).toBeVisible();
  await expect(page.locator('[data-active-filters] button').first()).toContainText('Đèn LED');
  await expectNoOverflow(page);

  await page.locator('[data-catalog-card] [data-product-card-secondary-action]').first().click();
  await expect(page.getByRole('dialog', { name: 'Danh sách yêu cầu' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('[data-active-filters] button').first().click();
  await expect(page).toHaveURL(/\/san-pham\/danh-sach(?:\?|$)/);
  await expect(page).not.toHaveURL(/parent=en-led/);
});

test('project case study uses one responsive narrative flow without the legacy side rail', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const slug = 'he-thong-dien-san-bay-long-thanh-giai-doan-1';

  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${frontend}/du-an/${slug}`);

    const caseStudy = page.locator('[data-page-archetype="project-case-study"]');
    await expect(caseStudy.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(caseStudy.locator('[data-project-cover="true"] img')).toHaveJSProperty('complete', true);
    await expect(caseStudy.getByRole('navigation', { name: 'Điều hướng hồ sơ dự án' })).toBeVisible();
    await expect(caseStudy.locator('#hinh-anh-du-an')).toHaveCount(0);
    await expect(caseStudy.locator('#san-pham-du-an')).toBeVisible();
    await expect(caseStudy.getByText('ST', { exact: true })).toHaveCount(0);
    await expectNoOverflow(page);

    if (width === 390 || width === 1920) {
      await page.screenshot({ path: testInfo.outputPath(`projectdetail${width}.png`), caret: 'initial' });
    }
  }
});

test('product gallery exposes every published image, including images after the fourth', async ({ page, request }) => {
  const slug = 'ong-ho-than-nhua-loai-tu-a-tia-cap-2-mhc-dn15';
  const response = await request.get(`${api}/public/product-groups/${slug}`);
  expect(response.ok(), 'multi-image public catalog fixture must be available').toBeTruthy();
  const { data: detail } = await response.json();
  expect(detail.images.length).toBeGreaterThan(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontend}/san-pham/${slug}`);
  const thumbnails = page.getByRole('group', { name: 'Ảnh sản phẩm' }).getByRole('button');
  await expect(thumbnails).toHaveCount(detail.images.length);
  await thumbnails.last().click();
  await expect(thumbnails.last()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-product-gallery-current]')).toBeVisible();
  await expectNoOverflow(page);
});

test('requesting a quote keeps the customer on the product and opens the selected request', async ({ page, request }) => {
  const response = await request.get(`${api}/public/product-groups?page_size=1`);
  expect(response.ok()).toBeTruthy();
  const { data: { items } } = await response.json();
  expect(items.length).toBe(1);

  const productUrl = `${frontend}/san-pham/${encodeURIComponent(items[0].slug)}`;
  await page.goto(productUrl);
  const requestButton = page.locator('[data-quote-action="open"]');
  const saveButton = page.locator('[data-quote-action="save"]');
  await expect(requestButton).toHaveText(/Nhận báo giá ngay|Gửi yêu cầu ngay/);
  await expect(saveButton).toHaveText('Lưu vào danh sách');
  await requestButton.click();

  await expect(page).toHaveURL(productUrl);
  const dialog = page.getByRole('dialog', { name: 'Danh sách yêu cầu' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(String(items[0].name), { exact: false })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(requestButton).toBeFocused();
});

test('saving a product for a later combined request does not open the quote dialog', async ({ page, request }) => {
  const response = await request.get(`${api}/public/product-groups?page_size=1`);
  expect(response.ok()).toBeTruthy();
  const { data: { items } } = await response.json();
  await page.goto(`${frontend}/san-pham/${encodeURIComponent(items[0].slug)}`);

  await page.locator('[data-quote-action="save"]').click();
  await expect(page.getByRole('dialog', { name: 'Danh sách yêu cầu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem danh sách đã lưu' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Sản phẩm đã có trong danh sách yêu cầu');
});

test('the retired quote workspace sends old links back to the product catalog', async ({ page }) => {
  await page.goto(`${frontend}/yeu-cau-bao-gia`);

  await expect(page).toHaveURL(`${frontend}/san-pham/danh-sach`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('sản phẩm');
  await expect(page.getByText('Gom đúng nhu cầu trước khi nhận tư vấn.')).toHaveCount(0);
});
