import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const storageKey = 'song-thanh-admin-auth';
let cachedAdminState: { accessToken: string; refreshToken: string; user: unknown; permissions: string[]; roles: string[] } | null = null;

async function seedAdmin(page: Page, request: APIRequestContext) {
  if (!cachedAdminState) {
    const response = await request.post(`${apiBaseUrl}/auth/login`, {
      data: {
        email: process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local',
        password: process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!'
      }
    });
    expect(response.ok(), `Login failed: HTTP ${response.status()}`).toBe(true);
    const payload = (await response.json()) as { data: { access_token: string; refresh_token: string; user: unknown; permissions: string[]; roles: string[] } };
    cachedAdminState = {
      accessToken: payload.data.access_token,
      refreshToken: payload.data.refresh_token,
      user: payload.data.user,
      permissions: payload.data.permissions,
      roles: payload.data.roles
    };
  }
  await page.addInitScript(({ key, state }) => window.sessionStorage.setItem(key, JSON.stringify(state)), {
    key: storageKey,
    state: cachedAdminState
  });
}

for (const width of [1440, 320]) {
  test(`media assistant renders its read-only entry at ${width}px`, async ({ page, request }, testInfo) => {
    await seedAdmin(page, request);
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/admin/media');
    await expect(page.getByRole('heading', { name: 'Duyệt ảnh & PDF' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chưa có file nào để duyệt' })).toBeVisible();
    await expect(page.getByText('Liên kết với lô Excel')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`media-start-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Mở trợ lý để gửi ảnh/PDF' }).click();
    await expect(page.getByRole('dialog', { name: 'Trợ lý sản phẩm' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`media-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: 'Đóng trợ lý' }).click();
    await expect(page.getByRole('dialog', { name: 'Trợ lý sản phẩm' })).toHaveCount(0);
  });
}

test('robot opens from another admin page', async ({ page, request }, testInfo) => {
  await seedAdmin(page, request);
  await page.goto('/admin/dashboard');
  const launcher = page.getByRole('button', { name: 'Mở trợ lý sản phẩm' });
  await expect(launcher).toBeVisible();
  const liveRobot = launcher.locator('[data-ready="true"] canvas');
  await expect(liveRobot).toBeVisible({ timeout: 15_000 });
  const firstFrame = await liveRobot.screenshot();
  await page.waitForTimeout(350);
  expect((await liveRobot.screenshot()).equals(firstFrame)).toBe(false);
  await launcher.hover();
  await expect(launcher).toHaveAttribute('data-active', 'true');
  await expect(launcher.locator('[data-state]')).toHaveAttribute('data-state', 'listening');
  await expect(liveRobot).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard-launcher.png'), animations: 'disabled' });
  await launcher.screenshot({ path: testInfo.outputPath('mascot-launcher-desktop.png'), animations: 'disabled' });
  await launcher.click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await expect(assistant.getByRole('heading', { level: 3 })).toBeVisible();
  await expect(assistant.getByRole('button', { name: 'Sản phẩm nào thiếu tài liệu kỹ thuật?' })).toBeInViewport();
  const desktopBounds = await assistant.boundingBox();
  expect(desktopBounds).not.toBeNull();
  expect(desktopBounds!.height).toBeLessThanOrEqual(860);
  expect(desktopBounds!.x).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('assistant-open-dashboard-desktop.png'), animations: 'disabled' });
  const robot = assistant.getByRole('img', { name: 'Robot trợ lý' });
  await expect.poll(() => robot.locator('img').evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(robot.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(robot).toHaveAttribute('data-ready', 'true');
  await assistant.screenshot({ path: testInfo.outputPath('assistant-conversation-start-desktop.png'), animations: 'disabled' });
  await assistant.getByRole('button', { name: 'Đóng trợ lý' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).screenshot({ path: testInfo.outputPath('mascot-launcher-mobile.png'), animations: 'disabled' });
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  await expect(page.getByRole('dialog', { name: 'Trợ lý sản phẩm' })).toBeVisible();
  await expect.poll(() => page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).evaluate((element) => Math.round(element.getBoundingClientRect().left))).toBe(0);
  await expect.poll(() => page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(390);
  await expect.poll(() => page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).evaluate((element) => Math.round(element.getBoundingClientRect().height))).toBe(844);
  const mobileRobot = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).getByRole('img', { name: 'Robot trợ lý' });
  await expect(mobileRobot.locator('canvas')).toBeVisible({ timeout: 15_000 });
  await expect(mobileRobot).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => mobileRobot.locator('img').evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('assistant-open-mobile.png'), animations: 'disabled' });
  await expect(page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).getByRole('button', { name: 'Chọn ảnh hoặc PDF' })).toBeVisible();
  await expect(page.getByLabel('Hỏi trợ lý sản phẩm')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(mobileRobot.locator('canvas')).toBeHidden();
  await expect(mobileRobot.locator('img')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Trợ lý sản phẩm' })).toHaveCount(0);
});

