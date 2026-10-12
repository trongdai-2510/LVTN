import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const frontend = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

test('project case study remains composed from phone to ultrawide screens', async ({
  page,
  request
}, testInfo) => {
  test.setTimeout(120_000);
  const project = await firstPublishedProject(request);
  const url = `${frontend}/du-an/${encodeURIComponent(project.slug)}`;
  const detailResponse = await request.get(`${api}/public/projects/${encodeURIComponent(project.slug)}`);
  expect(detailResponse.ok()).toBeTruthy();
  const detail = (await detailResponse.json()) as {
    data?: { related_product_groups?: unknown[] };
  };
  const relatedCount = detail.data?.related_product_groups?.length ?? 0;

  for (const width of [320, 390, 768, 1024, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(page.locator('[data-page-archetype="project-case-study"]')).toBeVisible();
    await expect(page.locator('[data-project-hero="cover"]')).toBeVisible();
    await expect(page.locator('[data-project-story-layout="reading"]')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: project.title })).toBeVisible();
    await expect(page.getByText('Thiết bị Song Thanh cung cấp cho dự án')).toHaveCount(0);
    const relatedShortcut = page.getByRole('link', { name: `${relatedCount} nhóm sản phẩm trong hồ sơ Xem nhóm sản phẩm` });
    if (relatedCount > 0) {
      await expect(relatedShortcut).toBeVisible();
      await expect(relatedShortcut).toHaveAttribute('href', '#san-pham-du-an');
    } else {
      await expect(relatedShortcut).toHaveCount(0);
    }
    await expectNoOverflow(page);

    const sectionLinks = page.getByRole('navigation', { name: 'Điều hướng hồ sơ dự án' }).getByRole('link');
    for (const link of await sectionLinks.all()) {
      const target = await link.getAttribute('href');
      expect(target).toMatch(/^#[a-z0-9-]+$/);
      await expect(page.locator(target!)).toHaveCount(1);
    }

    if ([390, 1440, 2560].includes(width)) {
      await page.screenshot({
        caret: 'initial',
        fullPage: true,
        path: testInfo.outputPath(`project${width}.png`)
      });
    }
  }
});

test('project case study meets automated WCAG checks on desktop and mobile', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  const project = await firstPublishedProject(request);

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${frontend}/du-an/${encodeURIComponent(project.slug)}`);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});

async function firstPublishedProject(request: APIRequestContext) {
  const response = await request.get(`${api}/public/projects?page=1&page_size=1`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    data?: { items?: Array<{ slug?: string; title?: string }> };
  };
  const project = body.data?.items?.[0];
  expect(project?.slug).toBeTruthy();
  expect(project?.title).toBeTruthy();
  return { slug: String(project!.slug), title: String(project!.title) };
}

async function expectNoOverflow(page: Page) {
  const size = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(size.content).toBeLessThanOrEqual(size.viewport + 1);
}
