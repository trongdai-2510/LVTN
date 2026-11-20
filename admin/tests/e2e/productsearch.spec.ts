import { expect, test } from '@playwright/test';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('product search ranks exact and near matches by visible names and codes', async ({ page, request }, testInfo) => {
  const login = await request.post(`${api}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.101' },
    data: {
      email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
      password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
    }
  });
  expect(login.ok(), `Admin login returned HTTP ${login.status()}`).toBe(true);
  const { data: auth } = await login.json();
  const result = await request.get(`${api}/song-thanh/product-groups?q=${encodeURIComponent('ống')}&page_size=20`, {
    headers: { Authorization: `Bearer ${auth.access_token}` }
  });
  expect(result.ok(), `Product search returned HTTP ${result.status()}`).toBe(true);
  const { data } = await result.json();
  const names = (data.items as Array<{ name: string }>).map((item) => item.name);

  expect(data.pagination.total).toBeGreaterThan(0);
  expect(data.pagination.total).toBeLessThan(300);
  expect(data.summary.search_match_mode).toBe('exact');
  expect(names[0]).toMatch(/^Ống/u);
  expect(names.some((name) => /(^|[^\p{L}\p{N}])ống/iu.test(name))).toBe(true);
  expect(names).not.toContain('Van cửa đồng MBV - DN15');
  expect(names).not.toContain('Đèn led panel nhỏ tròn âm viền bạc');

  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: []
  });
  await page.goto(`${admin}/product-groups?q=${encodeURIComponent('ống')}`);
  await expect(page.getByPlaceholder('Tìm tên sản phẩm, mã hoặc SKU...')).toHaveValue('ống');
  await expect(page.locator('[data-product-list-total] strong')).toHaveText(
    Number(data.pagination.total).toLocaleString('vi-VN')
  );
  await page.screenshot({ path: testInfo.outputPath('productSearch.png'), caret: 'initial', fullPage: true });

  const search = async (query: string) => {
    const response = await request.get(`${api}/song-thanh/product-groups?q=${encodeURIComponent(query)}&page_size=20`, {
      headers: { Authorization: `Bearer ${auth.access_token}` }
    });
    expect(response.ok(), `Product search for ${query} returned HTTP ${response.status()}`).toBe(true);
    return (await response.json()).data as {
      items: Array<{ name: string; search_match: { field: string; value: string } }>;
      pagination: { total: number };
      summary: { search_match_mode: string };
    };
  };

  const withoutAccents = await search('ong');
  expect(withoutAccents.pagination.total).toBe(data.pagination.total);
  expect(withoutAccents.items[0].name).toBe(names[0]);
  const multipleWords = await search('cadivi cáp');
  expect(multipleWords.items[0].name).toMatch(/cáp.*Cadivi/iu);
  const technicalCode = await search('4x185');
  expect(technicalCode.items[0].name).toContain('4×185');
  expect((await search('185')).items.some((item) => item.name.includes('×185'))).toBe(true);
  const typo = await search('cavidi');
  expect(typo.summary.search_match_mode).toBe('near');
  expect(typo.items[0].name).toContain('Cadivi');
  const sku = await search('MT-63');
  expect(sku.items.some((item) => item.search_match.field === 'sku')).toBe(true);
  const nameAndSku = await search('rơ le MT-63');
  expect(nameAndSku.pagination.total).toBe(2);
  expect(nameAndSku.items.every((item) => item.search_match.field === 'sku')).toBe(true);
  expect(nameAndSku.items.some((item) => item.name.includes('MT-800'))).toBe(false);
  expect((await search('.*')).pagination.total).toBe(0);

  await page.goto(`${admin}/product-groups?q=cavidi`);
  await expect(page.getByRole('status')).toContainText('gần đúng');
  await page.screenshot({ path: testInfo.outputPath('productSearchNear.png'), caret: 'initial' });
  await page.goto(`${admin}/product-groups?q=MT-63`);
  await expect(page.locator('[data-product-search-match]').first()).toContainText('Khớp SKU');
  await page.screenshot({ path: testInfo.outputPath('productSearchSku.png'), caret: 'initial' });
});
