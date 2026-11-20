const assert = require('node:assert/strict');
const { chromium } = require('../../admin/node_modules/playwright');
const AxeBuilder = require('../../admin/node_modules/@axe-core/playwright').default;

const base = process.env.WEB_BASE_URL || 'http://localhost:3000';
const phrase = 'Bộ hẹn giờ analog';

async function openSearch(page) {
  await page.goto(base, { waitUntil: 'networkidle' });
  return page.locator('input[aria-label="Tìm kiếm sản phẩm"]:visible');
}

async function waitForResults(page) {
  const panel = page.locator('[data-product-search-suggestions]:visible');
  await panel.locator('[data-product-search-option]').first().waitFor();
  await panel.getByText('Đang tìm kiếm gợi ý...').waitFor({ state: 'hidden' });
  return panel;
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const checks = [];
  try {
    for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const input = await openSearch(page);
      await input.fill(phrase);
      const panel = await waitForResults(page);
      assert.equal(await panel.locator('[data-product-search-option]').count(), 1);
      assert.match(await panel.innerText(), /Mã CCT15101/);
      const box = await panel.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width + 1, `panel outside ${width}px viewport`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const accessibility = await new AxeBuilder({ page }).include('[data-product-search-suggestions]').analyze();
      assert.deepEqual(accessibility.violations.map(item => item.id), []);

      await input.focus();
      await input.press('ArrowDown');
      assert.equal(await panel.locator('[data-product-search-option]').first().evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('ArrowDown');
      assert.equal(await panel.getByRole('button', { name: /Xem tất cả kết quả/ }).evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('ArrowUp');
      assert.equal(await panel.locator('[data-product-search-option]').first().evaluate(el => el === document.activeElement), true);
      await page.keyboard.press('Escape');
      await panel.waitFor({ state: 'hidden' });
      assert.equal(await input.evaluate(el => el === document.activeElement), true);

      await input.fill(`${phrase} `);
      await waitForResults(page);
      await panel.locator('[data-product-search-option]').first().click();
      await page.waitForURL(/\/san-pham\/bo-hen-gio-analog-1-kenh-16a-pin-du-tru-24h-pin-tu-sac/);
      assert.equal(new URL(page.url()).searchParams.has('variant'), false);
      assert.deepEqual(errors, []);
      checks.push(`${width}px: one merged suggestion; layout, keyboard, escape and product navigation pass`);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    let input = await openSearch(page);
    await input.fill('CCT15101');
    await waitForResults(page);
    await input.press('Enter');
    await page.waitForURL(/variant=CCT15101/);
    assert.equal(new URL(page.url()).searchParams.get('variant'), 'CCT15101');
    checks.push('Exact model Enter opens the selected variant');

    input = await openSearch(page);
    await input.fill(phrase);
    let panel = await waitForResults(page);
    await panel.getByRole('button', { name: /Xem tất cả kết quả/ }).click();
    await page.waitForURL(/\/tim-kiem\?q=/);
    assert.equal(new URL(page.url()).searchParams.get('q'), phrase);
    checks.push('View all keeps the query on the full search page');

    input = await openSearch(page);
    await input.fill('ống');
    panel = await waitForResults(page);
    const count = await panel.locator('[data-product-search-option]').count();
    assert(count >= 1 && count <= 3, `unexpected broad query result count: ${count}`);
    assert.equal(await panel.getByRole('button', { name: /Xem tất cả kết quả/ }).count(), 1);
    assert.equal(await panel.evaluate(el => el.scrollHeight <= el.clientHeight + 1), true);
    checks.push(`Broad query offers ${count} suggestions and a full-result route`);

    await input.fill('zzzzzzzzzznomatch');
    await panel.getByText('Không tìm thấy kết quả phù hợp.').waitFor();
    assert.equal(await panel.locator('[data-product-search-option]').count(), 0);
    checks.push('No-result query has a clear empty state');

    await input.fill(phrase);
    await waitForResults(page);
    await input.fill('CCT15101');
    assert.match(await panel.innerText(), /Đang tìm kiếm gợi ý/);
    assert.doesNotMatch(await panel.innerText(), /Bộ hẹn giờ analog/);
    await waitForResults(page);
    checks.push('Changing the query clears stale suggestions immediately');

    await page.goto(`${base}/san-pham/danh-sach`, { waitUntil: 'networkidle' });
    const listingInput = page.getByPlaceholder('Tìm tên, model hoặc hãng');
    await listingInput.fill(phrase);
    panel = await waitForResults(page);
    assert.equal(await panel.locator('[data-product-search-option]').count(), 1);
    await panel.getByRole('button', { name: /Xem tất cả kết quả/ }).click();
    await page.waitForURL(/\/san-pham\/danh-sach\?q=/);
    assert.equal(new URL(page.url()).searchParams.get('q'), phrase);
    checks.push('Shared product-list search panel keeps its own listing destination');

    await context.close();
    console.log(checks.join('\n'));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
