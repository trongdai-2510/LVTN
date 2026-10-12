import { expect, test } from '@playwright/test';

const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(
  /\/$/,
  ''
);
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

const CONTENT_PAGES = [
  { path: '/gioi-thieu', proof: 'Giới thiệu' },
  { path: '/san-pham', proof: 'Danh mục sản phẩm' },
  { path: '/ho-so-nang-luc', proof: 'Tài liệu PDF' },
  { path: '/dich-vu', proof: 'Danh mục dịch vụ' },
  { path: '/du-an', proof: null },
  { path: '/doi-tac-thuong-hieu', proof: 'Thương hiệu sản phẩm' },
  { path: '/tin-tuc', proof: 'Góc thông tin kỹ thuật' },
  { path: '/lien-he', proof: 'Phiếu tiếp nhận' }
] as const;

for (const viewport of [
  { name: 'mobile', width: 320, height: 844 },
  { name: 'wide desktop', width: 1920, height: 1080 }
] as const) {
  test(`published content pages remain usable and hidden pages stay unavailable on ${viewport.name}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const browserIssues: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (message.type() === 'error' || text.includes('Largest Contentful Paint')) {
        browserIssues.push(`${message.type()}: ${text}`);
      }
    });
    page.on('pageerror', (error) => browserIssues.push(`pageerror: ${error.message}`));

    for (const contentPage of CONTENT_PAGES) {
      const issueOffset = browserIssues.length;
      const apiResponse = await request.get(`${API_BASE_URL}/public/page-contents${contentPage.path}`);
      expect([200, 404]).toContain(apiResponse.status());
      const response = await page.goto(`${FRONTEND_BASE_URL}${contentPage.path}`);
      if (apiResponse.status() === 404) {
        expect(response?.status(), `${contentPage.path} should stay unavailable`).toBe(404);
        await expect(page.getByText('Trang này hiện không khả dụng')).toBeVisible();
        continue;
      }
      expect(response?.ok(), `${contentPage.path} returned ${response?.status()}`).toBe(true);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('h1').first()).toBeVisible();
      if (contentPage.proof) {
        await expect(
          page.locator('main').getByText(contentPage.proof, { exact: false }).first()
        ).toBeVisible();
      }
      const overflow = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('body *'))
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.right <= window.innerWidth + 1 && rect.left >= -1) return false;
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
              const overflowX = window.getComputedStyle(parent).overflowX;
              if (['auto', 'clip', 'hidden', 'scroll'].includes(overflowX)) return false;
              parent = parent.parentElement;
            }
            return true;
          })
          .slice(0, 12)
          .map((element) => ({
            className: element.className,
            left: Math.round(element.getBoundingClientRect().left),
            right: Math.round(element.getBoundingClientRect().right),
            tag: element.tagName,
            text: (element.textContent || '').trim().slice(0, 80)
          }))
      );
      expect(overflow, `${contentPage.path} overflows at ${viewport.width}px`).toEqual([]);
      expect(
        browserIssues.slice(issueOffset),
        `${contentPage.path} emitted browser errors or LCP warnings`
      ).toEqual([]);
    }
  });
}

test('brand directory uses a readable four-column desktop catalog instead of a dense logo wall', async ({
  page
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${FRONTEND_BASE_URL}/doi-tac-thuong-hieu`);

  const directory = page.locator('[data-brand-directory="true"]');
  await expect(directory).toBeVisible();
  const cards = directory.locator('[data-brand-card="true"]');
  expect(await cards.count()).toBeGreaterThan(8);
  await expect
    .poll(() =>
      directory.evaluate((element) =>
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      )
    )
    .toBe(4);
  await expect(page.locator('[data-brand-hero-logo-wall="true"]')).toHaveCount(0);
});
