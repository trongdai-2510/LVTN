import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { getQaAuth } from './qaAuth';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('dashboard shows metrics and trends before compact work queues', async ({ page, request, browser }, testInfo) => {
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
  const analyticsSection = page.locator('[data-dashboard-analytics="true"]');
  const traffic = page.locator('[data-dashboard-traffic="true"]');
  await expect(traffic.getByRole('heading', { name: 'Lượt xem trang' })).toBeVisible();
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
  expect(chartBox.width).toBeGreaterThanOrEqual(750);
  expect(chartBox.height).toBeGreaterThanOrEqual(240);
  await page.mouse.move(chartBox.x + chartBox.width * 0.02, chartBox.y + chartBox.height * 0.5);
  const earliestLabel = (await chart.locator('svg g[role="img"]').first().getAttribute('aria-label'))!.split(':')[0];
  await expect(readout).toContainText(earliestLabel);
  await page.mouse.move(chartBox.x + chartBox.width * 0.98, chartBox.y + chartBox.height * 0.5);
  await expect(readout).toContainText(lastLabel);
  const firstPoint = await chart.locator('svg g[role="img"]').first().getAttribute('aria-label');
  await traffic.getByRole('button', { name: 'Bảng số liệu' }).click();
  const table = traffic.locator('[data-dashboard-table="true"]');
  await expect(table.getByRole('table').locator('tbody tr')).toHaveCount(dailyPoints);
  const firstRow = await table.getByRole('table').locator('tbody tr').first().innerText();
  expect(firstPoint).toContain(firstRow.split('\t')[0]);
  const dailyCounts = await table.getByRole('table').locator('tbody td:last-child').allTextContents();
  const visibleTotal = dailyCounts.reduce((sum, count) => sum + Number(count.replace(/\D/g, '')), 0);
  const trafficMetric = page.getByRole('region', { name: 'Số liệu tổng quan' }).getByText('Lượt xem trang').locator('..').locator('strong');
  expect(visibleTotal).toBe(Number((await trafficMetric.innerText()).replace(/\D/g, '')));
  await page.screenshot({ path: testInfo.outputPath('dashboardTable1920.png'), caret: 'initial', fullPage: true });
  await traffic.getByRole('button', { name: 'Biểu đồ' }).click();
  await expect(chart.locator('svg[role="img"]')).toBeVisible();
  const products = page.locator('[data-dashboard-featured-products="true"]');
  await expect(products.getByRole('heading', { name: 'Sản phẩm được xem nhiều' })).toBeVisible();
  await expect(products).toContainText('20 ngày gần nhất');
  const rankedProducts = products.locator('ol li');
  if (await rankedProducts.count()) {
    expect(await rankedProducts.count()).toBeLessThanOrEqual(6);
    await expect(rankedProducts.first().locator('a')).toHaveAttribute('href', /\/admin\/product-groups\//);
  } else {
    await expect(products).toContainText('Chưa có lượt xem sản phẩm trong kỳ');
  }
  const operations = page.locator('[data-dashboard-operations="true"]');
  const requests = page.locator('[data-dashboard-requests="true"]');
  const metrics = page.getByRole('region', { name: 'Số liệu tổng quan' });
  await expect(metrics).toContainText('Lượt xem trang');
  await expect(metrics).toContainText('Yêu cầu mới');
  await expect(metrics.locator('.animate-pulse')).toHaveCount(0);
  const clearWork = await page.getByText('Hiện không có công việc đang chờ xử lý.').isVisible();
  expect((await metrics.boundingBox())!.y).toBeLessThan((await analyticsSection.boundingBox())!.y);
  expect((await analyticsSection.boundingBox())!.y).toBeLessThan((await traffic.boundingBox())!.y);
  if (clearWork) {
    await expect(requests).toHaveCount(0);
    await expect(operations).toHaveCount(0);
  } else {
    await expect(page.getByRole('heading', { name: 'Nội dung và nhập liệu' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Sản phẩm chờ duyệt/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Trang nội dung chờ duyệt/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Lô nhập đang xử lý/ })).toBeVisible();
    expect((await analyticsSection.boundingBox())!.y).toBeLessThan((await requests.boundingBox())!.y);
    expect((await analyticsSection.boundingBox())!.y).toBeLessThan((await operations.boundingBox())!.y);
    await expect(requests.getByRole('heading', { name: 'Yêu cầu cần theo dõi' })).toBeVisible();
    await expect(requests.locator('.animate-pulse')).toHaveCount(0);
    expect(await requests.locator('li').count()).toBeLessThanOrEqual(2);
    await requests.getByRole('button', { name: /Đang xử lý/ }).click();
    await expect(requests.getByRole('button', { name: /Đang xử lý/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(requests.getByRole('link', { name: /Xem liên hệ đang xử lý/ })).toHaveAttribute('href', '/admin/contacts?status=in_progress');
    await requests.getByRole('button', { name: /^Mới/ }).click();
    const mineTab = requests.getByRole('button', { name: /^Của tôi/ });
    if (await mineTab.count()) {
      await mineTab.click();
      await expect(requests.locator('.animate-pulse')).toHaveCount(0);
      const mineContactLink = requests.getByRole('link', { name: /Xem liên hệ của tôi/ });
      if (await mineContactLink.count()) {
        await mineContactLink.click();
        await expect(page).toHaveURL(/\/admin\/contacts\?assigned_to=\d+/);
        await expect(page.getByLabel('Lọc người phụ trách')).not.toHaveValue('');
        await page.getByRole('button', { name: 'Xóa lọc' }).click();
        await expect(page).not.toHaveURL(/assigned_to=/);
        await expect(page.getByLabel('Lọc người phụ trách')).toHaveValue('');
        await page.goto(`${admin}/dashboard`);
        await expect(traffic.locator('.animate-pulse')).toHaveCount(0);
        await expect(requests.locator('.animate-pulse')).toHaveCount(0);
      } else {
        await requests.getByRole('button', { name: /^Mới/ }).click();
      }
    }
  }
  expect(await traffic.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  const accessibility = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('dashboard1920.png'), caret: 'initial', fullPage: true });
  await traffic.screenshot({ path: testInfo.outputPath('traffic1920.png'), caret: 'initial' });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const trafficBox = await traffic.boundingBox();
  expect(trafficBox).not.toBeNull();
  expect((await chart.locator('svg[role="img"]').boundingBox())!.height).toBeGreaterThanOrEqual(200);
  expect((await metrics.boundingBox())!.y).toBeLessThan((await analyticsSection.boundingBox())!.y);
  if (!clearWork) {
    expect((await analyticsSection.boundingBox())!.y).toBeLessThan((await requests.boundingBox())!.y);
    expect((await requests.boundingBox())!.y).toBeLessThan((await operations.boundingBox())!.y);
  }
  expect((await analyticsSection.boundingBox())!.y).toBeLessThan(trafficBox!.y);
  expect(trafficBox!.y).toBeLessThan((await products.boundingBox())!.y);
  await expect(chart.locator('svg[role="img"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard390.png'), caret: 'initial', fullPage: true });
  await traffic.screenshot({ path: testInfo.outputPath('traffic390.png'), caret: 'initial' });
  await traffic.getByRole('button', { name: 'Bảng số liệu' }).click();
  await expect(table.getByRole('table')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboardTable390.png'), caret: 'initial', fullPage: true });
  await traffic.getByRole('button', { name: 'Biểu đồ' }).click();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const vietnamDate = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const analyticsRoute = '**/song-thanh/dashboard/analytics?*';
  let releaseAnalytics: (() => void) | undefined;
  await page.route(analyticsRoute, async (route) => {
    await new Promise<void>((resolve) => { releaseAnalytics = resolve; });
    await route.continue();
  });
  const panelHeightBeforeChange = (await traffic.boundingBox())!.height;
  const totalBeforeChange = await trafficMetric.innerText();
  await analyticsSection.getByRole('button', { name: 'Theo năm' }).click();
  await expect(traffic.getByRole('status')).toContainText('Đang cập nhật kỳ mới');
  await expect(chart.locator('svg[role="img"]')).toBeVisible();
  await expect(trafficMetric).toHaveText(totalBeforeChange);
  expect(Math.abs((await traffic.boundingBox())!.height - panelHeightBeforeChange)).toBeLessThan(2);
  await expect.poll(() => Boolean(releaseAnalytics)).toBe(true);
  releaseAnalytics?.();
  await expect(traffic.getByRole('status')).toHaveCount(0);
  await page.unroute(analyticsRoute);
  await expect(analyticsSection.getByRole('combobox')).toBeVisible();
  const periodModes = analyticsSection.getByRole('group', { name: 'Chế độ thời gian' });
  const yearPicker = analyticsSection.getByRole('combobox', { name: 'Chọn năm' });
  expect(Math.abs((await periodModes.boundingBox())!.y - (await yearPicker.boundingBox())!.y)).toBeLessThan(5);
  await expect.poll(() => chart.locator('svg g[role="img"]').count()).toBe(Number(vietnamDate.month));
  await page.setViewportSize({ width: 320, height: 844 });
  const yearModesBox = (await periodModes.boundingBox())!;
  const yearPickerBox = (await yearPicker.boundingBox())!;
  expect(Math.abs(yearModesBox.y - yearPickerBox.y)).toBeLessThan(5);
  expect(yearModesBox.x + yearModesBox.width).toBeLessThanOrEqual(yearPickerBox.x);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboardYear320.png'), caret: 'initial', animations: 'disabled', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(chart.locator('svg path[data-traffic-trend="true"]')).toHaveCount(1);
  await expect(products).toContainText(`Năm ${vietnamDate.year}`);
  await page.screenshot({ path: testInfo.outputPath('dashboardYear390.png'), caret: 'initial', animations: 'disabled', fullPage: true });
  await analyticsSection.getByRole('button', { name: 'Theo tháng' }).click();
  const monthPicker = analyticsSection.getByRole('combobox', { name: 'Chọn tháng' });
  await expect(monthPicker).toHaveValue(`${vietnamDate.year}-${vietnamDate.month}`);
  expect(Math.abs((await periodModes.boundingBox())!.y - (await monthPicker.boundingBox())!.y)).toBeLessThan(5);
  await page.setViewportSize({ width: 320, height: 844 });
  const monthModesBox = (await periodModes.boundingBox())!;
  const monthPickerBox = (await monthPicker.boundingBox())!;
  expect(Math.abs(monthModesBox.y - monthPickerBox.y)).toBeLessThan(5);
  expect(monthModesBox.x + monthModesBox.width).toBeLessThanOrEqual(monthPickerBox.x);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboardMonth320.png'), caret: 'initial', animations: 'disabled', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(analyticsSection.locator('input[type="month"]')).toBeVisible();
  await expect(analyticsSection.locator('input[type="month"]')).toHaveAttribute('max', `${vietnamDate.year}-${vietnamDate.month}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => chart.locator('svg g[role="img"]').count()).toBe(Number(vietnamDate.day));
  await expect(chart.locator('svg path[data-traffic-trend="true"]')).toHaveCount(1);
  await expect(products).toContainText(`Tháng ${Number(vietnamDate.month)}/${vietnamDate.year}`);
  await page.screenshot({ path: testInfo.outputPath('dashboardMonth390.png'), caret: 'initial', animations: 'disabled', fullPage: true });

  if (!clearWork) {
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
    await requests.getByRole('link', { name: /Xem liên hệ mới/ }).click();
    await expect(page).toHaveURL(/\/admin\/contacts\?status=new/);
    await expect(page.getByRole('button', { name: /^Mới/ })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Tất cả' }).click();
    await expect(page).not.toHaveURL(/status=new/);
    await expect(page.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'true');

    await page.goto(`${admin}/dashboard`);
    await requests.getByRole('link', { name: /Xem báo giá mới/ }).click();
    await expect(page).toHaveURL(/\/admin\/quotes\?status=new/);
    await expect(page.getByRole('button', { name: /^Mới/ })).toHaveAttribute('aria-pressed', 'true');
  }

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
