import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { getQaAuth } from './qaAuth';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

const targets = [
  { label: 'Dự án', path: '/projects', placeholder: 'Tìm theo tên...' },
  { label: 'Liên hệ', path: '/contacts', placeholder: 'Tìm theo tên khách, công ty, email, số điện thoại...' },
  { label: 'Yêu cầu báo giá', path: '/quotes', placeholder: 'Tìm theo tên khách, công ty, email, số điện thoại...' },
  { label: 'Danh mục sản phẩm', path: '/product-categories', placeholder: 'Tìm trong cây danh mục...' },
  { label: 'Kho tệp', path: '/files', placeholder: 'Tìm theo sản phẩm, thương hiệu, banner, tài liệu...' },
  { label: 'Khách hàng', path: '/customers', placeholder: 'Tìm theo tên khách, công ty, số điện thoại, email...' },
  { label: 'Nhập dữ liệu', path: '/import', placeholder: 'Tìm theo tên lô, tệp nguồn, ghi chú...' },
  { label: 'Nhật ký hệ thống', path: '/audit-logs', placeholder: 'Tìm hành động, loại dữ liệu hoặc ID bản ghi' },
  { label: 'Trang nội dung', path: '/page-contents', placeholder: 'Tìm theo tiêu đề hoặc đường dẫn', allStatuses: true },
  { label: 'Banner', path: '/banners', placeholder: 'Tìm tên banner hoặc đường dẫn trang...' },
  { label: 'Sản phẩm', path: '/product-groups', placeholder: 'Tìm tên sản phẩm, mã hoặc SKU...' },
  { label: 'Biến thể / SKU', path: '/product-variants', placeholder: 'Tìm tên biến thể, SKU, model hoặc sản phẩm...' },
  { label: 'Thương hiệu', path: '/brands', placeholder: 'Tìm theo tên thương hiệu...' },
  { label: 'Tài liệu kỹ thuật', path: '/technical-documents', placeholder: 'Tìm theo tên tài liệu hoặc sản phẩm...' },
  { label: 'Dịch vụ', path: '/services', placeholder: 'Tìm theo tên...' }
] as const;