test('an old file batch does not take over a new product question', async ({ page, request }) => {
  await seedAdmin(page, request);
  const batchId = '00000000-0000-4000-8000-000000000121';
  let batchQuestions = 0;
  const projectQuestions: Array<{ question: string; history?: Array<{ role: string; text: string }> }> = [];
  const respond = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  await page.route('**/song-thanh/media-batches**', (route) => {
    const suffix = new URL(route.request().url()).pathname.replace('/song-thanh/media-batches', '');
    if (route.request().method() === 'GET' && suffix === '/local-ai/status') return route.fulfill(respond({ available: false, busy: false, model: 'local', locality: 'localhost', message: 'Ollama chưa chạy.' }));
    if (route.request().method() === 'GET' && !suffix) return route.fulfill(respond({ items: [{ id: batchId, batch_name: 'Lượt cũ', status: 'open', item_count: 1, import_batch_id: null }] }));
    if (route.request().method() === 'POST' && suffix === '/assistant/ask') {
      projectQuestions.push(route.request().postDataJSON());
      return route.fulfill(respond({ answer: 'Có 516 sản phẩm thiếu ảnh.', products: [], model: 'project-data' }));
    }
    if (route.request().method() === 'POST' && suffix === `/${batchId}/ask`) batchQuestions += 1;
    return route.fulfill({ status: 404, body: 'Unexpected batch request' });
  });
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.getByRole('button', { name: 'Sản phẩm nào thiếu ảnh?' }).click();
  await expect(assistant.getByText('Có 516 sản phẩm thiếu ảnh.')).toBeVisible();
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Còn tài liệu thì sao?');
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').press('Enter');
  await expect(assistant.getByText('Có 516 sản phẩm thiếu ảnh.')).toHaveCount(2);
  await expect(assistant.getByRole('button', { name: 'Chọn thư mục ảnh/PDF' })).toBeVisible();
  expect(projectQuestions[1]?.history).toEqual([
    { role: 'user', text: 'Sản phẩm nào thiếu ảnh?' },
    { role: 'assistant', text: 'Có 516 sản phẩm thiếu ảnh.' }
  ]);
  expect(batchQuestions).toBe(0);
});

