import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { getQaAuth } from './qaAuth';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('dashboard shows readable trends, exact values, rankings and mobile layout', async ({ page, request, browser }, testInfo) => {
  const data = await getQaAuth(request, api);

  const sessionState = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
    permissions: data.permissions,
    roles: []
  };
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, sessionState);

  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(`${admin}/dashboard`);
  const traffic = page.locator('[data-dashboard-traffic="true"]');
  await expect(traffic.getByRole('heading', { name: 'Lượt truy cập website' })).toBeVisible();
  await expect(traffic.locator('.animate-pulse')).toHaveCount(0);

  const chart = traffic.locator('[data-dashboard-chart="true"]');
  await expect(chart.locator('svg[role="img"]')).toBeVisible();
  const dailyPoints = await chart.locator('svg g[role="img"]').count();
  expect(dailyPoints).toBe(20);
  await expect(chart.locator('svg path[data-traffic-trend="true"]')).toHaveCount(1);
  await expect(chart.locator('svg rect[data-traffic-bar="true"]')).toHaveCount(0);
  const readout = chart.locator('[data-traffic-readout="true"]');
  const lastLabel = (await chart.locator('svg g[role="img"]').last().getAttribute('aria-label'))!.split(':')[0];
  await expect(readout).toContainText(lastLabel);
  await chart.locator('svg[role="img"]').focus();
  await page.keyboard.press('ArrowLeft');
  const previousLabel = (await chart.locator('svg g[role="img"]').nth(dailyPoints - 2).getAttribute('aria-label'))!.split(':')[0];
  await expect(readout).toContainText(previousLabel);
  const chartBox = (await chart.locator('svg[role="img"]').boundingBox())!;
  await page.mouse.move(chartBox.x + chartBox.width * 0.02, chartBox.y + chartBox.height * 0.5);
  const earliestLabel = (await chart.locator('svg g[role="img"]').first().getAttribute('aria-label'))!.split(':')[0];
  await expect(readout).toContainText(earliestLabel);
  await page.mouse.move(chartBox.x + chartBox.width * 0.98, chartBox.y + chartBox.height * 0.5);
  await expect(readout).toContainText(lastLabel);
  await chart.getByText('Xem số liệu chi tiết').click();
  await expect(chart.getByRole('table').locator('tbody tr')).toHaveCount(dailyPoints);
  const firstPoint = await chart.locator('svg g[role="img"]').first().getAttribute('aria-label');
  const firstRow = await chart.getByRole('table').locator('tbody tr').first().innerText();
  expect(firstPoint).toContain(firstRow.split('\t')[0]);
  const dailyCounts = await chart.getByRole('table').locator('tbody td:last-child').allTextContents();
  const visibleTotal = dailyCounts.reduce((sum, count) => sum + Number(count.replace(/\D/g, '')), 0);
  const lastPoint = await chart.locator('svg g[role="img"]').last().getAttribute('aria-label');
  expect(lastPoint).toContain(`${visibleTotal.toLocaleString('vi-VN')} lượt lũy kế`);
  const products = page.locator('[data-dashboard-featured-products="true"]');
  await expect(products.getByRole('heading', { name: 'Sản phẩm được quan tâm' })).toBeVisible();
  await expect(products.locator('ol li')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Việc cần xử lý' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Sản phẩm chờ duyệt/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Trang nội dung chờ duyệt/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Lô nhập đang xử lý/ })).toBeVisible();
  const operations = page.locator('[data-dashboard-operations="true"]');
  const metrics = page.locator('[data-dashboard-metrics="true"]');
  expect((await operations.boundingBox())!.y).toBeLessThan((await metrics.boundingBox())!.y);
  expect((await metrics.boundingBox())!.y).toBeLessThan((await traffic.boundingBox())!.y);
  expect(await traffic.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
  await chart.getByText('Xem số liệu chi tiết').click();
  await page.screenshot({ path: testInfo.outputPath('dashboard1920.png'), caret: 'initial', fullPage: true });
  await traffic.screenshot({ path: testInfo.outputPath('traffic1920.png'), caret: 'initial' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const trafficBox = await traffic.boundingBox();
  expect(trafficBox).not.toBeNull();
  expect(trafficBox!.y).toBeLessThan(750);
  expect((await operations.boundingBox())!.y).toBeLessThan(trafficBox!.y);
  expect(trafficBox!.y).toBeLessThan((await metrics.boundingBox())!.y);
  await expect(chart.locator('svg[role="img"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard390.png'), caret: 'initial', fullPage: true });
  await traffic.screenshot({ path: testInfo.outputPath('traffic390.png'), caret: 'initial' });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const vietnamDate = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  await traffic.getByRole('button', { name: 'Theo năm' }).click();
  await expect(traffic.getByRole('combobox')).toBeVisible();
  await expect.poll(() => chart.locator('svg g[role="img"]').count()).toBe(Number(vietnamDate.month));
  await expect(chart.locator('svg path[data-traffic-trend="true"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('dashboardYear390.png'), caret: 'initial', fullPage: true });
  await traffic.getByRole('button', { name: 'Theo tháng' }).click();
  await expect(traffic.locator('input[type="month"]')).toHaveAttribute('max', `${vietnamDate.year}-${vietnamDate.month}`);
  await expect.poll(() => chart.locator('svg g[role="img"]').count()).toBe(Number(vietnamDate.day));
  await expect(chart.locator('svg path[data-traffic-trend="true"]')).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('dashboardMonth390.png'), caret: 'initial', fullPage: true });

  await page.goto(`${admin}/dashboard`);
  await page.getByRole('link', { name: /Sản phẩm chờ duyệt/ }).click();
  await expect(page).toHaveURL(/\/admin\/product-groups\?review_status=pending_review/);
  await expect(page.getByLabel('Trạng thái duyệt')).toHaveValue('pending_review');

  await page.goto(`${admin}/dashboard`);
  await page.getByRole('link', { name: /Trang nội dung chờ duyệt/ }).click();
  await expect(page).toHaveURL(/\/admin\/page-contents\?review_status=pending_review/);
  await expect(page.getByText('Đang lọc: Chờ duyệt')).toBeVisible();
  await page.getByRole('button', { name: 'Bỏ lọc' }).click();
  await expect(page).not.toHaveURL(/review_status=pending_review/);
  await expect(page.getByText('Đang lọc: Chờ duyệt')).toHaveCount(0);

  await page.goto(`${admin}/dashboard`);
  await page.getByRole('link', { name: /Lô nhập đang xử lý/ }).click();
  await expect(page).toHaveURL(/\/admin\/import\?status=created%2Cvalidated%2Cin_review%2Cready_to_apply/);
  await expect(page.getByLabel('Trạng thái')).toHaveValue('created,validated,in_review,ready_to_apply');

  await page.goto(`${admin}/dashboard`);
  await page.getByRole('link', { name: /Liên hệ mới/ }).click();
  await expect(page).toHaveURL(/\/admin\/contacts\?status=new/);
  await expect(page.getByRole('button', { name: /^Mới/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Tất cả' }).click();
  await expect(page).not.toHaveURL(/status=new/);
  await expect(page.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'true');

  await page.goto(`${admin}/dashboard`);
  await page.getByRole('link', { name: /Yêu cầu báo giá mới/ }).click();
  await expect(page).toHaveURL(/\/admin\/quotes\?status=new/);
  await expect(page.getByRole('button', { name: /^Mới/ })).toHaveAttribute('aria-pressed', 'true');

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPage = await touchContext.newPage();
  await touchPage.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, sessionState);
  await touchPage.goto(`${admin}/dashboard`);
  const touchChart = touchPage.locator('[data-dashboard-chart="true"]');
  const touchSvg = touchChart.locator('svg[role="img"]');
  await expect(touchSvg).toBeVisible();
  const touchFirst = (await touchSvg.locator('g[role="img"]').first().getAttribute('aria-label'))!.split(':')[0];
  const touchLast = (await touchSvg.locator('g[role="img"]').last().getAttribute('aria-label'))!.split(':')[0];
  await touchSvg.tap({ position: { x: 5, y: 100 } });
  await expect(touchChart.locator('[data-traffic-readout="true"]')).toContainText(touchFirst);
  const touchBox = (await touchSvg.boundingBox())!;
  await touchSvg.tap({ position: { x: touchBox.width - 5, y: 100 } });
  await expect(touchChart.locator('[data-traffic-readout="true"]')).toContainText(touchLast);
  await touchContext.close();
});
