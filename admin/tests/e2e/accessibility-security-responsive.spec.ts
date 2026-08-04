import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type APIRequestContext,
  type Page
} from '@playwright/test';

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const FRONTEND_BASE_URL = (
  process.env.FRONTEND_BASE_URL || 'http://localhost:3000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const ADMIN_BASE_PATH = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const STORAGE_KEY = 'song-thanh-admin-auth';

type AdminSession = {
  access_token: string;
  refresh_token: string;
  user: Record<string, unknown>;
  permissions: string[];
};

let session: AdminSession;

const ADMIN_A11Y_ROUTES = [
  '/dashboard',
  '/audit-logs',
  '/banners',
  '/brands',
  '/contacts',
  '/customers',
  '/files',
  '/home-page',
  '/import',
  '/menu',
  '/page-contents',
  '/page-contents/brand-pages',
  '/product-categories',
  '/product-categories/main',
  '/product-categories/sub',
  '/product-groups',
  '/product-variants',
  '/projects',
  '/quotes',
  '/redirects',
  '/roles',
  '/services',
  '/technical-documents',
  '/users',
  '/website-settings'
] as const;

const PUBLIC_A11Y_ROUTES = [
  '/',
  '/gioi-thieu',
  '/ho-so-nang-luc',
  '/san-pham',
  '/san-pham/danh-sach',
  '/doi-tac-thuong-hieu',
  '/tin-tuc',
  '/dich-vu',
  '/du-an',
  '/lien-he',
  '/tim-kiem'
] as const;

test.beforeAll(async ({ request }) => {
  session = await login(request);
});

test('A11Y-01: login and representative admin routes satisfy WCAG A/AA automation', async ({
  page
}) => {
  await page.goto(adminPath('/login'));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await assertWcag(page, 'admin login');

  await seedAuth(page, session);
  for (const pathname of ADMIN_A11Y_ROUTES) {
    await page.goto(adminPath(pathname));
    await expect(page.locator('main')).toBeVisible();
    await waitForUiToSettle(page);
    await assertWcag(page, `admin ${pathname}`);
  }
});

test('A11Y-02: representative public routes satisfy WCAG A/AA automation', async ({
  page
}) => {
  // This is a whole-public-surface audit: 11 server-rendered routes plus an
  // Axe scan for each. The default 60s budget was expiring during navigation
  // even after the capability-profile page had rendered, so retain every
  // route and give the complete audit a realistic, explicit budget.
  test.setTimeout(300_000);

  for (const pathname of PUBLIC_A11Y_ROUTES) {
    await page.goto(`${FRONTEND_BASE_URL}${pathname}`);
    await expect(page.locator('main')).toBeVisible();
    await waitForUiToSettle(page);
    await assertWcag(page, `public ${pathname}`);
  }
});

test('A11Y-03: mobile drawers trap focus, restore focus and pages do not overflow', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${FRONTEND_BASE_URL}/`);
  await assertNoHorizontalOverflow(page, 'public home');
  await assertMinimumControlTargets(page, 'public home');

  const publicTrigger = page.getByRole('button', { name: 'Mở menu' });
  await publicTrigger.focus();
  await publicTrigger.click();
  const publicDialog = page.getByRole('dialog', { name: 'Menu điều hướng' });
  await expect(publicDialog).toBeVisible();
  await expect(publicDialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(publicDialog).toHaveCount(0);
  await expect(publicTrigger).toBeFocused();

  await seedAuth(page, session);
  await page.goto(adminPath('/dashboard'));
  await assertNoHorizontalOverflow(page, 'admin dashboard');
  await assertMinimumControlTargets(page, 'admin dashboard');

  const adminTrigger = page.getByRole('button', { name: 'Mở menu điều hướng' });
  await adminTrigger.focus();
  await adminTrigger.click();
  const adminDialog = page.getByRole('dialog', { name: 'Điều hướng quản trị' });
  await expect(adminDialog).toBeVisible();
  await expect(adminDialog.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(adminDialog).toHaveCount(0);
  await expect(adminTrigger).toBeFocused();
});

test('SEC-UI-01: web surfaces and API emit baseline browser security headers', async ({
  page,
  request
}) => {
  const publicResponse = await page.goto(`${FRONTEND_BASE_URL}/robots.txt`);
  expect(publicResponse).not.toBeNull();
  assertSecurityHeaders(publicResponse!.headers(), 'public');

  const adminResponse = await page.goto(adminPath('/login'));
  expect(adminResponse).not.toBeNull();
  assertSecurityHeaders(adminResponse!.headers(), 'admin');

  const apiResponse = await request.get(`${API_BASE_URL}/health`);
  expect(apiResponse.ok()).toBe(true);
  const apiHeaders = apiResponse.headers();
  expect(apiHeaders['x-content-type-options']).toBe('nosniff');
  expect(apiHeaders['x-frame-options']).toBe('SAMEORIGIN');
  expect(apiHeaders['referrer-policy']).toBe('no-referrer');
});

test('SEC-UI-02: login refuses an external returnTo target', async ({ page }) => {
  await page.goto(adminPath('/login?returnTo=%2F%2Fexample.com'));
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(new RegExp(`${ADMIN_BASE_PATH}/dashboard$`));
});

test('RES-UI-01: contact form preserves input and recovers after a network failure', async ({
  page
}) => {
  await page.goto(`${FRONTEND_BASE_URL}/lien-he`);

  const fullName = page.getByLabel('Họ và tên');
  const phone = page.getByLabel('Số điện thoại');
  const message = page.getByLabel('Nội dung liên hệ');
  const submit = page.getByRole('button', { name: 'Gửi yêu cầu' });

  await fullName.fill('Nguyễn Văn Kiểm Thử');
  await phone.fill('0901234567');
  await message.fill('Kiểm thử khả năng phục hồi khi kết nối mạng bị gián đoạn.');

  await page.context().setOffline(true);
  try {
    await submit.click();
    await expect(page.locator('form [role="alert"]')).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(fullName).toHaveValue('Nguyễn Văn Kiểm Thử');
    await expect(phone).toHaveValue('0901234567');
    await expect(message).toHaveValue(
      'Kiểm thử khả năng phục hồi khi kết nối mạng bị gián đoạn.'
    );
  } finally {
    await page.context().setOffline(false);
  }
});

async function assertWcag(page: Page, surface: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const details = results.violations
    .map((violation) => {
      const nodes = violation.nodes
        .slice(0, 6)
        .map((node) => `${node.target.join(' ')}: ${node.failureSummary ?? violation.help}`)
        .join('\n');
      return `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help}\n${nodes}`;
    })
    .join('\n\n');

  expect.soft(results.violations, `${surface} accessibility violations:\n${details}`).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page, surface: string) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(
    dimensions.scrollWidth,
    `${surface} horizontally overflows: ${JSON.stringify(dimensions)}`
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertMinimumControlTargets(page: Page, surface: string) {
  const undersized = await page.locator('button, input, select, textarea').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      const rect = htmlElement.getBoundingClientRect();
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        rect.width === 0 ||
        rect.height === 0 ||
        htmlElement.closest('[aria-hidden="true"]')
      ) {
        return [];
      }
      if (htmlElement.getAttribute('aria-label') === 'Open Next.js Dev Tools') {
        return [];
      }
      if (rect.width >= 44 && rect.height >= 44) {
        return [];
      }
      return [
        {
          tag: htmlElement.tagName.toLowerCase(),
          label:
            htmlElement.getAttribute('aria-label') ||
            htmlElement.getAttribute('name') ||
            htmlElement.textContent?.trim().slice(0, 80) ||
            '(unlabeled)',
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      ];
    })
  );

  expect(undersized, `${surface} controls smaller than 44x44: ${JSON.stringify(undersized)}`).toEqual(
    []
  );
}

function assertSecurityHeaders(headers: Record<string, string>, surface: string) {
  expect(headers['content-security-policy'], `${surface} CSP missing`).toContain(
    "frame-ancestors 'none'"
  );
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
}

async function waitForUiToSettle(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 3000 }).catch(
    () => undefined
  );
}

async function seedAuth(page: Page, auth: AdminSession) {
  await page.addInitScript(
    ({ storageKey, state }) => {
      window.sessionStorage.setItem(storageKey, JSON.stringify(state));
    },
    {
      storageKey: STORAGE_KEY,
      state: {
        accessToken: auth.access_token,
        refreshToken: auth.refresh_token,
        user: auth.user,
        permissions: auth.permissions,
        roles: []
      }
    }
  );
}

async function login(request: APIRequestContext): Promise<AdminSession> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    headers: { 'X-Forwarded-For': '192.0.2.91' },
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    }
  });
  expect(response.ok(), `Login failed with HTTP ${response.status()}`).toBe(true);
  const payload = await response.json();
  expect(payload.ok).toBe(true);
  return payload.data as AdminSession;
}

function normalizeAdminBasePath(basePath: string): string {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminPath(pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${ADMIN_BASE_PATH}${normalizedPath}`;
}
