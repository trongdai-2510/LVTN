import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const frontend = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

test('brand page treats featured image as sharing media, not a visible banner', async ({ page, request }) => {
  const response = await request.get(`${api}/public/page-contents/doi-tac-thuong-hieu`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const imageId = data.data.page_content.featured_image_file_id as string | null;
  expect(imageId).toBeTruthy();

  await page.goto(`${frontend}/doi-tac-thuong-hieu`);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator(`main img[src*="${imageId}"]`)).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText('Nội dung đang cập nhật');
  await expect(page.locator('main [data-brand-directory]')).toBeVisible();
  const firstBrandImage = page.locator('main [data-brand-card]').first().locator('img');
  if (await firstBrandImage.count()) await expect(firstBrandImage).toHaveAttribute('loading', 'eager');
});

test('news detail is an editorial article without a right sidebar or repeated call action', async ({ page, request }) => {
  const response = await request.get(`${api}/public/news`);
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const slug = data.data.items[0].slug as string;

  await page.goto(`${frontend}/tin-tuc/${slug}`);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('main aside')).toHaveCount(0);
  await expect(page.locator('main article')).toHaveCount(1);
  await expect(page.locator('main a[href^="tel:"]')).toHaveCount(0);
  await expect(page.locator('main a[href="/lien-he"]')).toHaveCount(0);
});

test('admin news draft preview uses the public article layout without invented media', async ({ page, request }) => {
  const list = await request.get(`${api}/public/news`);
  const listData = await list.json();
  const slug = listData.data.items[0].slug as string;
  const response = await request.get(`${api}/public/page-contents/${slug}`);
  const data = await response.json();
  const article = data.data.page_content;

  await page.goto(`${frontend}/admin-preview/page-content`);
  await page.waitForLoadState('networkidle');
  await page.evaluate((payload) => {
    window.postMessage({ type: 'song-thanh:page-content-preview', payload }, window.location.origin);
  }, { ...article, content_type: 'news', preview_mode: 'news' });

  const preview = page.locator('main [data-page-archetype="news-article"]');
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText(article.title);
  await expect(preview.locator('aside')).toHaveCount(0);
  if (!article.featured_image_file_id) await expect(preview.locator('img')).toHaveCount(0);
  await expect(preview.getByRole('navigation', { name: 'Mục lục bài viết' })).toBeVisible();
});

test('project and service previews do not expose unfinished editorial placeholder text', async ({ page, request }) => {
  for (const [slug, mode] of [['du-an', 'projects'], ['dich-vu', 'services']] as const) {
    const response = await request.get(`${api}/public/page-contents/${slug}`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    const draft = data.data.page_content;

    await page.goto(`${frontend}/admin-preview/page-content`);
    await page.waitForLoadState('networkidle');
    await page.evaluate((payload) => {
      window.postMessage({ type: 'song-thanh:page-content-preview', payload }, window.location.origin);
    }, {
      ...draft,
      preview_mode: mode,
      content_html: '<p>Nội dung đang cập nhật. Nội dung intro sẽ hoàn thiện sau.</p>'
    });

    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Nội dung intro sẽ hoàn thiện sau');
  }
});

test('news index keeps categories and search beside the feed without a duplicate sidebar', async ({ page }) => {
  await page.goto(`${frontend}/tin-tuc`);
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('main aside')).toHaveCount(0);
  await expect(page.locator('main input[type="search"]')).toHaveCount(1);
  await expect(page.locator('main [data-news-feed] a[href^="/tin-tuc/"]').first()).toBeVisible();

  const category = page.getByRole('navigation', { name: 'Chuyên mục tin tức' }).locator('a[href*="category="]').first();
  const categoryHref = await category.getAttribute('href');
  expect(categoryHref).toBeTruthy();
  await category.click();
  await expect(page).toHaveURL(new RegExp(`^${frontend}${categoryHref?.replace('?', '\\?')}$`));
  await expect(page.getByRole('navigation', { name: 'Chuyên mục tin tức' }).locator('[aria-current="page"]')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Chuyên mục tin tức' }).locator('[aria-current="page"]')).toHaveCount(1);

  await page.locator('#news-search').fill('MCB');
  await page.getByRole('search', { name: 'Tìm bài viết' }).getByRole('button').click();
  await expect(page).toHaveURL(/\/tin-tuc\?q=MCB$/);
  await expect(page.locator('main')).toContainText('MCB');
  await page.getByRole('navigation', { name: 'Chuyên mục tin tức' }).locator(`a[href="${categoryHref}"]`).click();
  await expect(page).toHaveURL(new RegExp(`^${frontend}${categoryHref?.replace('?', '\\?')}$`));
  await expect(page.locator('#news-search')).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(/\/tin-tuc\?q=MCB$/);
  await expect(page.locator('#news-search')).toHaveValue('MCB');
});

test('brand directory and news article remain usable across phone, desktop and wide screens', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const response = await request.get(`${api}/public/news`);
  const data = await response.json();
  const routes = ['/doi-tac-thuong-hieu', '/tin-tuc', `/tin-tuc/${data.data.items[0].slug}`];
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  for (const route of routes) {
    for (const width of [390, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      errors.length = 0;
      consoleErrors.length = 0;
      const navigation = await page.goto(`${frontend}${route}`);
      expect(navigation?.status()).toBe(200);
      await expect(page.locator('main h1')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
      const pageName = route === '/tin-tuc' ? 'newsindex' : route.includes('tin-tuc') ? 'newsdetail' : 'brands';
      await page.screenshot({ path: testInfo.outputPath(`${pageName}${width}.png`), fullPage: true, caret: 'initial' });
      if (width !== 2560) {
        const accessibility = await new AxeBuilder({ page }).analyze();
        const violationDetails = accessibility.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary }))
        }));
        expect(
          accessibility.violations.map((violation) => violation.id),
          `${route} at ${width}px: ${JSON.stringify(violationDetails)}`
        ).toEqual([]);
      }
      expect(consoleErrors, `${route} at ${width}px`).toEqual([]);
    }
  }
});

