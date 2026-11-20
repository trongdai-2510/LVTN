const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../admin/node_modules/playwright');
const AxeBuilder = require('../../admin/node_modules/@axe-core/playwright').default;

const base = process.env.WEB_BASE_URL || 'http://localhost:3000';
const artifacts = path.resolve(__dirname, '../../frontend/tmp/qa-artifacts/productListing');

async function inspect(page) {
  return page.evaluate(() => {
    const heading = document.querySelector('[data-product-listing-heading]');
    const grid = document.querySelector('[data-product-grid]');
    return {
      scrollY,
      headingBottom: heading?.getBoundingClientRect().bottom,
      gridTop: grid?.getBoundingClientRect().top,
      cards: document.querySelectorAll('[data-catalog-card]').length,
      bodyWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth
    };
  });
}

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [320, 390, 768, 1024, 1280, 1360, 1440, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.__layoutShifts = [];
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) window.__layoutShifts.push(entry.value);
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`${base}/san-pham/danh-sach?parent=day-dan`, { waitUntil: 'networkidle' });
      if (width < 1360) {
        assert(await page.getByRole('button', { name: 'Mở menu' }).isVisible(), `${width}: desktop header overlaps at this width`);
      } else {
        const headerClear = await page.evaluate(() => {
          const header = document.querySelector('header');
          const logo = header?.querySelector('a[aria-label*="Trang chủ"]');
          const nav = header?.querySelector('nav');
          const search = header?.querySelector('form');
          if (!logo || !nav || !search) return false;
          return logo.getBoundingClientRect().right + 8 <= nav.getBoundingClientRect().left &&
            nav.getBoundingClientRect().right + 8 <= search.getBoundingClientRect().left;
        });
        assert(headerClear, `${width}: header logo, navigation or search overlaps`);
      }
      if (width === 1440) {
        const searchBox = await page.locator('main input[type="search"]').boundingBox();
        const filterBox = await page.getByRole('button', { name: 'Lọc', exact: true }).boundingBox();
        const sortBox = await page.getByRole('button', { name: 'Sắp xếp: Mới nhất' }).boundingBox();
        assert(searchBox && filterBox && sortBox, 'catalogue toolbar controls missing');
        assert(searchBox.width > 700, 'search field leaves an excessive empty gap');
        assert(filterBox.x - searchBox.x - searchBox.width < 24, 'filter button is visually disconnected from search');
        assert(Math.abs(searchBox.height - filterBox.height) <= 1 && Math.abs(searchBox.height - sortBox.height) <= 1, 'toolbar control heights are inconsistent');
      }
      await page.screenshot({ path: path.join(artifacts, `listing${width}.png`), fullPage: false });
      const before = await inspect(page);
      const switchStart = Date.now();
      if (width >= 1024) {
        await page.getByRole('navigation', { name: 'Duyệt nhóm sản phẩm' }).getByRole('button', { name: 'ĐÈN LED' }).click();
      } else {
        await page.getByRole('button', { name: 'Danh mục', exact: true }).click();
        await page.locator('#product-filter-panel').getByRole('button', { name: 'ĐÈN LED' }).click();
      }
      await page.waitForURL(/parent=en-led/);
      await page.getByRole('heading', { level: 1, name: 'ĐÈN LED' }).waitFor();
      const elapsed = Date.now() - switchStart;
      const after = await inspect(page);
      const cls = await page.evaluate(() => window.__layoutShifts.reduce((sum, value) => sum + value, 0));
      await page.screenshot({ path: path.join(artifacts, `listingSwitched${width}.png`), fullPage: false });
      assert(after.cards > 0, `${width}: no product cards`);
      assert(after.bodyWidth <= after.viewportWidth + 1, `${width}: horizontal overflow`);
      assert(after.gridTop < (width === 390 ? 500 : width === 768 ? 480 : 510), `${width}: excessive header and filter height`);
      assert.deepEqual(errors, [], `${width}: browser errors`);
      const accessibility = await new AxeBuilder({ page }).include('main').analyze();
      assert.deepEqual(accessibility.violations.map(item => item.id), [], `${width}: accessibility violations`);
      console.log(JSON.stringify({ width, before, after, switchMs: elapsed, cls, errors }));

      if (width === 1440) {
        const sort = page.getByRole('button', { name: 'Sắp xếp: Mới nhất' });
        await sort.click();
        await page.getByRole('button', { name: 'Tên A → Z' }).click();
        await page.waitForURL(/sort=name_asc/);
        await page.locator('[data-product-card-secondary-action]').first().click();
        await page.getByRole('dialog', { name: 'Danh sách yêu cầu' }).waitFor();
        await page.keyboard.press('Escape');
        await page.locator('input[name="q"]').fill('led');
        await page.locator('input[name="q"]').press('Enter');
        await page.waitForURL(/q=led/);
        assert(await page.locator('[data-product-card]').count() > 0, 'search results missing');
        await page.goBack();
        await page.waitForURL(/sort=name_asc/);
        console.log('Desktop sorting and quote action pass');
      }
      await context.close();
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/san-pham`, { waitUntil: 'networkidle' });
    const categoryLink = page.locator('#category-title-en-led a');
    await categoryLink.scrollIntoViewIfNeeded();
    const startScrollY = await page.evaluate(() => scrollY);
    const start = Date.now();
    await categoryLink.click();
    await page.waitForURL(/\/san-pham\/danh-sach\?parent=en-led/);
    await page.getByRole('heading', { level: 1, name: 'ĐÈN LED' }).waitFor();
    const navigation = { fromScrollY: startScrollY, to: await inspect(page), elapsedMs: Date.now() - start };
    assert(navigation.to.scrollY < 120, 'landing transition should open listing at top');
    await page.screenshot({ path: path.join(artifacts, 'fromLanding1440.png') });
    console.log(JSON.stringify({ navigation }));
    await page.close();

    const slowContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const slowPage = await slowContext.newPage();
    await slowPage.goto(`${base}/san-pham/danh-sach?parent=day-dan`, { waitUntil: 'networkidle' });
    const stableGridTop = (await inspect(slowPage)).gridTop;
    let delayedRequestCount = 0;
    await slowPage.route(/\/public\/product-groups\?/, async route => {
      delayedRequestCount += 1;
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.continue();
    });
    await slowPage.getByRole('navigation', { name: 'Duyệt nhóm sản phẩm' }).getByRole('button', { name: 'ĐÈN LED' }).click();
    await slowPage.waitForTimeout(550);
    assert(delayedRequestCount > 0, 'slow-network route did not intercept product request');
    assert.equal(await slowPage.getByRole('status', { name: 'Đang cập nhật sản phẩm' }).count(), 1, 'delayed feedback is missing');
    assert.equal((await inspect(slowPage)).gridTop, stableGridTop, 'slow request shifted list');
    assert.equal(await slowPage.getByRole('button', { name: 'Lọc', exact: true }).count(), 1, 'filter control was replaced during loading');
    assert.equal(await slowPage.locator('[data-product-grid]').evaluate(element => getComputedStyle(element.parentElement).opacity), '1', 'products were dimmed during loading');
    await slowPage.screenshot({ path: path.join(artifacts, 'slowFilter1440.png') });
    await slowPage.waitForURL(/parent=en-led/);
    console.log('Slow network: filter control, card opacity and list position remain stable');
    await slowContext.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
