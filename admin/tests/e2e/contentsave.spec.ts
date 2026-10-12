import { expect, test } from '@playwright/test';
import { getQaAuth } from './qaAuth';

const api = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001/admin').replace(/\/$/, '');

test('saving page content reports the result in a dialog instead of an inline banner', async ({ page, request }) => {
  const auth = await getQaAuth(request, api);
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const listResponse = await request.get(`${api}/song-thanh/page-contents?page=1&page_size=100`, { headers });
  expect(listResponse.ok()).toBe(true);
  const { data: list } = await listResponse.json();
  const record = list.items.find((item: { content_type?: string; deleted_at?: string }) =>
    item.content_type === 'page' && !item.deleted_at
  );
  expect(record?.id).toBeTruthy();
  const id = String(record.id);
  const detailResponse = await request.get(`${api}/song-thanh/page-contents/${id}`, { headers });
  expect(detailResponse.ok()).toBe(true);
  const detailBody = await detailResponse.text();

  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: auth.roles ?? []
  });
  let saved = false;
  await page.route(new RegExp(`/song-thanh/page-contents/${id}(?:\\?|$)`), async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    saved = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: detailBody });
  });

  await page.goto(`${admin}/page-contents/${id}`);
  const title = page.getByRole('textbox', { name: 'Tiêu đề trang' });
  await expect(title).toBeVisible();
  await title.fill(`${await title.inputValue()} kiểm thử`);
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
  expect(saved).toBe(true);
  const dialog = page.getByRole('dialog', { name: 'Đã lưu thay đổi' });
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Đã lưu thay đổi.', { exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Về trang nội dung' }).click();
  await expect(page).toHaveURL(`${admin}/page-contents`);
});

test('super admin can save a product catalog page with empty editorial copy and sees a result', async ({ page, request }) => {
  const auth = await getQaAuth(request, api);
  expect(auth.roles).toContain('super_admin');
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const listResponse = await request.get(`${api}/song-thanh/page-contents?page=1&page_size=100`, { headers });
  expect(listResponse.ok()).toBe(true);
  const { data: list } = await listResponse.json();
  const record = list.items.find((item: { slug?: string }) => item.slug === 'san-pham');
  expect(record?.id).toBeTruthy();
  const id = String(record.id);
  const detailResponse = await request.get(`${api}/song-thanh/page-contents/${id}`, { headers });
  expect(detailResponse.ok()).toBe(true);
  const detailBody = await detailResponse.text();

  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: auth.roles ?? []
  });
  let submittedPayload: Record<string, unknown> | null = null;
  await page.route(new RegExp(`/song-thanh/page-contents/${id}(?:\\?|$)`), async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: 'application/json', body: detailBody });
  });

  await page.goto(`${admin}/page-contents/${id}`);
  const title = page.getByRole('textbox', { name: 'Tiêu đề trang' });
  await expect(title).toBeVisible();
  await title.fill(`${await title.inputValue()} kiểm thử`);
  await page.getByRole('textbox', { name: 'Mô tả ngắn' }).fill('');
  await page.getByRole('textbox', { name: 'Lời giới thiệu trang sản phẩm' }).fill('');
  await expect(page.getByRole('button', { name: 'Xuất bản ngay' })).toBeEnabled();
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();

  await expect(page.getByRole('dialog', { name: 'Đã lưu thay đổi' })).toBeVisible();
  expect(submittedPayload).toMatchObject({ excerpt: null, content_html: null });
  expect(submittedPayload).not.toHaveProperty('publish_status');
  expect(submittedPayload).not.toHaveProperty('review_status');
});

test('super admin can approve and publish the catalog without editorial copy in one action', async ({ page, request }) => {
  const auth = await getQaAuth(request, api);
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const listResponse = await request.get(`${api}/song-thanh/page-contents?page=1&page_size=100`, { headers });
  const { data: list } = await listResponse.json();
  const record = list.items.find((item: { slug?: string }) => item.slug === 'san-pham');
  expect(record?.id).toBeTruthy();
  const id = String(record.id);
  const detailResponse = await request.get(`${api}/song-thanh/page-contents/${id}`, { headers });
  const { data: detail } = await detailResponse.json();

  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: auth.roles ?? []
  });
  let submittedPayload: Record<string, unknown> | null = null;
  await page.route(new RegExp(`/song-thanh/page-contents/${id}(?:\\?|$)`), async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          page_content: {
            ...detail.page_content,
            excerpt: null,
            content_html: null,
            review_status: 'approved',
            publish_status: 'published'
          }
        },
        meta: {}
      })
    });
  });

  await page.goto(`${admin}/page-contents/${id}`);
  const title = page.getByRole('textbox', { name: 'Tiêu đề trang' });
  await expect(title).toBeVisible();
  await title.fill(`${await title.inputValue()} kiểm thử`);
  await page.getByRole('textbox', { name: 'Mô tả ngắn' }).fill('');
  await page.getByRole('textbox', { name: 'Lời giới thiệu trang sản phẩm' }).fill('');
  await page.getByRole('button', { name: 'Xuất bản ngay' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Xuất bản', exact: true }).click();

  await expect(page.getByRole('dialog', { name: 'Đã xuất bản' })).toBeVisible();
  expect(submittedPayload).toMatchObject({
    excerpt: null,
    content_html: null,
    review_status: 'approved',
    publish_status: 'published'
  });
});

