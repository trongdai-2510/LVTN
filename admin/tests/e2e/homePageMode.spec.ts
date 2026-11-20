import { expect, test } from '@playwright/test';

const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const user = { id: 'qa', email: 'qa@example.local', display_name: 'QA', status: 'active' };
const permissions = ['home_page.read', 'home_page.update'];

test('homepage mode shows the saved choice and opens the manual picker immediately', async ({ page }) => {
  const data = {
    sections: [{
      id: 'hero-qa', section_type: 'hero', enabled: true, sort_order: 0,
      title_override: null, subtitle: null, updated_at: '2026-11-16T00:00:00.000Z',
      config: { mode: 'auto', position: 'hero', banner_ids: [] as string[] }
    }],
    seo: { title: null, description: null },
    resolved_picks: {
      banners: [] as Array<{ id: string; title: string }>, product_categories: [], product_groups: [], services: [], projects: [], brands: [],
      page_content_company_overview: null
    },
    availability: {
      hero_position_banner_count: 1, active_categories_count: 0, active_product_groups_count: 0,
      active_services_count: 0, active_projects_count: 0, active_brands_count: 0, active_partners_count: 0
    }
  };
  await page.addInitScript((state) => {
    sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, { accessToken: 'qa-token', refreshToken: null, user, permissions, roles: [] });
  await page.route('**/auth/me', (route) => route.fulfill({ json: { ok: true, data: { user, permissions, roles: [] } } }));
  await page.route('**/song-thanh/banners?**', (route) => route.fulfill({ json: {
    ok: true, data: { items: [{ id: 'banner-qa', title: 'Banner thử', status: 'active', image_file_id: null }], pagination: { page: 1, page_size: 24, total: 1 } }
  } }));
  await page.route('**/song-thanh/home-page', (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON();
      data.sections[0].config = payload.sections[0].config;
      data.resolved_picks.banners = [{ id: 'banner-qa', title: 'Banner thử' }];
    }
    return route.fulfill({ json: { ok: true, data } });
  });

  await page.goto(`${admin}/admin/home-page`);
  const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Banner đầu trang' }) });
  await expect(row.getByText('Website: Tự động')).toBeVisible();
  await row.getByRole('button', { name: 'Cài đặt' }).click();
  await row.getByRole('button', { name: 'Chọn thủ công' }).click();
  const picker = page.getByRole('dialog', { name: 'Chọn banner' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Hủy' }).click();
  await expect(row.getByRole('button', { name: /Tự động/ })).toHaveAttribute('aria-pressed', 'true');

  await row.getByRole('button', { name: 'Chọn thủ công' }).click();
  await picker.getByRole('button', { name: /Banner thử/ }).click();
  await picker.getByRole('button', { name: 'Áp dụng danh sách' }).click();
  await expect(row.getByText('Website: Tự động')).toBeVisible();
  await expect(row.getByText('Sau khi lưu: Thủ công')).toBeVisible();
  await row.getByRole('button', { name: 'Sửa danh sách đã chọn' }).waitFor();
  await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog', { name: 'Đã lưu trang chủ' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Đã lưu trang chủ' }).getByRole('button', { name: /Về|Tiếp tục/ })).toHaveCount(0);
  await page.getByRole('dialog', { name: 'Đã lưu trang chủ' }).getByRole('button', { name: 'Đóng' }).last().click();
  await expect(row.getByText('Website: Thủ công')).toBeVisible();
});
