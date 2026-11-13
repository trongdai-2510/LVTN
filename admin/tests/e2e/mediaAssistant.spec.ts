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
  await expect(assistant.getByLabel('Hỏi trợ lý sản phẩm')).toBeInViewport();
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
  await expect(assistant.locator('header').getByRole('link', { name: 'Xem lượt file đã gửi' })).toBeVisible();
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Sản phẩm nào thiếu ảnh?');
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').press('Enter');
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

test('Songbot treats hi and hihi as a continuing conversation', async ({ page, request }) => {
  await seedAdmin(page, request);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  const input = assistant.getByLabel('Hỏi trợ lý sản phẩm');
  await input.fill('hi');
  await input.press('Enter');
  await expect(assistant.getByText(/Chào bạn! Mình là Songbot/)).toBeVisible();
  await input.fill('hihi');
  await input.press('Enter');
  await expect(assistant.getByText(/Hihi, mình nghe đây/)).toBeVisible();
  await expect(assistant.getByText(/đang phân tích yêu cầu của bạn/)).toHaveCount(0);
  await input.fill('Mình chưa biết bắt đầu từ đâu');
  await input.press('Enter');
  await expect(assistant.getByText(/chỉ gắn file sau khi bạn bấm Đồng ý/)).toBeVisible();
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
  await expect(assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' })).toContainText('Sản phẩm A');
  await expect(assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' })).toContainText('ABC-100 từ nội dung');
  await assistant.getByRole('button', { name: 'Sản phẩm', exact: true }).click();
  await page.getByLabel('Hỏi trợ lý sản phẩm').fill('A6CLR là sản phẩm gì?');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(assistant.getByText('A6CLR là sản phẩm đang có trong project.').last()).toBeVisible();
  await assistant.getByRole('button', { name: 'File đang xem' }).click();
  await page.getByRole('dialog', { name: 'Trợ lý sản phẩm' }).screenshot({ path: testInfo.outputPath('assistant-with-suggestion.png'), animations: 'disabled' });
  await page.screenshot({ path: testInfo.outputPath('assistant-result-mobile.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await assistant.getByRole('button', { name: /front.jpg.*Sản phẩm A/ }).first().click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const review = assistant.getByRole('region', { name: 'Kiểm tra file trong trợ lý' });
  await expect(review.getByText('ABC-100/front.jpg')).toBeVisible();
  await expect(review.getByText('Ảnh chụp sản phẩm có mã ABC-100.')).toBeVisible();
  await expect(review.getByRole('button', { name: 'Xác nhận gán file' })).toBeEnabled();
  await assistant.screenshot({ path: testInfo.outputPath('assistant-review-desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await assistant.screenshot({ path: testInfo.outputPath('assistant-review-mobile.png'), animations: 'disabled' });
  await review.getByRole('button', { name: 'Xác nhận gán file' }).click();
  await expect(assistant.getByRole('button', { name: 'Áp dụng 1 file đã xác nhận' })).toBeVisible();
  await assistant.screenshot({ path: testInfo.outputPath('assistant-confirmed-mobile.png'), animations: 'disabled' });
  await review.getByRole('button', { name: 'Sửa lựa chọn cho file này' }).click();
  await expect(review.getByRole('button', { name: 'Xác nhận gán file' })).toBeVisible();
  await review.getByRole('button', { name: 'Xác nhận gán file' }).click();
  await expect(review.getByRole('button', { name: 'Sửa lựa chọn cho file này' })).toBeVisible();
  await assistant.getByRole('button', { name: 'Áp dụng 1 file đã xác nhận' }).click();
  await expect(review.getByText('Ảnh sản phẩm · Đã gán')).toBeVisible();
  await expect(review.getByText('Đã gán file vào sản phẩm')).toBeVisible();
  await assistant.screenshot({ path: testInfo.outputPath('assistant-applied-mobile.png'), animations: 'disabled' });
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await review.getByRole('button', { name: 'Trở lại công việc' }).click();
  await expect(assistant.getByText('Đã gán 1 file vào sản phẩm.')).toBeVisible();
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

async function mockConversationAssignment(page: Page, withTaskAi = false) {
  const batchId = '00000000-0000-4000-8000-000000000201';
  const groupId = '00000000-0000-4000-8000-000000000203';
  const batch = { id: batchId, batch_name: 'Ảnh/PDF', import_batch_id: null, status: 'open', created_at: new Date().toISOString() };
  const items: Array<Record<string, unknown>> = [];
  let created = false;
  let applied = 0;
  let decision: unknown = null;
  const decisions: unknown[] = [];
  let uploadCount = 0;
  const taskPrompts: string[] = [];
  const respond = (data: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  await page.route('**/song-thanh/files/upload', (route) => {
    uploadCount += 1;
    return route.fulfill(respond({ file: { id: `00000000-0000-4000-8000-${String(204 + uploadCount).padStart(12, '0')}` } }));
  });
  await page.route('**/song-thanh/product-groups?**', (route) => route.fulfill(respond({ items: [{ id: groupId, name: 'Sản phẩm A',
    search_match: { field: 'model_code', value: 'ABC-100' } }] })));
  await page.route('**/song-thanh/media-batches**', (route) => {
    const suffix = new URL(route.request().url()).pathname.replace('/song-thanh/media-batches', '');
    const method = route.request().method();
    if (method === 'GET' && suffix === '/local-ai/status') return route.fulfill(respond({ available: withTaskAi, busy: false, model: 'local', locality: 'localhost', message: '' }));
    if (method === 'POST' && suffix === '/assistant/ask' && withTaskAi) {
      const body = route.request().postDataJSON() as { question: string; mode?: string };
      if (body.mode === 'interpret_task') {
        taskPrompts.push(body.question);
        return route.fulfill(respond({ intent: body.question.startsWith('Cho tôi xem') ? 'query' : 'assign',
          target_text: body.question.includes('ABC-100') ? 'ABC-100' : '', file_name: '', all_files: false, needs_clarification: false }));
      }
      return route.fulfill(respond({ answer: 'Có sản phẩm thiếu ảnh trong project.', products: [], model: 'project-data' }));
    }
    if (method === 'GET' && !suffix) return route.fulfill(respond({ items: created ? [{ ...batch, item_count: items.length }] : [] }));
    if (method === 'POST' && !suffix) { created = true; return route.fulfill(respond({ batch, items })); }
    if (method === 'POST' && suffix === `/${batchId}/items`) {
      const body = route.request().postDataJSON() as { file_id: string; source_path: string };
      items.push({ id: `00000000-0000-4000-8000-${String(210 + items.length).padStart(12, '0')}`, file_id: body.file_id,
        source_path: body.source_path, original_filename: body.source_path,
        mime_type: 'image/jpeg', status: 'pending', candidates: [], local_analysis: null, decision: null, error_message: null });
      return route.fulfill(respond({ item: items.at(-1) }));
    }
    if (method === 'POST' && suffix === `/${batchId}/analyze`) {
      items.forEach((item) => { item.status = 'unmatched'; });
      return route.fulfill(respond({ batch, items }));
    }
    if (method === 'POST' && suffix.match(new RegExp(`^/${batchId}/items/[^/]+/analyze-local$`)) && withTaskAi) {
      const item = items.find((entry) => entry.id === suffix.split('/')[3]);
      if (!item) return route.fulfill({ status: 404, body: 'Unknown item' });
      item.local_analysis = { model: 'local', observed_codes: [], visible_text: [], description: '', uncertainty: '', analyzed_pages: 0 };
      return route.fulfill(respond({ batch, items }));
    }
    if (method === 'GET' && suffix === `/${batchId}`) return route.fulfill(respond({ batch, items }));
    if (method === 'POST' && suffix.match(new RegExp(`^/${batchId}/items/[^/]+/confirm$`))) {
      decision = (route.request().postDataJSON() as { decision: unknown }).decision;
      const item = items.find((entry) => entry.id === suffix.split('/')[3]);
      if (!item) return route.fulfill({ status: 404, body: 'Unknown item' });
      item.status = 'confirmed';
      item.decision = decision;
      decisions.push(decision);
      return route.fulfill(respond({ batch, items }));
    }
    if (method === 'POST' && suffix === `/${batchId}/apply`) {
      applied += 1;
      const appliedCount = items.filter((item) => item.status === 'confirmed').length;
      items.forEach((item) => { if (item.status === 'confirmed') item.status = 'applied'; });
      batch.status = 'applied';
      return route.fulfill(respond({ batch, items, applied: appliedCount, errors: [] }));
    }
    return route.fulfill({ status: 404, body: 'Unexpected media request' });
  });
  return { groupId, getApplied: () => applied, getDecision: () => decision, getDecisions: () => decisions, taskPrompts };
}

test('Songbot understands a natural attachment request and waits for consent', async ({ page, request }) => {
  await seedAdmin(page, request);
  const mock = await mockConversationAssignment(page, true);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.locator('input[type="file"]').first().setInputFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await expect(assistant.getByText(/File này thuộc sản phẩm nào/)).toBeVisible();
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Đính kèm ảnh này vào mã ABC-100');
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').press('Enter');
  const plan = assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' });
  await expect(plan).toContainText('Sản phẩm A');
  expect(mock.taskPrompts).toContain('Đính kèm ảnh này vào mã ABC-100');
  expect(mock.getApplied()).toBe(0);
  await plan.getByRole('button', { name: 'Đồng ý gán 1 file' }).click();
  await expect(assistant.getByText(/Xong rồi. Mình đã gán 1 file/)).toBeVisible();
  expect(mock.getApplied()).toBe(1);
});

test('Songbot uses the file instruction in the same upload turn', async ({ page, request }) => {
  await seedAdmin(page, request);
  const mock = await mockConversationAssignment(page, true);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Đính kèm ảnh này vào mã ABC-100');
  await assistant.locator('input[type="file"]').first().setInputFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await expect(assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' })).toContainText('Sản phẩm A');
  expect(mock.taskPrompts).toContain('Đính kèm ảnh này vào mã ABC-100');
  expect(mock.getApplied()).toBe(0);
});

test('Songbot answers a question about missing images without treating it as an assignment', async ({ page, request }) => {
  await seedAdmin(page, request);
  const mock = await mockConversationAssignment(page, true);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Cho tôi xem sản phẩm nào thiếu ảnh trước khi gán');
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').press('Enter');
  await expect(assistant.getByText('Có sản phẩm thiếu ảnh trong project.')).toBeVisible();
  await expect(assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' })).toHaveCount(0);
  expect(mock.taskPrompts).toEqual(['Cho tôi xem sản phẩm nào thiếu ảnh trước khi gán']);
});

test('Songbot prepares and assigns every file only when admin explicitly says all files', async ({ page, request }, testInfo) => {
  await seedAdmin(page, request);
  const mock = await mockConversationAssignment(page);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Gắn tất cả file cho sản phẩm ABC-100');
  await assistant.locator('input[type="file"]').first().setInputFiles([
    { name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
    { name: 'side.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }
  ]);
  const plan = assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' });
  await expect(plan).toContainText('front.jpg');
  await expect(plan).toContainText('side.jpg');
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(plan.getByRole('button', { name: 'Đồng ý gán 2 file' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await assistant.screenshot({ path: testInfo.outputPath('assistant-two-files-mobile.png'), animations: 'disabled' });
  expect(mock.getApplied()).toBe(0);
  await plan.getByRole('button', { name: 'Đồng ý gán 2 file' }).click();
  await expect(assistant.getByText('Xong rồi. Mình đã gán 2 file vào sản phẩm như bạn đồng ý.')).toBeVisible();
  expect(mock.getDecisions()).toHaveLength(2);
  expect(mock.getApplied()).toBe(1);
});

test('Songbot keeps the multi-file worklist and pending apply action in the chat', async ({ page, request }, testInfo) => {
  await seedAdmin(page, request);
  const mock = await mockConversationAssignment(page);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.locator('input[type="file"]').first().setInputFiles([
    { name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
    { name: 'side.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }
  ]);
  const list = assistant.getByRole('region', { name: 'Danh sách file trong công việc hiện tại' });
  await expect(list).toBeVisible();
  await expect(list).toContainText('front.jpg');
  await expect(list).toContainText('side.jpg');
  await expect(list).toContainText('Cần chọn sản phẩm');
  await page.setViewportSize({ width: 390, height: 844 });
  await assistant.screenshot({ path: testInfo.outputPath('songbot-worklist-mobile.png'), animations: 'disabled' });
  await list.getByRole('button', { name: /side.jpg/ }).click();
  const review = assistant.getByRole('region', { name: 'Kiểm tra file trong trợ lý' });
  await review.getByLabel('Tìm sản phẩm khác').fill('ABC-100');
  await review.getByRole('button', { name: 'Tìm', exact: true }).click();
  await review.getByRole('button', { name: /Sản phẩm A/ }).click();
  await review.getByRole('button', { name: 'Xác nhận gán file' }).click();
  await review.getByRole('button', { name: 'Trở lại công việc' }).click();
  await expect(assistant.getByRole('button', { name: 'Áp dụng 1 file', exact: true })).toBeVisible();
  expect(mock.getApplied()).toBe(0);
  await assistant.getByRole('button', { name: 'Áp dụng 1 file', exact: true }).click();
  await expect(assistant.getByText(/Đã gán 1 file vào sản phẩm/)).toBeVisible();
  expect(mock.getApplied()).toBe(1);
  await assistant.getByRole('button', { name: 'Danh sách file' }).click();
  await expect(list.getByRole('button', { name: /side.jpg/ })).toContainText('Đã gán');
  await expect(list.getByRole('button', { name: /front.jpg/ })).toContainText('Cần chọn sản phẩm');
});

test('Songbot removes a proposal before reading more files', async ({ page, request }) => {
  await seedAdmin(page, request);
  await mockConversationAssignment(page, true);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Gắn tất cả file cho sản phẩm ABC-100');
  await assistant.locator('input[type="file"]').first().setInputFiles([
    { name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
    { name: 'side.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
    { name: 'label.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }
  ]);
  const plan = assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' });
  await expect(plan).toContainText('label.jpg');
  await assistant.getByRole('button', { name: 'Robot đọc 1 file tiếp' }).click();
  await expect(plan).toHaveCount(0);
  await expect(assistant.getByText(/Đề xuất gán cũ đã được bỏ/)).toBeVisible();
  await expect(assistant.getByRole('region', { name: 'Danh sách file trong công việc hiện tại' })).toBeVisible();
});

for (const instructionFirst of [false, true]) {
  test(`Songbot assigns an uploaded image after consent (${instructionFirst ? 'instruction with file' : 'product reply'})`, async ({ page, request }, testInfo) => {
    await seedAdmin(page, request);
    const mock = await mockConversationAssignment(page);
    await page.goto('/admin/dashboard');
    await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
    const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
    if (instructionFirst) await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Gắn ảnh này cho sản phẩm ABC-100');
    await assistant.locator('input[type="file"]').first().setInputFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
    if (!instructionFirst) {
      await expect(assistant.getByText(/File này thuộc sản phẩm nào/)).toBeVisible();
      await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('ok');
      await assistant.getByLabel('Hỏi trợ lý sản phẩm').press('Enter');
      await expect(assistant.getByText(/đang đợi mã model hoặc tên sản phẩm/)).toBeVisible();
      await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('ABC-100');
      await assistant.getByLabel('Hỏi trợ lý sản phẩm').press('Enter');
    }
    const plan = assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' });
    await expect(plan).toContainText('front.jpg');
    await expect(plan).toContainText('Sản phẩm A');
    if (instructionFirst) await assistant.screenshot({ path: testInfo.outputPath('songbot-assignment-preview.png'), animations: 'disabled' });
    expect(mock.getApplied()).toBe(0);
    await plan.getByRole('button', { name: 'Đồng ý gán 1 file' }).click();
    await expect(assistant.getByText('Xong rồi. Mình đã gán 1 file vào sản phẩm như bạn đồng ý.')).toBeVisible();
    expect(mock.getApplied()).toBe(1);
    expect(mock.getDecision()).toEqual({ mode: 'attach', attachments: [{ kind: 'image', product_group_id: mock.groupId,
      product_variant_id: null, set_thumbnail: false }] });
    await expect(page).toHaveURL(/\/admin\/dashboard$/);
  });
}

test('Songbot remembers an assignment request sent before the file', async ({ page, request }) => {
  await seedAdmin(page, request);
  const mock = await mockConversationAssignment(page);
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'Mở trợ lý sản phẩm' }).click();
  const assistant = page.getByRole('dialog', { name: 'Trợ lý sản phẩm' });
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').fill('Gắn ảnh này cho sản phẩm ABC-100');
  await assistant.getByLabel('Hỏi trợ lý sản phẩm').press('Enter');
  await expect(assistant.getByText(/Mình đã ghi nhớ sản phẩm bạn dặn/)).toBeVisible();
  await assistant.locator('input[type="file"]').first().setInputFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  const plan = assistant.getByRole('region', { name: 'Việc Songbot chuẩn bị' });
  await expect(plan).toContainText('Sản phẩm A');
  expect(mock.getApplied()).toBe(0);
  await plan.getByRole('button', { name: 'Đồng ý gán 1 file' }).click();
  await expect(assistant.getByText('Xong rồi. Mình đã gán 1 file vào sản phẩm như bạn đồng ý.')).toBeVisible();
});
