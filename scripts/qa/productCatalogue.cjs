const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../admin/node_modules/playwright');
const AxeBuilder = require('../../admin/node_modules/@axe-core/playwright').default;

const base = process.env.WEB_BASE_URL || 'http://localhost:3000';
const artifactDirectory = path.resolve(__dirname, '../../frontend/tmp/qa-artifacts/productCatalogue');

(async () => {
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/san-pham`, { waitUntil: 'networkidle' });
      const sections = page.locator('[data-product-category-section]');
      assert.equal(await sections.count(), 8, `${width}px: expected all eight categories`);
      for (const section of await sections.all()) {
        const cardCount = await section.locator('[data-product-card]').count();
        assert(cardCount > 0 && cardCount <= 4, `${width}px: unexpected number of previews`);
      }
      assert.equal(await page.locator('[data-product-catalog-layout="paged-categories"]').count(), 1);
      assert.equal(await page.locator('[data-product-catalog-layout] nav, [data-product-catalog-layout] [role="tablist"]').count(), 0);
      assert.equal(await sections.first().locator('h2').innerText(), 'DÂY DẪN');
      assert.equal(await sections.first().getByText(/^01\s*\//).count(), 0);
      assert.equal(await sections.first().locator('[data-category-brands] [data-category-brand]').count(), 3);
      assert(await sections.first().locator('[data-category-brands] img').count() >= 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const catalogA11y = await new AxeBuilder({ page }).include('[data-product-catalog-layout]').analyze();
      assert.deepEqual(catalogA11y.violations.map(item => item.id), []);
      await page.screenshot({ path: path.join(artifactDirectory, `landing${width}.png`) });
      await sections.first().evaluate(element => {
        window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - (window.innerWidth >= 1024 ? 120 : 150));
      });
      await page.screenshot({ path: path.join(artifactDirectory, `catalogOverview${width}.png`) });
      assert.equal(await page.locator('[data-product-catalog-layout] input[type="search"]').count(), 0, 'unnecessary category search remains');
      assert.equal(await sections.nth(1).locator('#category-title-en-led').count(), 1);
      await sections.nth(1).locator('#category-title-en-led a').click();
      await page.waitForURL(/\/san-pham\/danh-sach\?parent=en-led/);
      assert.equal(await page.locator('h1').first().innerText(), 'ĐÈN LED');
      assert.deepEqual(errors, []);
      console.log(`${width}px: eight groups without extra category search or numbering; brand logos, category link, layout and axe pass`);
      await context.close();
    }

    const brandContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const brandPage = await brandContext.newPage();
    await brandPage.goto(`${base}/san-pham`, { waitUntil: 'networkidle' });
    await brandPage.locator('#category-day-dan [data-category-brand="cadivi"]').click();
    await brandPage.waitForURL(/\/san-pham\/danh-sach\?/);
    assert.equal(new URL(brandPage.url()).searchParams.get('parent'), 'day-dan');
    assert.equal(new URL(brandPage.url()).searchParams.get('brands'), 'cadivi');
    console.log('Category brand logo opens the matching filtered product list');
    await brandContext.close();

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/san-pham/danh-sach?parent=day-dan`, { waitUntil: 'networkidle' });
    assert.equal(await page.locator('main input[type="search"]').count(), 1, 'listing shows duplicate search inputs');
    assert.equal(await page.getByRole('button', { name: 'Tìm danh mục' }).count(), 0, 'redundant category finder remains');
    assert.equal(await page.locator('#product-filter-panel').count(), 0);
    const nav = page.getByRole('navigation', { name: 'Duyệt nhóm sản phẩm' });
    for (const name of ['Tất cả', 'DÂY DẪN', 'ĐÈN LED', 'ĐỒNG HỒ ĐO', 'ỐNG - PHỤ KIỆN PVC', 'QUẠT', 'THIẾT BỊ ĐIỆN', 'TỦ ĐIỆN', 'VAN CÔNG NGHIỆP']) {
      assert.equal(await nav.getByRole('button', { name }).count(), 1, `duplicate or missing category ${name}`);
    }
    await page.screenshot({ path: path.join(artifactDirectory, 'listingSelected1440.png') });
    await nav.getByRole('button', { name: 'ĐÈN LED' }).click();
    await page.waitForURL(/parent=en-led/);
    assert.equal(await page.locator('h1').first().innerText(), 'ĐÈN LED');
    await nav.getByRole('button', { name: 'Tất cả' }).click();
    await page.waitForURL(url => !url.searchParams.has('parent'));
    assert.equal(await page.locator('h1').first().innerText(), 'Tất cả sản phẩm');
    await nav.getByRole('button', { name: 'DÂY DẪN' }).click();
    await page.waitForURL(/parent=day-dan/);
    const gridTopBeforeFilter = await page.locator('[data-product-grid]').evaluate(element => element.getBoundingClientRect().top);
    await page.getByRole('button', { name: 'Lọc', exact: true }).click();
    let sidebar = page.locator('#product-filter-panel');
    await sidebar.getByRole('button', { name: /DÂY ĐIỆN/ }).waitFor();
    const panelBottom = await sidebar.evaluate(element => element.getBoundingClientRect().bottom);
    const gridTopAfterFilter = await page.locator('[data-product-grid]').evaluate(element => element.getBoundingClientRect().top);
    assert(gridTopAfterFilter >= panelBottom, 'filter panel covers product cards');
    assert(gridTopAfterFilter > gridTopBeforeFilter, 'filter panel must move product cards below it');
    await page.screenshot({ path: path.join(artifactDirectory, 'filterInline1440.png') });
    const accessibility = await new AxeBuilder({ page }).include('#product-filter-panel').analyze();
    assert.deepEqual(accessibility.violations.map(item => item.id), []);
    await sidebar.getByRole('button', { name: /DÂY ĐIỆN/ }).click();
    await page.waitForURL(/categories=day-dien/);
    await page.locator('[data-product-grid]').waitFor();
    await page.locator('[aria-busy="false"]').last().waitFor();
    assert.equal(await sidebar.count(), 1, 'filter panel closed after selecting a child category');
    assert.equal(await sidebar.getByRole('button', { name: /DÂY ĐIỆN/ }).getAttribute('aria-pressed'), 'true');
    await sidebar.getByRole('button', { name: /CADIVI/ }).click();
    await page.waitForURL(/brands=cadivi/);
    await page.locator('[aria-busy="false"]').last().waitFor();
    assert.equal(await sidebar.count(), 1, 'filter panel closed after selecting a second criterion');
    assert.equal(await sidebar.getByRole('button', { name: /CADIVI/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await sidebar.getByRole('button', { name: /CADIVI/ }).isDisabled(), false, 'filter option remains disabled after loading');
    assert.equal(await page.getByRole('button', { name: /^Lọc/ }).locator('span').last().innerText(), '2');
    await page.screenshot({ path: path.join(artifactDirectory, 'filterSelected1440.png') });
    await sidebar.getByRole('button', { name: 'Xóa lọc' }).click();
    await page.waitForURL(url => url.searchParams.get('parent') === 'day-dan' && !url.searchParams.has('categories') && !url.searchParams.has('brands'));
    assert.equal(await sidebar.count(), 1, 'clearing facets closed the panel');
    assert.equal(await page.locator('h1').first().innerText(), 'DÂY DẪN');
    assert.equal(await sidebar.getByRole('button', { name: 'Xóa lọc' }).count(), 0, 'clear action appears without selected facets');
    await nav.getByRole('button', { name: 'ỐNG - PHỤ KIỆN PVC' }).click();
    await page.waitForURL(/parent=ong-phu-kien-pvc/);
    assert.equal(new URL(page.url()).searchParams.has('categories'), false);
    await nav.getByRole('button', { name: 'Tất cả' }).click();
    await page.waitForURL(url => !url.searchParams.has('parent'));
    await page.getByRole('button', { name: 'Lọc', exact: true }).click();
    await page.locator('#product-filter-panel').getByRole('heading', { name: 'Thương hiệu' }).waitFor();
    await page.locator('#product-filter-panel').getByRole('button', { name: /CADIVI/ }).click();
    await page.waitForURL(/brands=cadivi/);
    await page.locator('[aria-busy="false"]').last().waitFor();
    assert.equal(await page.locator('#product-filter-panel').count(), 1);
    await page.locator('#product-filter-panel').getByRole('button', { name: /DAPHACO/ }).click();
    await page.waitForURL(url => url.searchParams.get('brands') === 'cadivi,daphaco');
    await page.locator('[aria-busy="false"]').last().waitFor();
    assert.equal(await page.locator('#product-filter-panel').count(), 1, 'filter panel closed during multi-brand selection');
    assert.equal(await page.locator('#product-filter-panel').getByRole('button', { name: /CADIVI/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#product-filter-panel').getByRole('button', { name: /DAPHACO/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: /^Lọc/ }).locator('span').last().innerText(), '2');
    assert.equal(await page.locator('main input[type="search"]').count(), 1);
    await page.screenshot({ path: path.join(artifactDirectory, 'filterAllInline1440.png') });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#product-filter-panel').count(), 0);
    const appliedFilterButton = page.getByRole('button', { name: /^Lọc/ });
    assert.equal(await appliedFilterButton.locator('span').last().innerText(), '2', 'filter count disappeared after closing the panel');
    assert.match(await appliedFilterButton.getAttribute('class'), /border-primaryStrong/, 'applied filters are not highlighted');
    console.log('Desktop listing: direct categories without duplicates; inline child and brand filters do not cover products');
    await context.close();

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`${base}/san-pham/danh-sach?parent=day-dan`, { waitUntil: 'networkidle' });
    await mobilePage.getByRole('button', { name: 'Danh mục', exact: true }).click();
    const drawer = mobilePage.locator('#product-filter-panel');
    assert.equal(await drawer.getByRole('button', { name: 'ĐÈN LED' }).count(), 1);
    assert.equal(await mobilePage.getByRole('searchbox', { name: 'Tìm danh mục sản phẩm' }).count(), 0);
    assert(await drawer.evaluate(element => element.getBoundingClientRect().bottom) <=
      await mobilePage.locator('[data-product-grid]').evaluate(element => element.getBoundingClientRect().top),
    'mobile category panel covers product cards');
    await mobilePage.screenshot({ path: path.join(artifactDirectory, 'categoryMobile390.png') });
    await drawer.getByRole('button', { name: 'ĐÈN LED' }).click();
    await mobilePage.waitForURL(/parent=en-led/);
    assert.equal(await drawer.count(), 0);
    assert.equal(await mobilePage.locator('h1').first().innerText(), 'ĐÈN LED');
    await mobilePage.getByRole('button', { name: 'Lọc', exact: true }).click();
    await mobilePage.locator('#product-filter-panel').getByRole('heading', { name: 'Thương hiệu' }).waitFor();
    await mobilePage.screenshot({ path: path.join(artifactDirectory, 'filterMobileTop390.png') });
    assert.equal(await mobilePage.locator('#product-filter-panel').getByRole('heading', { name: /Nhóm con của/ }).count(), 1, 'child categories missing from filter');
    await mobilePage.locator('#product-filter-panel').getByRole('button', { name: /MPE/ }).click();
    await mobilePage.waitForURL(/brands=mpe/);
    await mobilePage.locator('[aria-busy="false"]').last().waitFor();
    assert.equal(await mobilePage.locator('#product-filter-panel').count(), 1, 'mobile filter panel closed after selecting a brand');
    assert.equal(await mobilePage.locator('#product-filter-panel').getByRole('button', { name: /MPE/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await mobilePage.locator('#product-filter-panel').getByRole('button', { name: /MPE/ }).isDisabled(), false);
    assert.equal(await mobilePage.getByRole('button', { name: /^Lọc/ }).locator('span').last().innerText(), '1');
    assert(await mobilePage.locator('#product-filter-panel').evaluate(element => element.getBoundingClientRect().bottom) <=
      await mobilePage.locator('[data-product-grid]').evaluate(element => element.getBoundingClientRect().top),
    'mobile filter covers product cards');
    await mobilePage.screenshot({ path: path.join(artifactDirectory, 'filterMobile390.png') });
    assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await mobilePage.locator('#product-filter-panel').getByRole('button', { name: /^Đóng bảng lọc, xem/ }).click();
    assert.equal(await mobilePage.locator('#product-filter-panel').count(), 0);
    assert.equal(await mobilePage.getByRole('button', { name: /^Lọc/ }).locator('span').last().innerText(), '1');
    console.log('Mobile inline category panel: all root categories remain available and switching closes the panel');
    await mobileContext.close();

    const narrowContext = await browser.newContext({ viewport: { width: 320, height: 844 } });
    const narrowPage = await narrowContext.newPage();
    await narrowPage.goto(`${base}/san-pham/danh-sach?parent=day-dan`, { waitUntil: 'networkidle' });
    await narrowPage.getByRole('button', { name: 'Lọc', exact: true }).click();
    await narrowPage.locator('#product-filter-panel').getByRole('button', { name: /CADIVI/ }).click();
    await narrowPage.waitForURL(/brands=cadivi/);
    await narrowPage.locator('[aria-busy="false"]').last().waitFor();
    assert.equal(await narrowPage.locator('#product-filter-panel').count(), 1);
    assert.equal(await narrowPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, '320px filter overflows horizontally');
    await narrowPage.screenshot({ path: path.join(artifactDirectory, 'filterMobile320.png') });
    console.log('320px: selected filter remains open without horizontal overflow');
    await narrowContext.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
