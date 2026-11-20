import { expect, test } from '@playwright/test';

const frontend = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

test('brand directory shows the brands without repeated instructions', async ({ page }) => {
  await page.goto(`${frontend}/doi-tac-thuong-hieu`);

  await expect(page.getByRole('heading', { name: /\d+ thương hiệu$/ })).toBeVisible();
  await expect(page.locator('[data-brand-card="true"]')).not.toHaveCount(0);
  await expect(page.locator('div[data-brand-card="true"]').first()).toBeVisible();
  await expect(page.locator('div[data-brand-card="true"]').first().locator('a, [aria-hidden="true"]')).toHaveCount(0);
  await expect(page.getByText('Chọn thương hiệu có hồ sơ để xem thông tin và sản phẩm tại Song Thanh.')).toHaveCount(0);
  await expect(page.getByText('Cho Song Thanh biết sản phẩm hoặc tài liệu bạn đang tìm.')).toHaveCount(0);
});

test('brand directory does not repeat card logos in its hero or spoken names', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontend}/doi-tac-thuong-hieu`);

  const hero = page.locator('[data-brand-hero="true"]');
  await expect(hero).toBeVisible();
  await expect(hero.locator('img')).toHaveCount(0);
  const firstLogo = page.locator('[data-brand-card="true"] img').first();
  await expect(firstLogo).toHaveAttribute('alt', '');
});

test('public typography uses the shared Vietnamese body face and an editorial display face', async ({ page }) => {
  await page.goto(`${frontend}/doi-tac-thuong-hieu`);
  await expect(page.locator('main h1')).toBeVisible();
  const bodyFamily = await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily);
  const titleFamily = await page.locator('main h1').evaluate((element) => getComputedStyle(element).fontFamily);
  expect(bodyFamily).toContain('Be Vietnam Pro');
  expect(titleFamily).toContain('Archivo');
});

test('project directory keeps editorial content without redundant labels', async ({ page }) => {
  await page.goto(`${frontend}/du-an`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('a[href^="/du-an/"]').first()).toBeVisible();
  await expect(page.getByText(/Mỗi công trình đều có một yêu cầu riêng/)).toBeVisible();
  await expect(page.getByText(/^Đang hiển thị \d+ hồ sơ dự án công khai\.$/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Nội dung dự án' })).toHaveCount(0);
  await expect(page.getByText('Gửi bối cảnh và yêu cầu kỹ thuật để Song Thanh xem xét hướng hỗ trợ phù hợp.')).toHaveCount(0);
});

test('brand and project directories fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/doi-tac-thuong-hieu', '/du-an']) {
    await page.goto(`${frontend}${route}`);
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
});

test('news index and article keep contact actions without generic helper copy', async ({ page }) => {
  await page.goto(`${frontend}/tin-tuc`);
  await expect(page.locator('[data-news-feed="true"]')).toBeVisible();
  await expect(page.getByText('Để lại thông tin công trình hoặc thiết bị cần trao đổi, Song Thanh sẽ tiếp nhận và phản hồi.')).toHaveCount(0);

  const articleHref = await page.locator('a[href^="/tin-tuc/"]').first().getAttribute('href');
  expect(articleHref).toBeTruthy();
  await page.goto(`${frontend}${articleHref}`);
  await expect(page.locator('main h1')).toHaveCount(1);
  await expect(page.getByText('Cần hỏi thêm về nội dung bài viết hoặc thiết bị phù hợp? Để lại thông tin để Song Thanh tiếp nhận và phản hồi.')).toHaveCount(0);
});

test('published news page title matches the public API on desktop and mobile', async ({ page, request }, testInfo) => {
  const response = await request.get(`${api}/public/page-contents/tin-tuc`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const title = payload.data.page_content.title;

  await page.goto(`${frontend}/tin-tuc`);
  await expect(page.locator('main h1')).toHaveText(title);
  await expect(page.locator('[data-news-feed="true"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('newsDesktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('main h1')).toHaveText(title);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('newsMobile.png'), fullPage: true });
});

test('news article balances its image, reading column and table of contents', async ({ page }, testInfo) => {
  const articleUrl = `${frontend}/tin-tuc/phan-biet-mcb-mccb-acb-rccb-rcbo-trong-he-thong-dien-ha-the`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(articleUrl);

  const title = page.getByRole('heading', { level: 1 });
  const media = page.locator('[data-news-article-media]');
  const copy = page.locator('[data-news-article-copy]');
  const toc = page.getByRole('navigation', { name: 'Mục lục bài viết' });
  await expect(media).toBeVisible();
  await expect(copy).toBeVisible();
  await expect(toc).toBeVisible();

  const titleBox = await title.boundingBox();
  const mediaBox = await media.boundingBox();
  const copyBox = await copy.boundingBox();
  const tocBox = await toc.boundingBox();
  expect(titleBox && mediaBox && copyBox && tocBox).toBeTruthy();
  expect(mediaBox!.x).toBeGreaterThan(titleBox!.x + titleBox!.width);
  expect(Math.abs(mediaBox!.y - titleBox!.y)).toBeLessThan(180);
  expect(tocBox!.x).toBeGreaterThan(copyBox!.x + copyBox!.width);
  await page.screenshot({ path: testInfo.outputPath('newsArticleDesktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(media).toBeVisible();
  await expect(toc).toBeVisible();
  const mobileTitle = await title.boundingBox();
  const mobileMedia = await media.boundingBox();
  const mobileToc = await toc.boundingBox();
  const mobileCopy = await copy.boundingBox();
  expect(mobileMedia!.y).toBeGreaterThan(mobileTitle!.y + mobileTitle!.height);
  expect(mobileToc!.y).toBeLessThan(mobileCopy!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('newsArticleMobile.png'), fullPage: true });
});

test('news article without a featured image remains readable and its contents link works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${frontend}/tin-tuc/xu-huong-tu-dong-hoa-nha-may-2026`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('[data-news-article-media]')).toHaveCount(0);
  const toc = page.getByRole('navigation', { name: 'Mục lục bài viết' });
  await expect(toc).toBeVisible();
  await expect(page.locator('[data-news-article-copy]')).toBeVisible();

  const firstLink = toc.getByRole('link').first();
  const headingId = (await firstLink.getAttribute('href'))?.slice(1);
  expect(headingId).toBeTruthy();
  await firstLink.click();
  await expect(page).toHaveURL(new RegExp(`#${headingId}$`));
  await expect(page.locator(`[id="${headingId}"]`)).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('contact form introduces the action once', async ({ page }) => {
  await page.goto(`${frontend}/lien-he`);

  await expect(page.getByRole('heading', { name: 'Gửi yêu cầu' })).toBeVisible();
  await expect(page.getByText('Biểu mẫu trực tuyến', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Để lại thông tin và nội dung cần trao đổi, Song Thanh sẽ tiếp nhận yêu cầu của bạn.')).toHaveCount(0);
  await expect(page.getByText('Chọn kênh phù hợp với nhu cầu của bạn.')).toHaveCount(0);
});
