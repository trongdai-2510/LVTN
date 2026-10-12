import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const ADMIN_BASE_PATH = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const STORAGE_KEY = 'song-thanh-admin-auth';
let qaLoginSequence = 100;

type RecordMap = Record<string, unknown>;
type AdminSession = {
  access_token: string;
  refresh_token: string;
  user: RecordMap;
  permissions: string[];
  roles: string[];
};

test('gợi ý tìm kiếm không tự che kết quả khi mở danh sách đã lọc', async ({ page, request }) => {
  const product = await firstPublishedProduct(request);
  await page.goto(`${FRONTEND_BASE_URL}/san-pham/danh-sach?q=${encodeURIComponent(String(product.name))}`);
  await expect(page.locator('[data-product-search-resolved="true"]')).toBeVisible();
  await expect(page.locator('[data-product-search-suggestions="true"]')).toBeHidden();
  await page.getByRole('main').getByRole('searchbox').focus();
  await expect(page.locator('[data-product-search-suggestions="true"]')).toBeVisible();
});

test('khách tìm sản phẩm, kiểm tra thông tin và gửi báo giá gắn đúng sản phẩm', async ({
  page,
  request
}, testInfo) => {
  test.setTimeout(120_000);
  assertSafeTarget();
  await page.setViewportSize({ width: 390, height: 844 });

  const product = await firstPublishedProduct(request);
  const runId = uniqueId('customer-quote');
  const email = `${runId}@example.com`;
  let quoteId = '';
  let session: AdminSession | null = null;

  try {
    await test.step('Tìm từ trang danh sách rồi mở đúng chi tiết sản phẩm', async () => {
      await page.goto(`${FRONTEND_BASE_URL}/san-pham/danh-sach`);
      const search = page.getByRole('main').getByRole('searchbox');
      await expect(search).toBeVisible();
      await search.fill(String(product.name));
      await search.press('Enter');
      await expect(page).toHaveURL(/\/san-pham\/danh-sach\?.*q=/);
      await expect(page.locator('[data-product-search-suggestions="true"]')).toBeHidden();

      const detailLink = page.getByRole('link', {
        name: `Xem chi tiết ${String(product.name)}`
      });
      await expect(detailLink).toBeVisible();
      await detailLink.click();
      await expect(page).toHaveURL(new RegExp(`/san-pham/${escapeRegex(String(product.slug))}$`));
      await expect(page.getByRole('heading', { name: String(product.name), level: 1 })).toBeVisible();
      await assertNoHorizontalOverflow(page, 'mobile product discovery and detail');
    });

    await test.step('Đọc thông số, tài liệu và có thể chuyển tab bằng bàn phím', async () => {
      const tabs = page.getByRole('tablist', { name: 'Nội dung chi tiết sản phẩm' });
      await expect(tabs).toBeVisible();

      const overview = page.getByRole('tab', { name: 'Tổng quan' });
      const specs = page.getByRole('tab', { name: /Thông số/ });
      const documents = page.getByRole('tab', { name: /Tài liệu/ });
      await expect(overview).toHaveAttribute('aria-selected', 'true');
      await overview.focus();
      await page.keyboard.press('ArrowRight');
      await expect(specs).toBeFocused();
      await expect(specs).toHaveAttribute('aria-selected', 'true');
      await documents.click();
      await expect(documents).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#product-detail-panel-documents')).toBeVisible();
    });

    await test.step('Form báo giá chặn dữ liệu thiếu và giữ sản phẩm đã chọn', async () => {
      await page.locator('[data-product-primary-actions] [data-quote-action="open"]').click();

      await expect(page).toHaveURL(
        new RegExp(`/san-pham/${escapeRegex(String(product.slug))}$`)
      );
      const quoteDialog = page.getByRole('dialog', { name: 'Danh sách yêu cầu' });
      await expect(quoteDialog).toBeVisible();
      await assertNoHorizontalOverflow(page, 'mobile quote dialog on product detail');
      await expect(quoteDialog.getByText(String(product.name), { exact: false })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('quoteFormRealProductMobile.png') });
      const submit = quoteDialog.getByRole('button', { name: 'Gửi yêu cầu', exact: true });
      await submit.click();
      await expect(quoteDialog.getByText('Vui lòng nhập họ và tên.')).toBeVisible();
      await expect(quoteDialog.getByLabel('Họ và tên')).toBeFocused();

      await quoteDialog.getByLabel('Họ và tên').fill(`Khách QA ${runId}`);
      await quoteDialog.getByLabel('Số điện thoại').fill('0901234567');
      await quoteDialog.getByLabel('Email').fill(email);
      await quoteDialog.getByLabel('Nội dung yêu cầu').fill('Cần tư vấn cấu hình phù hợp cho công trình.');
    });

    await test.step('Gửi thành công và xác minh bản ghi được gắn với sản phẩm đang xem', async () => {
      const createResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/public\/quote-requests(?:\?|$)/.test(response.url()) &&
          response.status() === 201
      );
      await page
        .getByRole('dialog', { name: 'Danh sách yêu cầu' })
        .getByRole('button', { name: 'Gửi yêu cầu', exact: true })
        .click();
      const response = await createResponse;
      const body = (await response.json()) as unknown;
      const quote = nestedRecord(body, 'quote_request');
      quoteId = String(quote.id || '');
      expect(quoteId, 'Public quote response must include quote_request.id').not.toBe('');
      await expect(page.getByText('Yêu cầu đã được ghi nhận.')).toBeVisible();
      await expect(page.getByRole('dialog', { name: 'Danh sách yêu cầu' }).getByRole('button', { name: 'Đóng', exact: true })).toBeFocused();

      session = await login(request);
      const detailResponse = await adminRequest(request, session, 'GET', `/song-thanh/quotes/${quoteId}`);
      expect(detailResponse.ok(), `Quote detail returned HTTP ${detailResponse.status()}`).toBe(true);
      const detail = unwrap(await detailResponse.json());
      const items = arrayFromKeys(detail, ['items', 'quote_items']);
      expect(items).toHaveLength(1);
      expect(String(recordOf(items[0]).product_group_id)).toBe(String(product.id));
    });
  } finally {
    if (quoteId && session) {
      await cleanupRequestAndCustomer(request, session, 'quotes', quoteId, email);
    }
  }
});