test('unpublishing a visible page ignores draft readiness and keeps unsaved edits', async ({ page, request }) => {
  const auth = await getQaAuth(request, api);
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const listResponse = await request.get(`${api}/song-thanh/page-contents?page=1&page_size=100`, { headers });
  const { data: list } = await listResponse.json();
  const record = list.items.find((item: { slug?: string }) => item.slug === 'san-pham');
  expect(record?.id).toBeTruthy();
  const id = String(record.id);
  const detailResponse = await request.get(`${api}/song-thanh/page-contents/${id}`, { headers });
  const { data: detail } = await detailResponse.json();
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: auth.roles ?? []
  });
  let submittedPayload: Record<string, unknown> | null = null;
  await page.route(new RegExp(`/song-thanh/page-contents/${id}(?:\\?|$)`), async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: { page_content: { ...detail.page_content, publish_status: 'published', review_status: 'approved' } }, meta: {} })
      });
      return;
    }
    if (route.request().method() !== 'PUT') return route.continue();
    submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, data: { page_content: { ...detail.page_content, publish_status: 'unpublished', review_status: 'approved' } }, meta: {} })
    });
  });

  await page.goto(`${admin}/page-contents/${id}`);
  const title = page.getByRole('textbox', { name: 'Tiêu đề trang' });
  await expect(title).toBeVisible();
  const draftTitle = `${await title.inputValue()} bản sửa`;
  await title.fill(draftTitle);
  await page.getByRole('textbox', { name: 'Mô tả ngắn' }).fill('');
  await page.getByRole('textbox', { name: 'Lời giới thiệu trang sản phẩm' }).fill('');
  await page.getByRole('button', { name: 'Ẩn khỏi website' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ẩn khỏi website' }).click();

  await expect(page.getByRole('dialog', { name: 'Đã ẩn khỏi website' })).toBeVisible();
  expect(submittedPayload).toEqual({ publish_status: 'unpublished', expected_updated_at: expect.any(String) });
  await page.getByRole('dialog', { name: 'Đã ẩn khỏi website' }).getByRole('button', { name: 'Đóng', exact: true }).last().click();
  await expect(title).toHaveValue(draftTitle);
  await expect(page.getByText('Chưa hiển thị', { exact: true })).toBeVisible();
});

test('a visible page does not show a contradictory publish-readiness warning', async ({ page, request }) => {
  const auth = await getQaAuth(request, api);
  const headers = { Authorization: `Bearer ${auth.access_token}` };
  const listResponse = await request.get(`${api}/song-thanh/page-contents?page=1&page_size=100`, { headers });
  const { data: list } = await listResponse.json();
  const record = list.items.find((item: { slug?: string; content_type?: string; deleted_at?: string }) =>
    item.content_type === 'page' && item.slug !== 'san-pham' && !item.deleted_at
  );
  expect(record?.id).toBeTruthy();
  const id = String(record.id);
  const detailResponse = await request.get(`${api}/song-thanh/page-contents/${id}`, { headers });
  const { data: detail } = await detailResponse.json();
  await page.addInitScript((state) => {
    window.sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state));
  }, {
    accessToken: auth.access_token,
    refreshToken: auth.refresh_token,
    user: auth.user,
    permissions: auth.permissions,
    roles: auth.roles ?? []
  });
  await page.route(new RegExp(`/song-thanh/page-contents/${id}(?:\\?|$)`), async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          page_content: {
            ...detail.page_content,
            content_html: null,
            extra_blocks: { blocks: [] },
            review_status: 'approved',
            publish_status: 'published'
          }
        },
        meta: {}
      })
    });
  });

  await page.goto(`${admin}/page-contents/${id}`);
  const bar = page.locator('[data-page-lifecycle-bar="true"]');
  await expect(bar.getByText('Đang hiển thị')).toBeVisible();
  await expect(bar.locator('[data-content-readiness]')).toHaveCount(0);
  await expect(bar.getByRole('button', { name: 'Ẩn khỏi website' })).toBeEnabled();
});