test('project and service listings and details stay legible across phone, desktop and wide screens', async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const [projectsResponse, servicesResponse] = await Promise.all([
    request.get(`${api}/public/projects`),
    request.get(`${api}/public/services`)
  ]);
  expect(projectsResponse.ok()).toBeTruthy();
  expect(servicesResponse.ok()).toBeTruthy();
  const projects = await projectsResponse.json();
  const services = await servicesResponse.json();
  const projectSlug = projects.data.items[0].slug as string;
  const serviceSlug = services.data.items[0].slug as string;
  const routes = [
    ['/du-an', 'projects'],
    [`/du-an/${projectSlug}`, 'projectdetail'],
    ['/dich-vu', 'services'],
    [`/dich-vu/${serviceSlug}`, 'servicedetail']
  ] as const;
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  for (const [route, name] of routes) {
    for (const width of [390, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      errors.length = 0;
      consoleErrors.length = 0;
      const response = await page.goto(`${frontend}${route}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator('main h1').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
        .toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
      await expect(page.locator('main')).not.toContainText('Nội dung đang cập nhật');
      await page.screenshot({ path: testInfo.outputPath(`${name}${width}.png`), fullPage: true, caret: 'initial' });
      if (width !== 2560) {
        const accessibility = await new AxeBuilder({ page }).analyze();
        const violationDetails = accessibility.violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary }))
        }));
        expect(
          accessibility.violations.map((violation) => violation.id),
          `${route} at ${width}px: ${JSON.stringify(violationDetails)}`
        ).toEqual([]);
      }
      expect(consoleErrors, `${route} at ${width}px`).toEqual([]);
    }
  }
});

test('project case study places its story heading above the reading column', async ({ page, request }) => {
  const response = await request.get(`${api}/public/projects`);
  const data = await response.json();
  const slug = data.data.items[0].slug as string;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${frontend}/du-an/${slug}`);

  const section = page.locator('[data-project-story-layout="reading"]');
  await expect(section).toBeVisible();
  const heading = await section.locator('header').boundingBox();
  const article = await section.locator('article').boundingBox();
  expect(heading).toBeTruthy();
  expect(article).toBeTruthy();
  expect(heading!.y + heading!.height).toBeLessThanOrEqual(article!.y);
  expect(article!.width).toBeGreaterThan(950);
});

test('project detail does not surface runtime console errors', async ({ page, request }) => {
  const response = await request.get(`${api}/public/projects`);
  const data = await response.json();
  const slug = data.data.items[0].slug as string;
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto(`${frontend}/du-an/${slug}`);
  await page.waitForLoadState('networkidle');
  expect(consoleErrors).toEqual([]);
});

test('mobile product filters disclose inline and return focus on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${frontend}/san-pham/danh-sach`);
  const opener = page.getByRole('button', { name: 'Lọc', exact: true });
  const panel = page.locator('#product-filter-panel');
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await expect(panel).toHaveCount(0);

  await opener.click();
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Bộ lọc' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await expect(opener).toBeFocused();
});

test('product, brand detail and static content routes do not break on phone or wide desktop', async ({ page, request }) => {
  test.setTimeout(150_000);
  const [productsResponse, brandsResponse] = await Promise.all([
    request.get(`${api}/public/product-groups?page=1&page_size=1`),
    request.get(`${api}/public/brands`)
  ]);
  expect(productsResponse.ok()).toBeTruthy();
  expect(brandsResponse.ok()).toBeTruthy();
  const products = await productsResponse.json();
  const brands = await brandsResponse.json();
  const productSlug = products.data.items[0].slug as string;
  const brandSlug = brands.data.items.find((item: { has_detail_page: boolean }) => item.has_detail_page)?.slug as string;
  expect(brandSlug).toBeTruthy();
  const aboutStatus = (await request.get(`${api}/public/page-contents/gioi-thieu`)).status();
  expect([200, 404]).toContain(aboutStatus);
  const routes = [
    '/san-pham',
    '/san-pham/danh-sach',
    `/san-pham/${productSlug}`,
    `/doi-tac-thuong-hieu/${brandSlug}`,
    '/gioi-thieu',
    '/ho-so-nang-luc',
    '/lien-he'
  ];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  for (const route of routes) {
    for (const width of [320, 390, 2560, 3840]) {
      pageErrors.length = 0;
      consoleErrors.length = 0;
      await page.setViewportSize({ width, height: 900 });
      const response = await page.goto(`${frontend}${route}`, { waitUntil: 'domcontentloaded' });
      const expectedStatus = route === '/gioi-thieu' ? aboutStatus : 200;
      expect(response?.status(), `${route} at ${width}px`).toBe(expectedStatus);
      if (expectedStatus === 404) {
        await expect(page.getByText('Trang này hiện không khả dụng')).toBeVisible();
        continue;
      }
      await expect(page.locator('main h1').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${route} at ${width}px`)
        .toBeLessThanOrEqual(1);
      expect(pageErrors, `${route} at ${width}px`).toEqual([]);
      if (width <= 390) {
        const accessibility = await new AxeBuilder({ page }).analyze();
        const details = accessibility.violations.map((violation) => ({
          id: violation.id,
          targets: violation.nodes.map((node) => ({ target: node.target, html: node.html, reason: node.failureSummary }))
        }));
        expect(details, `${route} at ${width}px`).toEqual([]);
      }
      expect(consoleErrors, `${route} at ${width}px`).toEqual([]);
    }
  }
});