test('a content code conflict clears the suggested attachment until admin chooses a product', async ({ page, request }) => {
  await seedAdmin(page, request);
  const batchId = '00000000-0000-4000-8000-000000000141';
  const itemId = '00000000-0000-4000-8000-000000000142';
  const groupId = '00000000-0000-4000-8000-000000000143';
  const batch = { id: batchId, batch_name: 'Kiểm tra mã mâu thuẫn', import_batch_id: null, status: 'open', created_at: new Date().toISOString() };
  const other = { id: '00000000-0000-4000-8000-000000000146', file_id: '00000000-0000-4000-8000-000000000147',
    source_path: 'other.jpg', original_filename: 'other.jpg', mime_type: 'image/jpeg', status: 'unmatched',
    candidates: [], local_analysis: null, decision: null, error_message: null };
  const item = { id: itemId, file_id: '00000000-0000-4000-8000-000000000144', source_path: 'ABC-100.jpg',
    original_filename: 'ABC-100.jpg', mime_type: 'image/jpeg', status: 'suggested', decision: null, error_message: null,
    candidates: [{ groupId, variantId: '00000000-0000-4000-8000-000000000145', groupName: 'Sản phẩm A', variantName: 'ABC-100',
      evidence: [{ source: 'filename', field: 'modelCode', value: 'ABC-100' }] }],
    local_analysis: { model: 'qwen3-vl:2b-instruct', observed_codes: ['XYZ-200'], visible_text: ['XYZ-200'],
      description: 'Mã thấy trên ảnh', uncertainty: '', analyzed_pages: 0 } };
  const respond = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  await page.route('**/song-thanh/media-batches**', (route) => {
    const suffix = new URL(route.request().url()).pathname.replace('/song-thanh/media-batches', '');
    if (route.request().method() === 'GET' && suffix === '/local-ai/status') return route.fulfill(respond({ available: true, busy: false, model: 'local', locality: 'localhost' }));
    if (route.request().method() === 'GET' && !suffix) return route.fulfill(respond({ items: [{ ...batch, item_count: 2 }] }));
    if (route.request().method() === 'GET' && suffix === `/${batchId}`) return route.fulfill(respond({ batch, items: [other, item] }));
    return route.fulfill({ status: 404, body: 'Unexpected media request' });
  });
  await page.goto(`/admin/media?batch_id=${batchId}&item_id=${itemId}`);
  await expect(page.getByText('Mã robot đọc từ nội dung không khớp gợi ý từ tên file/thư mục.')).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Xác nhận gán file' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('button', { name: /Sản phẩm A.*ABC-100/ }).click();
  await expect(confirm).toBeEnabled();
});

