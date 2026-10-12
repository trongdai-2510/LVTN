const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../../admin/node_modules/playwright');

const webBase = process.env.WEB_BASE_URL || 'http://localhost:3000';
const apiBase = process.env.API_BASE_URL || 'http://localhost:4000';
const listingPath = '/san-pham/danh-sach';
const screenshotQuery = 'brands=anfaco%2Ccadivi&sort=popular';
const artifactDir = path.resolve(__dirname, '../../frontend/tmp/qa-artifacts/productPagination');

async function apiPage(query, page, pageSize = 12) {
  const params = new URLSearchParams(query);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));
  const response = await fetch(`${apiBase}/public/product-groups?${params}`);
  assert.equal(response.status, 200, `API status for ${params}`);
  const body = await response.json();
  assert.equal(body.ok, true, `API result for ${params}`);
  return body.data;
}

async function inspect(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-catalog-card]')];
    const rows = new Map();
    for (const card of cards) {
      const top = Math.round(card.getBoundingClientRect().top + scrollY);
      rows.set(top, (rows.get(top) || 0) + 1);
    }
    return {
      count: cards.length,
      rows: [...rows.values()],
      hrefs: cards.map(card => card.querySelector('a[href^="/san-pham/"]')?.getAttribute('href')),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      emptyState: document.body.textContent.includes('Không tìm thấy sản phẩm phù hợp')
    };
  });
}

async function visit(page, query) {
  const response = await page.goto(`${webBase}${listingPath}${query ? `?${query}` : ''}`, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, `Page status for ${query}`);
  return inspect(page);
}