test('khách gửi liên hệ, kinh doanh lọc yêu cầu mới, ghi chú và khép trạng thái', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  assertSafeTarget();

  const runId = uniqueId('sales-contact');
  const fullName = `Khách sales QA ${runId}`;
  const email = `${runId}@example.com`;
  let contactId = '';
  let session: AdminSession | null = null;
  try {
    await test.step('Khách gửi liên hệ từ website và nhận xác nhận rõ ràng', async () => {
      await page.goto(`${FRONTEND_BASE_URL}/lien-he`);
      await page.getByLabel('Họ và tên').fill(fullName);
      await page.getByLabel('Số điện thoại').fill('0901234567');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Tên công ty').fill('Công ty kiểm thử Song Thanh');
      await page
        .getByLabel('Nội dung liên hệ')
        .fill('Cần tư vấn sản phẩm, xin gọi lại trong giờ hành chính.');

      const createResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/public\/contact-requests(?:\?|$)/.test(response.url()) &&
          response.status() === 201
      );
      await page.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
      const create = await createResponse;
      const contact = nestedRecord(await create.json(), 'contact_request');
      contactId = String(contact.id || '');
      expect(contactId, 'Public contact response must include contact_request.id').not.toBe('');
      await expect(page.getByText('Yêu cầu liên hệ đã được gửi thành công.')).toBeVisible();
    });

    const adminSession = await login(request);
    session = adminSession;
    await seedAuth(page, adminSession);
    await page.goto(adminPath('/contacts'));

    await test.step('Chỉ xem yêu cầu mới và mở đúng khách cần xử lý', async () => {
      await expect(page.getByRole('heading', { name: 'Liên hệ', level: 1 })).toBeVisible();
      await page.getByRole('button', { name: /^Mới/ }).click();
      const contactRow = page.getByRole('link', { name: new RegExp(escapeRegex(fullName)) });
      await expect(contactRow).toBeVisible();
      await contactRow.click();
      await expect(page).toHaveURL(new RegExp(`/contacts/${escapeRegex(contactId)}$`));
      await expect(page.getByText('Nội dung gửi kèm')).toBeVisible();
    });

    await test.step('Ghi chú nội bộ và chuyển new → in_progress → done', async () => {
      const note = `Đã gọi xác minh nhu cầu, mã QA ${runId}.`;
      await page.getByPlaceholder('Ghi chú nội bộ...').fill(note);
      await page.getByRole('button', { name: 'Gửi ghi chú' }).click();
      await expect(page.getByText(note)).toBeVisible();

      const status = page.getByLabel('Trạng thái');
      await status.selectOption('in_progress');
      await expect(status).toHaveValue('in_progress');
      const doneResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          response.url().endsWith(`/song-thanh/contacts/${contactId}/status`) &&
          response.request().postDataJSON()?.status === 'done' &&
          response.ok()
      );
      await status.selectOption('done');
      await doneResponse;
      await expect(status).toHaveValue('done');
    });

    await test.step('Kiểm tra trạng thái và ghi chú đã được lưu ở API', async () => {
      const detailResponse = await adminRequest(request, adminSession, 'GET', `/song-thanh/contacts/${contactId}`);
      expect(detailResponse.ok()).toBe(true);
      const detail = unwrap(await detailResponse.json());
      expect(nestedRecord(detail, 'contact').status).toBe('done');
      const notes = arrayFromKeys(detail, ['internal_notes', 'contact_internal_notes', 'notes']);
      expect(notes.some((item) => String(recordOf(item).note_text) === `Đã gọi xác minh nhu cầu, mã QA ${runId}.`)).toBe(true);
    });

    await test.step('Lưu trữ từ mobile có vùng chạm an toàn và quay về đúng danh sách admin', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      const archiveButton = page.getByRole('button', { name: 'Lưu trữ yêu cầu' });
      const archiveBox = await archiveButton.boundingBox();
      expect.soft(archiveBox, 'archive action must have a measurable touch target').not.toBeNull();
      expect.soft(archiveBox?.height ?? 0).toBeGreaterThanOrEqual(44);
      await archiveButton.click();
      const dialog = page.getByRole('dialog', { name: 'Lưu trữ yêu cầu này?' });
      await dialog.getByRole('button', { name: 'Lưu trữ', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${escapeRegex(adminPath('/contacts'))}(?:\\?.*)?$`));
    });
  } finally {
    if (contactId && session) {
      await cleanupRequestAndCustomer(request, session, 'contacts', contactId, email);
    }
  }
});

test('nhân viên chỉ xem liên hệ chỉ thấy đúng phần việc, không thể đi vòng qua deep-link hoặc API', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  assertSafeTarget();

  const adminSession = await login(request);
  const runId = uniqueId('contact-viewer');
  const contactName = `Khách quyền xem ${runId}`;
  const email = `${runId}@example.com`;
  const password = 'ViewerQA123!';
  let contactId = '';

  try {
    const publicResponse = await request.post(`${API_BASE_URL}/public/contact-requests`, {
      headers: { 'X-Forwarded-For': nextQaLoginAddress() },
      data: {
        full_name: contactName,
        phone: '0901234567',
        email,
        message: 'Bản ghi dùng để xác nhận trải nghiệm chỉ xem của nhân viên.'
      }
    });
    expect(publicResponse.status()).toBe(201);
    contactId = String(nestedRecord(await publicResponse.json(), 'contact_request').id || '');
    expect(contactId).not.toBe('');

    const createRoleResponse = await adminRequest(request, adminSession, 'POST', '/song-thanh/admin-roles', {
      name: `Nhân viên xem liên hệ ${runId}`,
      description: 'Tài khoản QA chỉ có quyền đọc liên hệ.'
    });
    expect(createRoleResponse.ok()).toBe(true);
    const roleId = String(nestedRecord(await createRoleResponse.json(), 'role').id || '');
    expect(roleId).not.toBe('');

    const setPermissionsResponse = await adminRequest(
      request,
      adminSession,
      'PUT',
      `/song-thanh/admin-roles/${roleId}/permissions`,
      { permission_codes: ['contact.read'] }
    );
    expect(setPermissionsResponse.ok()).toBe(true);

    const createUserResponse = await adminRequest(request, adminSession, 'POST', '/song-thanh/admin-users', {
      display_name: `QA Contact Viewer ${runId}`,
      email,
      temporary_password: password,
      role_ids: [roleId],
      status: 'active'
    });
    expect(createUserResponse.ok()).toBe(true);
    const userId = String(nestedRecord(await createUserResponse.json(), 'user').id || '');
    expect(userId).not.toBe('');

    const viewerSession = await loginWithCredentials(request, email, password);
    expect(viewerSession.permissions).toContain('contact.read');
    expect(viewerSession.permissions).not.toContain('contact.update_status');

    await seedAuth(page, viewerSession);
    await page.goto(adminPath(`/contacts/${contactId}`));
    await expect(page.getByRole('heading', { name: contactName, level: 1 })).toBeVisible();

    const sidebar = page.locator('[data-admin-sidebar="true"]');
    await expect(sidebar.getByRole('link', { name: 'Liên hệ', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Sản phẩm', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Trạng thái')).toHaveCount(0);
    await expect(page.getByText('Vai trò hiện tại chỉ có quyền xem, không thể cập nhật trạng thái.')).toBeVisible();
    await expect(page.getByText('Vai trò hiện tại không có quyền thêm ghi chú nội bộ.')).toBeVisible();
    await expect(page.getByPlaceholder('Ghi chú nội bộ...')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await assertNoHorizontalOverflow(page, 'mobile read-only contact workbench');
    const mobileMenuTrigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
    await mobileMenuTrigger.click();
    const mobileMenu = page.getByRole('dialog', { name: 'Điều hướng quản trị' });
    await expect(mobileMenu.getByRole('link', { name: 'Liên hệ', exact: true })).toBeVisible();
    await expect(mobileMenu.getByRole('link', { name: 'Sản phẩm', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');

    const blockedMutation = await adminRequest(
      request,
      viewerSession,
      'PUT',
      `/song-thanh/contacts/${contactId}/status`,
      { status: 'done' }
    );
    expect(blockedMutation.status()).toBe(403);

    await page.goto(adminPath('/product-groups'));
    await expect(page.getByRole('heading', { name: 'Không đủ quyền truy cập', level: 1 })).toBeVisible();
  } finally {
    if (contactId) {
      await cleanupRequestAndCustomer(request, adminSession, 'contacts', contactId, email);
    }
  }
});

test('quản trị sản phẩm tạo bản nháp, thêm biến thể và không thể vô tình xuất bản khi thiếu điều kiện', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  assertSafeTarget();

  const session = await login(request);
  const runId = uniqueId('catalog-editor');
  const productName = `Sản phẩm QA ${runId}`;
  const variantName = `Biến thể QA ${runId}`;
  let productId = '';

  try {
    await seedAuth(page, session);
    await page.goto(adminPath('/product-groups/new'));
    await expect(page.getByRole('heading', { name: 'Tạo mới sản phẩm', level: 1 })).toBeVisible();

    await test.step('Tạo nhóm sản phẩm chỉ với cấu trúc bắt buộc', async () => {
      await page.getByLabel('Tên sản phẩm').fill(productName);

      await selectAvailableCategoryPair(page);
      await page.getByRole('button', { name: 'Tạo bản ghi' }).click();
      await expect(page).toHaveURL(new RegExp(`${ADMIN_BASE_PATH}/product-groups/[0-9a-f-]+$`, 'i'));
      productId = page.url().split('/').at(-1) || '';
      expect(productId).not.toBe('');

      const successDialog = page.getByRole('dialog', { name: 'Tạo thành công' });
      await expect(successDialog).toBeVisible();
      await successDialog.getByRole('button', { name: 'Tiếp tục hoàn thiện' }).click();
      await expect(successDialog).toBeHidden();
    });

    await test.step('Phiên quản trị cũ bị chặn ghi đè và nhận hướng dẫn tải lại rõ ràng', async () => {
      const stalePage = await page.context().newPage();
      try {
        await seedAuth(stalePage, session);
        await stalePage.goto(adminPath(`/product-groups/${productId}`));
        await expect(stalePage.getByLabel('Tên sản phẩm')).toHaveValue(productName);

        const beforeResponse = await adminRequest(
          request,
          session,
          'GET',
          `/song-thanh/product-groups/${productId}`
        );
        expect(beforeResponse.ok()).toBe(true);
        const before = nestedRecord(await beforeResponse.json(), 'product_group');
        const expectedUpdatedAt = String(before.updated_at || '');
        expect(expectedUpdatedAt).not.toBe('');

        const winnerDescription = `Phiên mới ${runId}`;
        const winnerResponse = await adminRequest(
          request,
          session,
          'PUT',
          `/song-thanh/product-groups/${productId}`,
          {
            seo_description: winnerDescription,
            expected_updated_at: expectedUpdatedAt
          }
        );
        expect(winnerResponse.ok()).toBe(true);

        await stalePage.getByLabel('Tên sản phẩm').fill(`${productName} bản cũ`);
        await stalePage.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
        const conflictDialog = stalePage.getByRole('dialog', {
          name: 'Dữ liệu sản phẩm đã được cập nhật ở nơi khác'
        });
        await expect(conflictDialog).toBeVisible();
        await expect(
          conflictDialog.getByText(
            'Bản đang mở không còn là phiên bản mới nhất nên hệ thống đã chặn ghi đè để tránh mất dữ liệu.'
          )
        ).toBeVisible();
        await expect(
          conflictDialog.getByText(/Tải lại trang để nhận dữ liệu mới nhất/)
        ).toBeVisible();

        const retainedResponse = await adminRequest(
          request,
          session,
          'GET',
          `/song-thanh/product-groups/${productId}`
        );
        const retained = nestedRecord(await retainedResponse.json(), 'product_group');
        expect(retained.name).toBe(productName);
        expect(retained.seo_description).toBe(winnerDescription);
      } finally {
        await stalePage.close();
      }

      await page.reload();
      await expect(page.getByLabel('Tên sản phẩm')).toHaveValue(productName);
    });

    await test.step('Thêm biến thể có giá công khai bằng form có nhãn truy cập được', async () => {
      await page.getByRole('navigation', { name: 'Khu vực sản phẩm' })
        .getByRole('link', { name: 'Biến thể / SKU', exact: true }).click();
      await expect(page).toHaveURL(/(?:\?|&)view=variants(?:&|$)/);
      await page.getByRole('button', { name: 'Thêm biến thể / SKU', exact: true }).click();
      let dialog = page.getByRole('dialog', { name: 'Thêm biến thể' });
      await expect(dialog).toBeVisible();

      await dialog.getByLabel('Tên biến thể').fill(`Bản nháp ${runId}`);
      await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
      const discardDialog = page.getByRole('dialog', { name: 'Bỏ thay đổi biến thể?' });
      await expect(discardDialog).toBeVisible();
      await discardDialog.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
      await expect(dialog).toBeHidden();

      await page.getByRole('button', { name: 'Thêm biến thể / SKU', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Thêm biến thể' });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('Tên biến thể').fill(variantName);
      await dialog.getByLabel('Cách hiển thị giá').selectOption('public_price');
      await expect(dialog.getByLabel('Giá công khai (đồng)')).toBeEnabled();
      await dialog.getByLabel('Giá công khai (đồng)').fill('1250000');
      await expect(dialog.getByText(/Xem trước: 1\.250\.000/)).toBeVisible();
      await dialog.getByLabel('Mã model').fill(`MODEL-${runId}`);
      await dialog.getByRole('button', { name: 'Thêm biến thể', exact: true }).click();
      await expect(dialog).toBeHidden();

      await page.getByRole('button', { name: 'Thêm biến thể / SKU', exact: true }).click();
      dialog = page.getByRole('dialog', { name: 'Thêm biến thể' });
      await dialog.getByLabel('Tên biến thể').fill(variantName);
      await dialog.getByLabel('Mã model').fill(`MODEL-ALT-${runId}`);
      await dialog.getByRole('button', { name: 'Thêm biến thể', exact: true }).click();
      await expect(dialog).toBeHidden();

      const variantTriggers = page.locator('[data-variant-workspace-trigger="true"]');
      await expect(variantTriggers).toHaveCount(2);
      const accessibleNames = await variantTriggers.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('aria-label') || '')
      );
      expect(new Set(accessibleNames).size).toBe(2);
      expect(accessibleNames.some((name) => name.includes(`MODEL-${runId}`))).toBe(true);
      expect(accessibleNames.some((name) => name.includes(`MODEL-ALT-${runId}`))).toBe(true);

      await page.getByRole('link', { name: 'Tài liệu', exact: true }).click();
      await expect(page).toHaveURL(/(?:\?|&)view=documents(?:&|$)/);
      const documentDetails = page
        .locator('details')
        .filter({ hasText: 'Thêm tài liệu kỹ thuật' });
      await documentDetails.locator('summary').click();
      const documentVariantOptions = documentDetails
        .getByLabel('Phạm vi áp dụng')
        .locator('option');
      await expect(
        documentVariantOptions.filter({ hasText: `Model MODEL-${runId}` })
      ).toHaveCount(1);
      await expect(
        documentVariantOptions.filter({ hasText: `Model MODEL-ALT-${runId}` })
      ).toHaveCount(1);
    });

    await test.step('Luồng duyệt tách khỏi xuất bản và bản ghi thiếu điều kiện không lộ ra website', async () => {
      await page.getByRole('link', { name: 'Thông tin', exact: true }).click();
      await expect(page.locator('#product-group-main #product-group-display')).toBeVisible();
      await page.getByRole('button', { name: 'Gửi duyệt', exact: true }).click();
      await expect(page.getByText('Đã gửi nội dung để duyệt.')).toBeVisible();

      await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
      await expect(
        page.getByText('Đã duyệt nội dung. Có thể xuất bản khi đủ điều kiện.')
      ).toBeVisible();

      const publish = page.getByRole('button', { name: 'Xuất bản', exact: true });
      await expect(publish).toBeDisabled();
      await expect(page.getByText('Chưa thể xuất bản.')).toBeVisible();

      const detailResponse = await adminRequest(request, session, 'GET', `/song-thanh/product-groups/${productId}`);
      expect(detailResponse.ok()).toBe(true);
      const product = nestedRecord(await detailResponse.json(), 'product_group');
      const slug = String(product.slug || '');
      expect(slug).not.toBe('');
      const publicResponse = await request.get(
        `${API_BASE_URL}/public/product-groups/${encodeURIComponent(slug)}`
      );
      expect(publicResponse.status()).toBe(404);
    });
  } finally {
    if (productId) {
      const variantsResponse = await adminRequest(
        request,
        session,
        'GET',
        `/song-thanh/product-variants?product_group_id=${encodeURIComponent(productId)}&deleted_scope=active&page=1&page_size=100`
      );
      if (variantsResponse.ok()) {
        const variantItems = arrayFromKeys(unwrap(await variantsResponse.json()), ['items']);
        for (const variant of variantItems.map(recordOf)) {
          if (!variant.id) continue;
          await adminRequest(
            request,
            session,
            'POST',
            `/song-thanh/product-variants/${String(variant.id)}/archive`,
            {}
          ).catch(() => undefined);
        }
      }
      await adminRequest(
        request,
        session,
        'POST',
        `/song-thanh/product-groups/${productId}/archive`,
        {}
      ).catch(() => undefined);
    }
  }
});

test('quản lý nhập dữ liệu tải workbook, xác nhận mapping và chỉ tạo dữ liệu tạm để duyệt', async ({
  page,
  request
}) => {
  test.setTimeout(120_000);
  assertSafeTarget();

  const session = await login(request);
  const runId = uniqueId('import-manager');
  let batchId = '';

  try {
    await seedAuth(page, session);
    await page.goto(adminPath('/import/new'));
    await expect(page.getByRole('heading', { name: 'Tạo lô nhập', level: 1 })).toBeVisible();

    await test.step('Tải workbook bằng giao diện và xem trước mapping trước khi có dữ liệu tạm', async () => {
      await page.getByLabel('Tên lô').fill(`Lô QA ${runId}`);
      await expect(page.locator('[data-import-upload-dropzone="true"]')).toContainText('tối đa 20 MB');
      await page.locator('[data-import-upload-file="true"]').setInputFiles({
        name: `catalog-${runId}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from('not a supported workbook')
      });
      await expect(page.getByText(/chỉ chọn Excel \.xlsx hoặc CSV \.csv/i)).toBeVisible();
      await expect(page.locator('[data-import-upload-submit="true"]')).toBeDisabled();

      await page.locator('[data-import-upload-file="true"]').setInputFiles({
        name: `catalog-${runId}.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(
          [
            [
              'Category Main', 'Category Sub', 'Product Group', 'Variant',
              'Thông số mới',
              ...Array.from({ length: 43 }, (_, index) => `Cột khác ${index + 1}`)
            ].join(','),
            [
              `QA Main ${runId}`, `QA Sub ${runId}`,
              `QA Group ${runId}`, `QA Variant ${runId}`, '100W',
              ...Array.from({ length: 43 }, () => 'không nhập')
            ].join(',')
          ].join('\n')
        )
      });

      const uploadResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/song-thanh\/import-batches\/upload(?:\?|$)/.test(response.url()) &&
          response.status() === 200
      );
      await page.locator('[data-import-upload-submit="true"]').click();
      await uploadResponse;
      await expect(page).toHaveURL(new RegExp(`${ADMIN_BASE_PATH}/import/[0-9a-f-]+$`, 'i'));
      batchId = page.url().split('/').at(-1) || '';
      expect(batchId, 'Workbook upload must navigate to the created import batch').not.toBe('');
      await expect(page.getByRole('heading', { name: 'Xác nhận cột dữ liệu' })).toBeVisible();
      await expect(page.getByText('Tên sản phẩm (dùng chung)', { exact: true })).toBeVisible();
      await expect(page.getByText('Tên biến thể', { exact: true })).toBeVisible();
      await expect(page.getByText('Mỗi sản phẩm chỉ có một cấu hình', { exact: true })).toBeVisible();
      await expect(page.locator('[data-import-required-role="category_main_column"]')).toHaveValue('Category Main');
      await expect(page.locator('[data-import-required-role="category_sub_column"]')).toHaveValue('Category Sub');
      await expect(page.locator('[data-import-required-role="product_group_column"]')).toHaveValue('Product Group');
      await expect(page.locator('[data-import-required-role="product_variant_column"]')).toHaveValue('Variant');
      const flatProductMode = page.locator('[data-import-flat-product-mode="true"]');
      await flatProductMode.check();
      await expect(page.locator('[data-import-required-role="product_variant_column"]')).toBeDisabled();
      await expect(page.locator('[data-import-required-role="product_variant_column"]')).toHaveValue('Product Group');
      await flatProductMode.uncheck();
      await expect(page.locator('[data-import-required-role="product_variant_column"]')).toBeEnabled();
      await page.locator('[data-import-required-role="product_variant_column"]').selectOption('Variant');
      const categoryMain = page.locator('[data-import-required-role="category_main_column"]');
      await categoryMain.selectOption('');
      await page.locator('[data-import-mapping-submit="true"]').click();
      await expect(page.locator('[data-import-mapping-error="true"]')).toContainText(
        'Chưa chọn cột “Danh mục chính”'
      );
      await expect(categoryMain).toBeFocused();
      await categoryMain.selectOption('Category Main');
      await page.locator('[data-import-mapping-submit="true"]').click();
      await expect(page.locator('[data-import-mapping-error="true"]')).toContainText(
        'Còn 44 cột chưa xử lý'
      );
      await expect(page.locator('[data-import-flexible-column]')).toHaveCount(20);
      await page.getByRole('button', { name: 'Tiếp' }).click();
      await expect(page.getByText('Trang 2 / 3')).toBeVisible();
      await page.locator('[data-import-column-search="true"]').fill('thong so moi');
      await expect(page.locator('[data-import-flexible-column]')).toHaveCount(1);
      await page.getByRole('button', { name: 'Giữ 1 cột làm thuộc tính' }).click();
      await page.locator('[data-import-column-search="true"]').fill('');
      await expect(page.locator('[data-import-column-view="true"]')).toHaveValue('unmapped');
      await page.getByRole('button', { name: 'Bỏ qua 43 cột' }).click();
      await expect(page.locator('[data-import-column-bulk-actions="true"]')).toHaveCount(0);
      await expect(page.locator('[data-import-mapping-submit="true"]')).toBeVisible();
      await expect(page.locator('[data-import-review-panel]')).toHaveCount(0);
    });

    await test.step('Xác nhận mapping, chuyển sang vùng duyệt và không hiển thị thao tác áp dụng sớm', async () => {
      const mappingResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new RegExp(`/song-thanh/import-batches/${escapeRegex(batchId)}/confirm-mapping(?:\\?|$)`).test(
            response.url()
          ) &&
          response.status() === 200
      );
      await page.locator('[data-import-mapping-submit="true"]').click();
      await mappingResponse;
      await expect(page.locator('[data-import-review-panel="groups"]')).toBeVisible();
      await expect(page.locator('[data-import-review-panel="variants"]')).toHaveCount(0);
      await expect(page.locator('[data-import-apply-button="true"]')).toHaveCount(0);
    });

    await test.step('Đối chiếu backend: workbook chỉ đi vào staging, chưa xuất hiện thành sản phẩm chính thức', async () => {
      const detailResponse = await adminRequest(request, session, 'GET', `/song-thanh/import-batches/${batchId}`);
      expect(detailResponse.ok()).toBe(true);
      const detail = unwrap(await detailResponse.json());
      expect(String(detail.workflow_stage || '')).not.toBe('mapping');

      const groupsResponse = await adminRequest(
        request,
        session,
        'GET',
        `/song-thanh/import-batches/${batchId}/pending-product-groups?page=1&page_size=25`
      );
      expect(groupsResponse.ok()).toBe(true);
      const stagedGroups = arrayFromKeys(unwrap(await groupsResponse.json()), ['items']);
      expect(stagedGroups).toHaveLength(1);
      expect(String(recordOf(stagedGroups[0]).product_name)).toBe(`QA Group ${runId}`);

      const publicResponse = await request.get(
        `${API_BASE_URL}/public/product-groups?page=1&page_size=40&q=${encodeURIComponent(`QA Group ${runId}`)}`
      );
      expect(publicResponse.ok()).toBe(true);
      const publicItems = arrayFromKeys(unwrap(await publicResponse.json()), ['items', 'product_groups']);
      expect(publicItems.some((item) => String(recordOf(item).name) === `QA Group ${runId}`)).toBe(false);
    });
  } finally {
    if (batchId) {
      await adminRequest(request, session, 'DELETE', `/song-thanh/import-batches/${batchId}`).catch(() => undefined);
    }
  }
});

test('nhập Excel nhiều sheet giữ đúng sheet đã chọn khi xem trước và tạo dữ liệu tạm', async ({ page, request }) => {
  test.setTimeout(120_000);
  assertSafeTarget();
  const session = await login(request);
  const runId = uniqueId('import-sheet');
  let batchId = '';
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Ghi chú').addRows([['Nội dung'], ['Không nhập dòng này']]);
  workbook.addWorksheet('Sản phẩm').addRows([
    ['Category Main', 'Category Sub', 'Product Group', 'Variant'],
    [`QA Main ${runId}`, `QA Sub ${runId}`, `QA Group ${runId}`, `QA Variant ${runId}`]
  ]);
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  try {
    await seedAuth(page, session);
    await page.goto(adminPath('/import/new'));
    await page.locator('[data-import-upload-file="true"]').setInputFiles({
      name: `catalog-${runId}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer
    });
    const sheetSelect = page.locator('[data-import-sheet-select="true"]');
    await expect(sheetSelect).toBeVisible();
    await expect(sheetSelect.locator('option')).toHaveCount(3);
    await expect(page.locator('[data-import-upload-submit="true"]')).toBeDisabled();
    await sheetSelect.selectOption('Sản phẩm');
    await expect(page.locator('[data-import-upload-submit="true"]')).toBeEnabled();
    await page.locator('[data-import-upload-submit="true"]').click();
    await expect(page).toHaveURL(new RegExp(`${ADMIN_BASE_PATH}/import/[0-9a-f-]+$`, 'i'));
    batchId = page.url().split('/').at(-1) || '';
    await expect(page.locator('[data-import-required-role="product_group_column"]')).toHaveValue('Product Group');

    const detailResponse = await adminRequest(request, session, 'GET', `/song-thanh/import-batches/${batchId}`);
    expect(detailResponse.ok()).toBe(true);
    const detail = unwrap(await detailResponse.json());
    expect(recordOf(detail.batch).source_sheet_name).toBe('Sản phẩm');
    expect(recordOf(detail.preview).sheet_name).toBe('Sản phẩm');
    expect(recordOf((recordOf(detail.preview).sample_rows as RecordMap[])[0]).cells).toMatchObject({
      'Product Group': `QA Group ${runId}`
    });

    await page.locator('[data-import-mapping-submit="true"]').click();
    await expect(page.locator('[data-import-review-panel="groups"]')).toBeVisible();
    const groupsResponse = await adminRequest(
      request, session, 'GET', `/song-thanh/import-batches/${batchId}/pending-product-groups?page=1&page_size=25`
    );
    expect(groupsResponse.ok()).toBe(true);
    const groups = arrayFromKeys(unwrap(await groupsResponse.json()), ['items']);
    expect(groups).toHaveLength(1);
    expect(recordOf(groups[0]).product_name).toBe(`QA Group ${runId}`);
  } finally {
    if (batchId) {
      await adminRequest(request, session, 'DELETE', `/song-thanh/import-batches/${batchId}`).catch(() => undefined);
    }
  }
});

function normalizeAdminBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminPath(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${ADMIN_BASE_PATH}${normalized}`;
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function recordOf(value: unknown): RecordMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordMap) : {};
}

function unwrap(value: unknown): RecordMap {
  const record = recordOf(value);
  return 'data' in record ? recordOf(record.data) : record;
}

function nestedRecord(value: unknown, key: string): RecordMap {
  const unwrapped = unwrap(value);
  return recordOf(unwrapped[key]).id ? recordOf(unwrapped[key]) : unwrapped;
}

function arrayFromKeys(value: RecordMap, keys: string[]): unknown[] {
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key] as unknown[];
  }
  return [];
}

async function firstPublishedProduct(request: APIRequestContext): Promise<RecordMap> {
  const response = await request.get(`${API_BASE_URL}/public/product-groups?page=1&page_size=20`);
  expect(response.ok(), `Public product list returned HTTP ${response.status()}`).toBe(true);
  const list = unwrap(await response.json());
  const candidates = arrayFromKeys(list, ['items', 'product_groups']);
  const product = candidates.map(recordOf).find((item) => item.id && item.slug && item.name);
  expect(product, 'QA needs at least one published product group').toBeTruthy();
  return product!;
}

async function login(request: APIRequestContext): Promise<AdminSession> {
  return loginWithCredentials(request, ADMIN_EMAIL, ADMIN_PASSWORD);
}

async function loginWithCredentials(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<AdminSession> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    // Each journey models a separate internal user session. Reusing one test
    // address would intentionally trigger the production login rate limit and
    // make unrelated cross-browser tests fail for the wrong reason.
    headers: { 'X-Forwarded-For': nextQaLoginAddress() },
    data: { email, password }
  });
  expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBe(true);
  const payload = unwrap(await response.json());
  const session = payload as Omit<AdminSession, 'roles'>;
  const meResponse = await request.get(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` }
  });
  expect(meResponse.ok(), `Auth me failed with HTTP ${meResponse.status()}`).toBe(true);
  const me = unwrap(await meResponse.json());
  return {
    ...session,
    roles: Array.isArray(me.roles) ? me.roles.map(String) : []
  };
}

