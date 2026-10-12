import { expect, test, type APIRequestContext } from '@playwright/test';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const FRONTEND_BASE_URL = (
  process.env.FRONTEND_BASE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

test('the quote form keeps ambiguous quantities visible and blocks submission without guessing', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  const slug = await firstPublishedProductSlug(request);
  await page.goto(`${FRONTEND_BASE_URL}/san-pham/${encodeURIComponent(slug)}`);

  await page.locator('[data-quote-action="save"]').click();
  await page.getByRole('button', { name: 'Xem danh sách đã lưu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Danh sách yêu cầu' });
  await expect(dialog).toBeVisible();

  const quantity = dialog.getByRole('textbox', { name: /^Số lượng / });
  await expect(quantity).toHaveValue('1');

  for (const [input, message] of [
    ['1/2', 'không nhập phân số hay đơn vị'],
    ['0,5', 'không nhập phân số hay đơn vị'],
    ['2 cái', 'không nhập phân số hay đơn vị'],
    ['0', 'phải từ 1 trở lên'],
    ['2147483648', 'không được vượt quá']
  ]) {
    await quantity.fill(input);
    await expect(quantity).toHaveValue(input);
    await expect(quantity).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog.getByText(new RegExp(message, 'i'))).toBeVisible();
  }

  await quantity.fill('1/2');
  await dialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
  await expect(quantity).toBeFocused();
  await expect(
    dialog.getByText('Vui lòng sửa số lượng chưa hợp lệ trước khi gửi yêu cầu.')
  ).toBeVisible();

  await dialog
    .getByRole('button', { name: 'Chưa xác định số lượng — nhờ tư vấn' })
    .click();
  await expect(dialog.getByText(/Đã ghi nhận “1\/2”/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Nhập lại số' }).click();
  await expect(quantity).toBeFocused();

  await quantity.fill('02');
  await quantity.blur();
  await expect(quantity).toHaveValue('2');
  await expect(quantity).toHaveAttribute('aria-invalid', 'false');

  const itemLabel = await quantity.getAttribute('aria-label');
  const accessibleSuffix = String(itemLabel).replace(/^Số lượng\s*/, '');
  await dialog
    .getByRole('button', { name: `Tăng số lượng ${accessibleSuffix}` })
    .click();
  await expect(quantity).toHaveValue('3');
  await dialog
    .getByRole('button', { name: `Giảm số lượng ${accessibleSuffix}` })
    .click();
  await expect(quantity).toHaveValue('2');

  await page.setViewportSize({ width: 320, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    )
    .toBe(true);
  await expect(dialog.getByRole('button', { name: /Xóa .* khỏi danh sách/ })).toBeVisible();
});

async function firstPublishedProductSlug(request: APIRequestContext): Promise<string> {
  const response = await request.get(
    `${API_BASE_URL}/public/product-groups?page=1&page_size=20`
  );
  expect(response.ok(), `Public product list returned HTTP ${response.status()}`).toBe(true);
  const body = (await response.json()) as {
    data?: { items?: Array<{ slug?: unknown }>; product_groups?: Array<{ slug?: unknown }> };
    items?: Array<{ slug?: unknown }>;
    product_groups?: Array<{ slug?: unknown }>;
  };
  const data = body.data ?? body;
  const items = data.items ?? data.product_groups ?? [];
  const product = items.find((item) => typeof item.slug === 'string' && item.slug.length > 0);
  expect(product, 'QA needs at least one published product group').toBeTruthy();
  return String(product!.slug);
}