test('admin reviews a suggested image before applying the batch', async ({ page, request }, testInfo) => {
  await seedAdmin(page, request);
  const batchId = '00000000-0000-4000-8000-000000000101';
  const itemId = '00000000-0000-4000-8000-000000000102';
  const fileId = '00000000-0000-4000-8000-000000000103';
  const groupId = '00000000-0000-4000-8000-000000000104';
  const variantId = '00000000-0000-4000-8000-000000000105';
  const batch = { id: batchId, batch_name: 'Đợt kiểm tra', import_batch_id: null, status: 'open', created_at: new Date().toISOString() };
  const items: Array<Record<string, unknown>> = [];
  let created = false;
  let followupFocus: unknown = null;
  let followupHistory: unknown = null;
  let localReadCount = 0;
  const respond = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  await page.route('**/song-thanh/files/upload', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill(respond({ file: { id: fileId } }));
  });
  await page.route('**/song-thanh/media-batches**', async (route) => {
    const url = new URL(route.request().url());
    const suffix = url.pathname.replace('/song-thanh/media-batches', '');
    const method = route.request().method();
    if (method === 'GET' && suffix === '/local-ai/status') return route.fulfill(respond({ available: true, busy: false, model: 'qwen3-vl:2b-instruct', locality: 'localhost', message: 'Mô hình cục bộ đã sẵn sàng.' }));
    if (method === 'POST' && suffix === '/assistant/ask') return route.fulfill(respond({ answer: 'A6CLR là sản phẩm đang có trong project.', model: 'project-data', products: [{ id: groupId, name: 'Sản phẩm A' }] }));
    if (method === 'GET' && !suffix) return route.fulfill(respond({ items: created ? [{ ...batch, item_count: items.length }] : [] }));
    if (method === 'POST' && !suffix) {
      created = true;
      return route.fulfill(respond({ batch, items }));
    }
    if (method === 'GET' && suffix === `/${batchId}`) return route.fulfill(respond({ batch, items }));
    if (method === 'POST' && suffix === `/${batchId}/items`) {
      items.push({ id: itemId, file_id: fileId, source_path: 'ABC-100/front.jpg', original_filename: 'front.webp', mime_type: 'image/webp', status: 'pending', candidates: [], decision: null, error_message: null });
      return route.fulfill(respond({ item: items[0] }));
    }
    if (method === 'POST' && suffix === `/${batchId}/analyze`) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      items[0].status = 'suggested';
      items[0].candidates = [{ groupId, variantId, groupName: 'Sản phẩm A', variantName: 'ABC-100', evidence: [{ source: 'filename', field: 'modelCode', value: 'ABC-100' }] }];
      return route.fulfill(respond({ batch, items, analyzed: 1 }));
    }
    if (method === 'POST' && suffix === `/${batchId}/items/${itemId}/analyze-local`) {
      localReadCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 450));
      items[0].status = 'suggested';
      items[0].candidates = [{ groupId, variantId, groupName: 'Sản phẩm A', variantName: 'ABC-100', evidence: [{ source: 'content', field: 'modelCode', value: 'ABC-100' }] }];
      items[0].local_analysis = { model: 'qwen3-vl:2b-instruct', observed_codes: ['ABC-100'], visible_text: ['ABC-100'], description: 'Ảnh chụp sản phẩm có mã ABC-100.', uncertainty: '', analyzed_pages: 0 };
      return route.fulfill(respond({ batch, items }));
    }
    if (method === 'POST' && suffix === `/${batchId}/ask`) {
      const body = route.request().postDataJSON() as { question?: string; focus_item_ids?: unknown; history?: unknown };
      if (body.question?.includes('file đó')) {
        followupFocus = body.focus_item_ids;
        followupHistory = body.history;
        return route.fulfill(respond({ answer: 'front.jpg vẫn cần bạn xem trực tiếp trước khi gán.', referenced_item_ids: [itemId], model: 'project-evidence' }));
      }
      return route.fulfill(respond({ answer: 'File front.jpg đang được gợi ý cho Sản phẩm A vì mã ABC-100.', referenced_item_ids: [itemId], model: 'qwen3-vl:2b-instruct' }));
    }
    if (method === 'POST' && suffix === `/${batchId}/items/${itemId}/confirm`) {
      const body = route.request().postDataJSON() as { decision: unknown };
      items[0].status = 'confirmed';
      items[0].decision = body.decision;
      return route.fulfill(respond({ batch, items }));
    }
    if (method === 'POST' && suffix === `/${batchId}/apply`) {
      items[0].status = 'applied';
      batch.status = 'applied';
      return route.fulfill(respond({ batch, items, applied: 1, errors: [] }));
    }
    return route.fulfill({ status: 404, body: 'Not mocked' });
  });

  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.evaluate((element) => {
    const states = [element.getAttribute('data-robot-state')];
    (window as Window & { mediaRobotStates?: Array<string | null> }).mediaRobotStates = states;
    new MutationObserver(() => states.push(element.getAttribute('data-robot-state')))
      .observe(element, { attributes: true, attributeFilter: ['data-robot-state'] });
  });
  await page.getByLabel('Hỏi trợ lý sản phẩm').focus();
  await expect(assistant).toHaveAttribute('data-robot-state', 'listening');
  await page.getByLabel('Hỏi trợ lý sản phẩm').fill('A6CLR là sản phẩm gì?');
  await page.getByLabel('Hỏi trợ lý sản phẩm').press('Enter');
  await expect(page.getByText('A6CLR là sản phẩm đang có trong project.')).toBeVisible();
  await expect(assistant).toHaveAttribute('data-robot-state', 'speaking');
  await assistant.getByRole('button', { name: 'Mở rộng trợ lý' }).click();
  await expect(assistant).toHaveAttribute('data-expanded', 'true');
  await assistant.screenshot({ path: testInfo.outputPath('assistant-expanded-with-answer.png'), animations: 'disabled' });
  await assistant.getByRole('button', { name: 'Thu gọn trợ lý' }).click();
  await expect(assistant).toHaveAttribute('data-expanded', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => assistant.evaluate((element) => Math.round(element.getBoundingClientRect().left))).toBe(0);
  await expect.poll(() => assistant.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(390);
  await assistant.locator('input[type="file"]').first().setInputFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await expect(assistant).toHaveAttribute('data-robot-state', 'working');
  await expect(assistant.getByRole('status')).toContainText('Đang tải file');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await assistant.screenshot({ path: testInfo.outputPath('assistant-working.png'), animations: 'disabled' });
  await page.screenshot({ path: testInfo.outputPath('assistant-working-mobile.png'), animations: 'disabled' });
  await expect(page.getByText(/Đã nhận 1 file/)).toBeVisible();
  expect(localReadCount).toBe(1);
  expect(await page.evaluate(() => (window as Window & { mediaRobotStates?: Array<string | null> }).mediaRobotStates)).toEqual(
    expect.arrayContaining(['working', 'searching', 'thinking', 'happy'])
  );
  await expect(page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).getByText('Sản phẩm A · ABC-100')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).getByText('ABC-100 từ nội dung file AI đọc')).toBeVisible();
  await assistant.getByRole('button', { name: 'Sản phẩm', exact: true }).click();
  await page.getByLabel('Hỏi trợ lý sản phẩm').fill('A6CLR là sản phẩm gì?');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(assistant.getByText('A6CLR là sản phẩm đang có trong project.').last()).toBeVisible();
  await assistant.getByRole('button', { name: 'File đang xem' }).click();
  await page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).screenshot({ path: testInfo.outputPath('assistant-with-suggestion.png'), animations: 'disabled' });
  await page.screenshot({ path: testInfo.outputPath('assistant-result-mobile.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).locator('a[href*="item_id="]').first().click();
  await expect(page).toHaveURL(new RegExp(`/admin/media\\?batch_id=${batchId}&item_id=${itemId}`));
  await expect(page.getByRole('heading', { name: 'Đợt kiểm tra' })).toBeVisible();
  await expect(page.getByText('ABC-100/front.jpg')).toBeVisible();
  await expect(page.getByText('Ảnh chụp sản phẩm có mã ABC-100.')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('media-with-file.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('media-with-file-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Hỏi trợ lý' }).click();
  await page.getByLabel('Hỏi trợ lý sản phẩm').fill('Vì sao file này được gợi ý?');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.getByText('File front.jpg đang được gợi ý cho Sản phẩm A vì mã ABC-100.')).toBeVisible();
  await page.getByLabel('Hỏi trợ lý sản phẩm').fill('Còn file đó thì sao?');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.getByText('front.jpg vẫn cần bạn xem trực tiếp trước khi gán.')).toBeVisible();
  expect(followupFocus).toEqual([itemId]);
  expect(followupHistory).toEqual(expect.arrayContaining([
    { role: 'user', text: 'Vì sao file này được gợi ý?' },
    { role: 'assistant', text: 'File front.jpg đang được gợi ý cho Sản phẩm A vì mã ABC-100.' }
  ]));
  await page.getByRole('button', { name: 'Đóng trợ lý' }).click();
  await expect(page.getByText('Dự kiến gán vào — kiểm tra trước khi xác nhận')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận gán file' })).toBeEnabled();
  await page.getByRole('button', { name: 'Xác nhận gán file' }).click();
  await expect(page.getByText('Đã xác nhận, vẫn có thể sửa đích trước khi áp dụng đợt.')).toBeVisible();
  await page.getByRole('button', { name: 'Áp dụng 1 file đã xác nhận' }).click();
  await expect(page.getByText('Đã áp dụng 1 file.')).toBeVisible();
});

test('files opened from an Excel import keep the link without an ID field', async ({ page, request }) => {
  await seedAdmin(page, request);
  const importBatchId = '00000000-0000-4000-8000-000000000106';
  const batchId = '00000000-0000-4000-8000-000000000107';
  const batch = { id: batchId, batch_name: 'Ảnh/PDF', import_batch_id: importBatchId, status: 'open', created_at: new Date().toISOString() };
  const items: Array<Record<string, unknown>> = [];
  let linkedImportId: string | undefined;
  let created = false;
  const respond = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  await page.route('**/song-thanh/files/upload', (route) => route.fulfill(respond({ file: { id: '00000000-0000-4000-8000-000000000108' } })));
  await page.route('**/song-thanh/media-batches**', (route) => {
    const suffix = new URL(route.request().url()).pathname.replace('/song-thanh/media-batches', '');
    const method = route.request().method();
    if (method === 'GET' && suffix === '/local-ai/status') return route.fulfill(respond({ available: false, busy: false, model: 'local', locality: 'localhost', message: '' }));
    if (method === 'GET' && !suffix) return route.fulfill(respond({ items: created ? [{ ...batch, item_count: items.length }] : [] }));
    if (method === 'POST' && !suffix) {
      created = true;
      linkedImportId = (route.request().postDataJSON() as { import_batch_id?: string }).import_batch_id;
      return route.fulfill(respond({ batch, items }));
    }
    if (method === 'POST' && suffix === `/${batchId}/items`) {
      items.push({ id: 'item-1', source_path: 'front.jpg', mime_type: 'image/jpeg', status: 'pending', candidates: [] });
      return route.fulfill(respond({ item: items[0] }));
    }
    if (method === 'GET' && suffix === `/${batchId}`) return route.fulfill(respond({ batch, items }));
    return route.fulfill({ status: 404, body: 'Not mocked' });
  });

  await page.goto(`/admin/media?import_batch_id=${importBatchId}`);
  await expect(page.getByText('File gửi ở đây sẽ đi cùng lô Excel bạn vừa mở.')).toBeVisible();
  await expect(page.getByLabel('Mã lô Excel đã nhập')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở trợ lý để gửi ảnh/PDF' }).click();
  await page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).locator('input[type="file"]').first().setInputFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await expect(page.getByText(/Đã nhận 1 file/)).toBeVisible();
  await expect(page.getByText(/Hãy áp dụng lô Excel trước/)).toBeVisible();
  await page.getByRole('button', { name: 'Đóng trợ lý' }).click();
  await expect(page.getByRole('heading', { name: 'Ảnh/PDF', exact: true })).toBeVisible();
  expect(linkedImportId).toBe(importBatchId);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ảnh/PDF', exact: true })).toBeVisible();
  await expect(page.getByText('Các file này đi cùng')).toBeVisible();
});

test('a failed upload does not leave another empty work session', async ({ page, request }) => {
  await seedAdmin(page, request);
  let createCount = 0;
  const respond = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  await page.route('**/song-thanh/files/upload', (route) => route.fulfill({ status: 400, contentType: 'application/json',
    body: JSON.stringify({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Ảnh không hợp lệ.' } }) }));
  await page.route('**/song-thanh/media-batches**', (route) => {
    const suffix = new URL(route.request().url()).pathname.replace('/song-thanh/media-batches', '');
    if (route.request().method() === 'GET' && suffix === '/local-ai/status') return route.fulfill(respond({ available: false, busy: false, model: 'local', locality: 'localhost', message: '' }));
    if (route.request().method() === 'GET' && !suffix) return route.fulfill(respond({ items: [] }));
    if (route.request().method() === 'POST' && !suffix) createCount += 1;
    return route.fulfill({ status: 404, body: 'Not mocked' });
  });

  await page.goto('/admin/media');
  await page.getByRole('button', { name: 'Mở trợ lý để gửi ảnh/PDF' }).click();
  await page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).locator('input[type="file"]').first().setInputFiles({ name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('bad') });
  await expect(page.getByText(/Không thêm được file nào/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chưa có file nào để duyệt' })).toBeVisible();
  expect(createCount).toBe(0);
});