function nextQaLoginAddress(): string {
  qaLoginSequence += 1;
  return `192.0.2.${qaLoginSequence}`;
}

async function seedAuth(page: Page, session: AdminSession): Promise<void> {
  await page.addInitScript(
    ({ storageKey, state }) => window.sessionStorage.setItem(storageKey, JSON.stringify(state)),
    {
      storageKey: STORAGE_KEY,
      state: {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        user: session.user,
        permissions: session.permissions,
        roles: session.roles
      }
    }
  );
}

function adminRequest(
  request: APIRequestContext,
  session: AdminSession,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  pathname: string,
  data?: RecordMap
) {
  return request.fetch(`${API_BASE_URL}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${session.access_token}` },
    data
  });
}

async function cleanupRequestAndCustomer(
  request: APIRequestContext,
  session: AdminSession,
  kind: 'contacts' | 'quotes',
  requestId: string,
  email: string
): Promise<void> {
  if (requestId) {
    await adminRequest(request, session, 'POST', `/song-thanh/${kind}/${requestId}/archive`, {}).catch(
      () => undefined
    );
    await adminRequest(request, session, 'DELETE', `/song-thanh/${kind}/${requestId}/permanent`).catch(
      () => undefined
    );
  }

  const customers = await adminRequest(
    request,
    session,
    'GET',
    `/song-thanh/customers?q=${encodeURIComponent(email)}&deleted_scope=all&page=1&page_size=100`
  );
  if (!customers.ok()) return;
  const records = arrayFromKeys(unwrap(await customers.json()), ['items', 'customers']);
  await Promise.all(
    records
      .map(recordOf)
      .filter((customer) => String(customer.email || '').toLowerCase() === email.toLowerCase())
      .map(async (customer) => {
        const id = String(customer.id || '');
        if (!id) return;
        if (!customer.deleted_at) {
          await adminRequest(request, session, 'POST', `/song-thanh/customers/${id}/archive`, {}).catch(
            () => undefined
          );
        }
        await adminRequest(request, session, 'DELETE', `/song-thanh/customers/${id}/permanent`).catch(
          () => undefined
        );
      })
  );
}

function assertSafeTarget(): void {
  const hostname = new URL(API_BASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname) && process.env.ALLOW_QA_MUTATIONS !== '1') {
    throw new Error(`Refusing to mutate non-local API ${API_BASE_URL}.`);
  }
}

async function assertNoHorizontalOverflow(page: Page, surface: string): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(
    dimensions.scrollWidth,
    `${surface} horizontally overflows: ${JSON.stringify(dimensions)}`
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function selectAvailableCategoryPair(page: Page): Promise<void> {
  const primaryCategory = page.getByLabel('Danh mục chính');
  const childCategory = page.getByLabel('Danh mục con');
  const primaryValues = await primaryCategory.locator('option').evaluateAll((options) =>
    options.map((option) => option.getAttribute('value') || '').filter(Boolean)
  );

  for (const primaryValue of primaryValues) {
    await primaryCategory.selectOption(primaryValue);
    // The available subcategories are derived locally after the parent change.
    // Give React a render turn, then select only an actually available child.
    await page.waitForTimeout(50);
    if (await childCategory.locator('option').count() > 1) {
      await childCategory.selectOption({ index: 1 });
      return;
    }
  }

  throw new Error('QA fixture has no active main-category / subcategory pair for product creation.');
}
