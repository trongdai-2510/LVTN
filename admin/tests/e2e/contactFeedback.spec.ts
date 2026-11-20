import { expect, test } from '@playwright/test';

const admin = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const user = { id: 'qa', email: 'qa@example.local', display_name: 'QA', status: 'active' };
const permissions = ['contact.read', 'contact.update_status'];

test('contact status reports success and a useful failure reason in popups', async ({ page }) => {
  const contact = {
    id: 'contact-qa', full_name: 'Khách thử', email: 'khach@example.local',
    status: 'new', assigned_to: null, created_at: '2026-11-16T00:00:00.000Z', deleted_at: null
  };
  let failNext = true;
  await page.addInitScript((state) => sessionStorage.setItem('song-thanh-admin-auth', JSON.stringify(state)),
    { accessToken: 'qa-token', refreshToken: null, user, permissions, roles: [] });
  await page.route('**/auth/me', (route) => route.fulfill({ json: { ok: true, data: { user, permissions, roles: [] } } }));
  await page.route('**/song-thanh/contacts/contact-qa', (route) => route.fulfill({ json: { ok: true, data: { contact } } }));
  await page.route('**/song-thanh/contacts/contact-qa/status', (route) => {
    if (failNext) {
      failNext = false;
      return route.fulfill({ status: 409, json: { ok: false, error: { code: 'CONTACT_STATUS_CONFLICT', message: 'Yêu cầu đã được người khác cập nhật.' } } });
    }
    contact.status = route.request().postDataJSON().status;
    return route.fulfill({ json: { ok: true, data: { contact } } });
  });

  await page.goto(`${admin}/admin/contacts/contact-qa`);
  const status = page.getByRole('combobox', { name: 'Trạng thái' });
  await expect(status).toHaveValue('new');
  await status.selectOption('done');
  await expect(page.getByLabel('Thông báo thao tác').getByRole('alert')).toContainText('Yêu cầu đã được người khác cập nhật.');
  await expect(status).toHaveValue('new');
  await status.selectOption('done');
  await expect(page.getByLabel('Thông báo thao tác').getByRole('status')).toContainText('Đã cập nhật trạng thái yêu cầu.');
  await expect(status).toHaveValue('done');
});