(async () => {
  fs.mkdirSync(artifactDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { viewportRows: [], canonicalUrls: [], pagination: {}, sorts: [], categories: [], edgeCases: [] };
  try {
    for (const [width, columns] of [[320, 1], [390, 1], [768, 2], [1440, 3], [1920, 4]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const layout = await visit(page, screenshotQuery);
      assert.equal(layout.count, 12, `${width}px should show 12 products on a full page`);
      assert.deepEqual(layout.rows, Array(12 / columns).fill(columns), `${width}px has an incomplete full-page row`);
      assert.equal(layout.overflow, false, `${width}px has horizontal overflow`);
      assert.equal(new Set(layout.hrefs).size, 12, `${width}px has duplicate products`);
      assert.deepEqual(errors, [], `${width}px has browser errors`);
      if (width === 1920) {
        await page.screenshot({ path: path.join(artifactDir, 'filtered1920.png'), fullPage: true });
      }
      report.viewportRows.push({ width, columns, rows: layout.rows });
      await page.close();
    }

    for (const [input, expectedSize, canonicalSize] of [
      ['page_size=10', 12, null],
      ['page_size=12', 12, null],
      ['page_size=20', 24, '24'],
      ['page_size=40', 36, '36'],
      ['page=1&page_size=1', 12, null]
    ]) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });
      const layout = await visit(page, input);
      const url = new URL(page.url());
      assert.equal(url.searchParams.get('page_size'), canonicalSize, `Canonical size for ${input}`);
      assert.equal(url.searchParams.get('page'), null, `Canonical page for ${input}`);
      assert.equal(layout.count, expectedSize, `Visible cards for ${input}`);
      assert(layout.rows.every(count => count === 4), `Full rows for ${input}`);
      report.canonicalUrls.push({ input, url: url.pathname + url.search, cards: layout.count });
      await page.close();
    }

    const page = await browser.newPage({ viewport: { width: 1920, height: 900 } });
    const first = await visit(page, screenshotQuery);
    await page.getByRole('navigation', { name: 'Phân trang sản phẩm' }).getByRole('button', { name: 'Trang sau' }).click();
    await page.waitForURL(/page=2/);
    await page.waitForFunction(() => document.querySelectorAll('[data-catalog-card]').length === 12);
    const second = await inspect(page);
    assert.deepEqual(second.rows, [4, 4, 4]);
    assert.equal(first.hrefs.filter(href => second.hrefs.includes(href)).length, 0, 'Page 1 and 2 overlap');
    await page.goBack({ waitUntil: 'networkidle' });
    await page.waitForFunction(
      firstHref => document.querySelector('[data-catalog-card] a[href^="/san-pham/"]')?.getAttribute('href') === firstHref,
      first.hrefs[0],
      { timeout: 10000 }
    );
    assert.deepEqual((await inspect(page)).hrefs, first.hrefs, 'Browser back did not restore page 1');
    await page.goForward({ waitUntil: 'networkidle' });
    await page.waitForFunction(
      secondHref => document.querySelector('[data-catalog-card] a[href^="/san-pham/"]')?.getAttribute('href') === secondHref,
      second.hrefs[0],
      { timeout: 10000 }
    );
    assert.deepEqual((await inspect(page)).hrefs, second.hrefs, 'Browser forward did not restore page 2');
    report.pagination = { first: first.count, second: second.count, overlap: 0, backRestored: true, forwardRestored: true };

    for (const sort of ['popular', 'newest', 'name_asc', 'name_desc']) {
      const query = `brands=anfaco%2Ccadivi&sort=${sort}`;
      const [apiFirst, apiSecond] = await Promise.all([apiPage(query, 1), apiPage(query, 2)]);
      assert.equal(apiFirst.items.length, 12, `${sort}: API page 1 size`);
      assert.equal(apiSecond.items.length, 12, `${sort}: API page 2 size`);
      assert.equal(new Set([...apiFirst.items, ...apiSecond.items].map(item => item.id)).size, 24, `${sort}: API pages overlap`);
      report.sorts.push({ sort, total: apiFirst.pagination.total, pageCount: apiFirst.pagination.page_count, firstTwoPagesUnique: true });
    }

    const categoryResponse = await fetch(`${apiBase}/public/product-categories`);
    assert.equal(categoryResponse.status, 200, 'Category API status');
    const categories = (await categoryResponse.json()).data.items.filter(item => !item.parent_id);
    for (const category of categories) {
      const apiCategory = await apiPage(`category_id=${category.id}`, 1);
      const browserCategory = await visit(page, `parent=${encodeURIComponent(category.slug)}`);
      assert.equal(browserCategory.count, apiCategory.items.length, `${category.slug}: browser/API card count differs`);
      if (apiCategory.pagination.total >= 12) {
        assert.deepEqual(browserCategory.rows, [4, 4, 4], `${category.slug}: full category page has gaps`);
      }
      report.categories.push({ slug: category.slug, total: apiCategory.pagination.total, cards: browserCategory.count });
    }

    const apiFirst = await apiPage(screenshotQuery, 1);
    const lastPage = apiFirst.pagination.page_count;
    const apiLast = await apiPage(screenshotQuery, lastPage);
    const last = await visit(page, `${screenshotQuery}&page=${lastPage}`);
    assert.equal(last.count, apiLast.items.length, 'Last page count differs from API');
    assert.equal(last.count, apiFirst.pagination.total - (lastPage - 1) * 12, 'Last page remainder is incorrect');
    assert.equal(last.overflow, false, 'Last page has horizontal overflow');
    report.edgeCases.push({ case: 'last-page', page: lastPage, cards: last.count, rows: last.rows });

    const beyond = await visit(page, `${screenshotQuery}&page=99999`);
    assert.equal(new URL(page.url()).searchParams.get('page'), String(lastPage), 'Out-of-range URL was not corrected');
    assert.deepEqual(beyond.hrefs, last.hrefs, 'Out-of-range URL shows different products');
    report.edgeCases.push({ case: 'out-of-range', redirectedTo: lastPage, cards: beyond.count });

    const empty = await visit(page, 'q=product-pagination-no-results-987654321');
    assert.equal(empty.count, 0, 'No-results query has product cards');
    assert.equal(empty.emptyState, true, 'No-results query lacks clear empty state');
    assert.equal(await page.getByRole('navigation', { name: 'Phân trang sản phẩm' }).count(), 0, 'No-results query has pagination');
    report.edgeCases.push({ case: 'no-results', cards: 0, emptyState: true });
    const emptyBeyond = await visit(page, 'q=product-pagination-no-results-987654321&page=99999');
    assert.equal(new URL(page.url()).searchParams.get('page'), null, 'No-results out-of-range page was not reset');
    assert.equal(emptyBeyond.count, 0);
    report.edgeCases.push({ case: 'no-results-out-of-range', redirectedTo: 1, cards: 0 });
    await page.close();

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