test('topbar search carries a query into each searchable admin area', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const data = await getQaAuth(request, api);
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
    permissions: data.permissions,
    roles: []
  });

  const query = 'codexsearchprobe';
  await page.goto(`${admin}/dashboard`);
  await expect(page.locator('[data-admin-topbar]')).toContainText(data.user.display_name);
  for (const target of targets) {
    await test.step(target.label, async () => {
      const quickSearch = page.getByRole('combobox', { name: 'Tìm trang hoặc dữ liệu' });
      await expect(quickSearch).toHaveValue('');
      await quickSearch.fill(query);
      const destination = page.getByRole('button', { name: new RegExp(`Tìm "${query}" trong ${target.label}`) });
      if (await destination.count() === 0) {
        await page.getByRole('button', { name: 'Xem tất cả khu vực' }).click();
      }
      await destination.click();
      await expect(page, `Điều hướng tìm kiếm ${target.label}`).toHaveURL(
        (url) =>
          url.pathname === `/admin${target.path}` &&
          url.searchParams.get('q') === query &&
          (!('allStatuses' in target) || url.searchParams.get('lane') === 'all'),
        { timeout: 15_000 }
      );
      await expect(page.getByPlaceholder(target.placeholder), target.label).toHaveValue(query);
    });
  }

  await page.goto(`${admin}/dashboard`);
  const quickSearch = page.getByRole('combobox', { name: 'Tìm trang hoặc dữ liệu' });
  await quickSearch.fill('ống');
  const pipeResults = page.locator('[data-topbar-quick-nav-results]');
  await expect(pipeResults.getByText('Đi tới trang')).toHaveCount(0);
  await expect(pipeResults.getByRole('button', { name: 'Tìm "ống" trong Sản phẩm' })).toBeVisible();
  await pipeResults.screenshot({ path: testInfo.outputPath('searchPipe.png'), caret: 'initial' });
  const searchBox = (await quickSearch.boundingBox())!;
  const resultsBox = (await pipeResults.boundingBox())!;
  await page.screenshot({
    path: testInfo.outputPath('searchPipeContext.png'),
    caret: 'initial',
    clip: {
      x: searchBox.x - 4,
      y: searchBox.y - 4,
      width: searchBox.width + 8,
      height: resultsBox.y + resultsBox.height - searchBox.y + 8
    }
  });
  await quickSearch.press('Enter');
  await expect(page).toHaveURL(`${admin}/dashboard`);
  await quickSearch.press('ArrowDown');
  await quickSearch.press('Enter');
  await expect(page).toHaveURL(`${admin}/product-groups?q=${encodeURIComponent('ống')}`);

  await page.goto(`${admin}/dashboard`);
  await quickSearch.fill('sản phẩm');
  await quickSearch.press('Enter');
  await expect(page).toHaveURL(`${admin}/product-groups`);

  await page.goto(`${admin}/dashboard`);
  await quickSearch.fill('codexsearchprobe');
  await expect(page.locator('[data-topbar-quick-nav-results]')).toContainText('Chọn khu vực để tìm dữ liệu');
  await expect(page.locator('[data-topbar-quick-nav-results]').getByRole('button', { name: /Tìm "codexsearchprobe" trong/ })).toHaveCount(4);
  const accessibility = await new AxeBuilder({ page }).include('[data-admin-topbar]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('searchDestinations.png'), caret: 'initial' });
  await quickSearch.press('Enter');
  await expect(page).toHaveURL(`${admin}/dashboard`);
  await quickSearch.press('ArrowDown');
  await quickSearch.press('Enter');
  await expect(page).toHaveURL((url) => url.pathname === '/admin/product-groups' && url.searchParams.get('q') === 'codexsearchprobe');

  await page.goto(`${admin}/contacts`);
  await quickSearch.fill('codexsearchprobe');
  await quickSearch.press('Enter');
  await expect(page).toHaveURL(`${admin}/contacts?q=codexsearchprobe`);
  await expect(page.getByPlaceholder('Tìm theo tên khách, công ty, email, số điện thoại...')).toHaveValue('codexsearchprobe');
  await page.keyboard.press('Control+k');
  await expect(quickSearch).toBeFocused();
  await expect(page.locator('[data-topbar-quick-nav-results]')).toBeVisible();
  await quickSearch.press('Escape');
  await expect(page.locator('[data-topbar-quick-nav-results]')).toHaveCount(0);

  for (const target of targets.filter((item) => item.path === '/product-groups' || item.path === '/page-contents')) {
    await page.goto(`${admin}${target.path}`);
    await quickSearch.fill('codexcurrentprobe');
    await quickSearch.press('Enter');
    await expect(page).toHaveURL((url) => url.pathname === `/admin${target.path}` && url.searchParams.get('q') === 'codexcurrentprobe');
    const localSearch = page.getByPlaceholder(target.placeholder);
    await expect(localSearch, `Tìm ngay trong ${target.label}`).toHaveValue('codexcurrentprobe');
    await localSearch.fill('codexlocalprobe');
    await expect(page).toHaveURL((url) => url.pathname === `/admin${target.path}` && url.searchParams.get('q') === 'codexlocalprobe');
    await expect(localSearch).toHaveValue('codexlocalprobe');
  }

  const mismatchedCurrentSearches: string[] = [];
  for (const target of targets) {
    await page.goto(`${admin}${target.path}`);
    await quickSearch.fill('codexsameprobe');
    await quickSearch.press('Enter');
    await expect(page).toHaveURL((url) => url.pathname === `/admin${target.path}` && url.searchParams.get('q') === 'codexsameprobe');
    try {
      await expect(page.getByPlaceholder(target.placeholder)).toHaveValue('codexsameprobe', { timeout: 2500 });
    } catch {
      mismatchedCurrentSearches.push(target.label);
    }
  }
  expect(mismatchedCurrentSearches).toEqual([]);
});
