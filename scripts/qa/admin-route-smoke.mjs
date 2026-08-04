import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closeSpawnedBrowser } from './lib/browser-process.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const API_BASE_URL = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const ADMIN_BASE_URL = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const ADMIN_BASE_PATH = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const QA_CLIENT_IP = '192.0.2.50';
const STORAGE_KEY = 'song-thanh-admin-auth';
const CDP_PORT = Number(process.env.ADMIN_ROUTE_QA_CDP_PORT || 9225);
const CASE_TIMEOUT_MS = Number(process.env.ADMIN_ROUTE_QA_CASE_TIMEOUT_MS || 60000);
const ROUTE_READY_TIMEOUT_MS = Number(
  process.env.ADMIN_ROUTE_QA_ROUTE_READY_TIMEOUT_MS || 20000
);
const CONTENT_READY_TIMEOUT_MS = Number(
  process.env.ADMIN_ROUTE_QA_CONTENT_READY_TIMEOUT_MS || 20000
);
const CDP_COMMAND_TIMEOUT_MS = Number(
  process.env.ADMIN_ROUTE_QA_CDP_COMMAND_TIMEOUT_MS || 30000
);
const NAVIGATION_TIMEOUT_MS = Number(
  process.env.ADMIN_ROUTE_QA_NAVIGATION_TIMEOUT_MS || 30000
);
const IMPORT_FIXTURE = path.join(ROOT, 'scripts', 'qa', 'fixtures', 'qa-import-mapping-profile.csv');
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const results = [];
const context = {};

function normalizeAdminBasePath(basePath) {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminUrl(route) {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  return `${ADMIN_BASE_URL}${ADMIN_BASE_PATH}${normalizedRoute}`;
}

const baseRoutes = [
  { route: '/dashboard', label: 'Tổng quan', kind: 'dashboard', risk: 'P0' },
  { route: '/home-page', label: 'Trang chủ', kind: 'form', risk: 'P0' },
  { route: '/website-settings', label: 'Cấu hình website', kind: 'form', risk: 'P1' },
  { route: '/menu', label: 'Menu điều hướng', kind: 'list', risk: 'P1' },
  { route: '/page-contents', label: 'Trang nội dung', kind: 'list', risk: 'P1' },
  { route: '/page-contents/brand-pages', label: 'Trang thương hiệu', kind: 'list', risk: 'P1' },
  { route: '/banners', label: 'Banner', kind: 'list', risk: 'P1' },
  { route: '/redirects', label: 'Chuyển hướng', kind: 'list', risk: 'P2' },
  { route: '/files', label: 'Kho tệp', kind: 'files', risk: 'P1' },
  { route: '/product-categories', label: 'Danh mục sản phẩm', kind: 'list', risk: 'P0' },
  { route: '/product-categories/main', label: 'Danh mục chính', kind: 'list', risk: 'P1' },
  { route: '/product-categories/sub', label: 'Danh mục con', kind: 'list', risk: 'P1' },
  { route: '/brands', label: 'Thương hiệu', kind: 'list', risk: 'P0' },
  { route: '/product-groups', label: 'Sản phẩm', kind: 'list', risk: 'P0' },
  { route: '/product-variants', label: 'Biến thể sản phẩm', kind: 'list', risk: 'P0' },
  { route: '/technical-documents', label: 'Tài liệu kỹ thuật', kind: 'list', risk: 'P1' },
  { route: '/services', label: 'Dịch vụ', kind: 'list', risk: 'P1' },
  { route: '/projects', label: 'Dự án', kind: 'list', risk: 'P1' },
  { route: '/contacts', label: 'Liên hệ', kind: 'list', risk: 'P0' },
  { route: '/quotes', label: 'Yêu cầu báo giá', kind: 'list', risk: 'P0' },
  { route: '/customers', label: 'Khách hàng', kind: 'list', risk: 'P1' },
  { route: '/import', label: 'Nhập dữ liệu', kind: 'import-list', risk: 'P0' },
  { route: '/import/new', label: 'Thêm dữ liệu', kind: 'import-new', risk: 'P0' },
  { route: '/audit-logs', label: 'Nhật ký hệ thống', kind: 'list', risk: 'P2' },
  { route: '/users', label: 'Người dùng', kind: 'system', risk: 'P2' },
  { route: '/roles', label: 'Vai trò & quyền', kind: 'system', risk: 'P2' },
  { route: '/product-categories/new', label: 'Tạo danh mục', kind: 'create-form', risk: 'P1' },
  { route: '/brands/new', label: 'Tạo thương hiệu', kind: 'create-form', risk: 'P1' },
  { route: '/product-groups/new', label: 'Tạo sản phẩm', kind: 'create-form', risk: 'P0' },
  { route: '/product-variants/new', label: 'Tạo biến thể', kind: 'create-form', risk: 'P0' },
  { route: '/technical-documents/new', label: 'Tạo tài liệu', kind: 'create-form', risk: 'P1' },
  { route: '/banners/new', label: 'Tạo banner', kind: 'create-form', risk: 'P1' },
  { route: '/redirects/new', label: 'Tạo chuyển hướng', kind: 'create-form', risk: 'P2' },
  { route: '/services/new', label: 'Tạo dịch vụ', kind: 'create-form', risk: 'P1' },
  { route: '/projects/new', label: 'Tạo dự án', kind: 'create-form', risk: 'P1' },
  { route: '/customers/new', label: 'Tạo khách hàng', kind: 'create-form', risk: 'P1' }
];

async function main() {
  await assertReachable();
  context.session = await login();
  const routes = await buildRoutes();

  const browser = await openBrowser();
  const page = await createPage(browser.cdpUrl);
  try {
    await page.enable();
    await seedAuth(page, context.session);
    for (const routeSpec of routes) {
      await runRouteCase(page, routeSpec);
    }
  } finally {
    await page.close().catch(() => undefined);
    await browser.close();
  }

  writeReport();
  printSummary();
  if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1;
}

async function buildRoutes() {
  const routes = [...baseRoutes];
  const detailRouteSpecs = [
    { listPath: '/song-thanh/menus', baseRoute: '/menu', anchor: '/menu', label: 'Chi tiết menu', kind: 'form', risk: 'P1' },
    { listPath: '/song-thanh/page-contents', baseRoute: '/page-contents', anchor: '/page-contents', label: 'Chi tiết trang nội dung', kind: 'form', risk: 'P1' },
    { listPath: '/song-thanh/brand-pages', baseRoute: '/page-contents/brand-pages', anchor: '/page-contents/brand-pages', label: 'Chi tiết trang thương hiệu', kind: 'form', risk: 'P1' },
    { listPath: '/song-thanh/banners', baseRoute: '/banners', anchor: '/banners', label: 'Chi tiết banner', kind: 'form', risk: 'P1' },
    { listPath: '/song-thanh/redirects', baseRoute: '/redirects', anchor: '/redirects', label: 'Chi tiết chuyển hướng', kind: 'form', risk: 'P2' },
    { listPath: '/song-thanh/product-categories', baseRoute: '/product-categories', anchor: '/product-categories', label: 'Chi tiết danh mục', kind: 'form', risk: 'P1' },
    { listPath: '/song-thanh/brands', baseRoute: '/brands', anchor: '/brands', label: 'Chi tiết thương hiệu', kind: 'form', risk: 'P0' },
    { listPath: '/song-thanh/product-variants', baseRoute: '/product-variants', anchor: '/product-variants', label: 'Chi tiết biến thể', kind: 'form', risk: 'P0' },
    { listPath: '/song-thanh/technical-documents', baseRoute: '/technical-documents', anchor: '/technical-documents', label: 'Chi tiết tài liệu', kind: 'form', risk: 'P1' },
    { listPath: '/song-thanh/services', baseRoute: '/services', anchor: '/services', label: 'Chi tiết dịch vụ', kind: 'form', risk: 'P1' },
    { listPath: '/song-thanh/projects', baseRoute: '/projects', anchor: '/projects', label: 'Chi tiết dự án', kind: 'form', risk: 'P1' },
    { listPath: '/song-thanh/contacts', baseRoute: '/contacts', anchor: '/contacts', label: 'Chi tiết liên hệ', kind: 'system', risk: 'P0' },
    { listPath: '/song-thanh/quotes', baseRoute: '/quotes', anchor: '/quotes', label: 'Chi tiết báo giá', kind: 'system', risk: 'P0' },
    { listPath: '/song-thanh/customers', baseRoute: '/customers', anchor: '/customers', label: 'Chi tiết khách hàng', kind: 'system', risk: 'P1' },
    { listPath: '/song-thanh/audit-logs', baseRoute: '/audit-logs', anchor: '/audit-logs', label: 'Chi tiết nhật ký', kind: 'system', risk: 'P2' }
  ];

  for (const detailSpec of detailRouteSpecs) {
    const detailRoute = await findFirstDetailRoute(detailSpec.listPath, detailSpec.baseRoute);
    if (!detailRoute) continue;
    insertAfter(routes, detailSpec.anchor, {
      route: detailRoute,
      label: detailSpec.label,
      kind: detailSpec.kind,
      risk: detailSpec.risk
    });
  }

  const productGroupDetail = await findFirstDetailRoute('/song-thanh/product-groups', '/product-groups');
  if (productGroupDetail) {
    insertAfter(routes, '/product-groups/new', {
      route: productGroupDetail,
      label: 'Chi tiết sản phẩm',
      kind: 'product-group-detail',
      risk: 'P0'
    });
  }

  const importDetail = await seedImportRoute();
  if (importDetail) {
    insertAfter(routes, '/import', {
      route: importDetail,
      label: 'Chi tiết lô nhập',
      kind: 'import-detail',
      risk: 'P0',
      qaData: 'Creates one QA import batch and mapping profile; does not apply official data.'
    });
  }

  return routes;
}

async function runRouteCase(page, routeSpec) {
  const started = Date.now();
  try {
    const evidence = await withTimeout(
      inspectRoute(page, routeSpec),
      CASE_TIMEOUT_MS,
      `${routeSpec.route} timed out after ${CASE_TIMEOUT_MS}ms`
    );
    results.push({
      ...routeSpec,
      status: 'PASS',
      duration_ms: Date.now() - started,
      qa_data: routeSpec.qaData || 'No persistent QA data.',
      evidence
    });
  } catch (error) {
    results.push({
      ...routeSpec,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      qa_data: routeSpec.qaData || 'No persistent QA data.',
      error: error?.message || String(error)
    });
  }
}

async function inspectRoute(page, routeSpec) {
  await page.setViewport(1440, 1100, false);
  await page.navigate(adminUrl(routeSpec.route));
  // next dev compiles each dynamic route lazily. Keep this cold-start allowance
  // separate from the content readiness assertion so compiler variance does not
  // masquerade as a functional failure.
  await page.waitForReady(
    `(${routeReady.toString()})(${JSON.stringify(routeSpec.kind)})`,
    ROUTE_READY_TIMEOUT_MS
  );
  await page.waitForReady(
    `(${routeContentReady.toString()})(${JSON.stringify(routeSpec)})`,
    CONTENT_READY_TIMEOUT_MS
  );

  const state = await page.evaluate(`(${inspectAdminRoute.toString()})(${JSON.stringify(routeSpec)})`);
  assert(state.no_runtime_overlay, 'runtime overlay is visible');
  assert(state.has_shell, 'admin shell is missing');
  assert(state.has_breadcrumbs, 'breadcrumbs are missing');
  assert(state.no_horizontal_overflow, `horizontal overflow ${state.overflow_px}px`);
  assert(state.kind_ok, state.kind_reason || 'route kind check failed');

  if (routeSpec.kind === 'product-group-detail') {
    await page.waitForReady(
      `Boolean(document.querySelector('[data-variant-workspace-trigger="true"]'))`,
      CONTENT_READY_TIMEOUT_MS
    );
    const opened = await page.evaluate(`(() => {
      const root = document.querySelector('[data-product-group-workspace="true"]') || document.querySelector('main');
      const button = root?.querySelector('[data-variant-workspace-trigger="true"]');
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert(opened, 'could not open variant highlight workspace');
    await page.waitForReady(`document.body && window.normalizeForQa(document.body.innerText || '').includes('thong so noi bat')`, 5000);
    const highlightState = await page.evaluate(`(() => {
      const text = window.normalizeForQa(document.body.innerText || '');
      return {
        has_highlight_workspace: text.includes('thong so noi bat') && text.includes('preview ngoai web'),
        text_sample: text.slice(0, 240)
      };
    })()`);
    assert(highlightState.has_highlight_workspace, 'highlight workspace did not open');
    state.highlight_workspace = true;
  }

  return state;
}

function routeReady(kind) {
  if (!document.querySelector('[data-admin-breadcrumbs]')) return false;
  if (!document.querySelector('[data-admin-sidebar]') || !document.querySelector('[data-admin-topbar]')) return false;
  if (kind === 'create-form') {
    const main = document.querySelector('main');
    return Boolean(main?.querySelector('form') || main?.querySelector('input, textarea, select'));
  }
  if (kind === 'import-new') {
    return Boolean(
      document.querySelector('[data-import-primary-workflow="true"]') &&
        document.querySelector('[data-import-upload-file="true"]')
    );
  }
  if (kind === 'files') {
    return Boolean(
      document.querySelector('[data-file-zone-nav="true"]') &&
        document.querySelector('[data-file-mode-toggle="true"]')
    );
  }
  if (kind === 'product-group-detail') {
    return Boolean(document.querySelector('[data-product-group-workspace="true"]') || document.querySelector('main form'));
  }
  if (kind === 'import-detail') {
    return Boolean(
      document.querySelector('[data-import-detail-layout="single-column"]') ||
        document.querySelector('[data-import-mapping-stage="true"]')
    );
  }
  return Boolean(document.querySelector('main'));
}

function routeContentReady(routeSpec) {
  const normalize = window.normalizeForQa;
  const kind = routeSpec.kind;
  const main = document.querySelector('main');
  const text = normalize(main?.innerText || document.body?.innerText || '');
  const hasLoadingSkeleton = Boolean(main?.querySelector('.animate-pulse, [class*="skeleton"]'));
  const hasTable = Boolean(main?.querySelector('table'));
  const hasFilterToolbar = Boolean(main?.querySelector('[data-admin-filter-toolbar="true"]'));
  const hasEmptyState =
    text.includes('chua co') ||
    text.includes('khong co') ||
    text.includes('khong co ket qua');
  const hasEditableControl = Boolean(
    main?.querySelector('form') ||
      main?.querySelector('input, textarea, select, [contenteditable="true"]') ||
      Array.from(main?.querySelectorAll('button') || []).some((button) => {
        const label = normalize(button.textContent || button.title || '');
        return label.includes('luu') || label.includes('tao') || label.includes('them');
      })
  );
  if (!main || hasLoadingSkeleton) return false;
  if (kind === 'dashboard') {
    return Boolean(
      document.querySelector('[data-dashboard-traffic="true"]') &&
        document.querySelector('[data-dashboard-featured-products="true"]')
    );
  }
  if (kind === 'list') return hasFilterToolbar || hasTable || hasEmptyState || text.includes('hien thi');
  if (kind === 'form' || kind === 'create-form') return hasEditableControl || text.includes('khong co quyen');
  if (kind === 'system') return hasTable || hasEditableControl || text.length > 120;
  if (kind === 'files') {
    return Boolean(
      document.querySelector('[data-file-zone-nav="true"]') &&
        document.querySelector('[data-file-mode-toggle="true"]')
    );
  }
  if (kind === 'import-list') return hasFilterToolbar || hasTable || text.includes('lo nhap');
  if (kind === 'import-new') {
    return Boolean(
      document.querySelector('[data-import-primary-workflow="true"]') &&
        document.querySelector('[data-import-upload-file="true"]')
    );
  }
  if (kind === 'import-detail') {
    return Boolean(
      document.querySelector('[data-import-detail-layout="single-column"]') ||
        document.querySelector('[data-import-mapping-stage="true"]') ||
        document.querySelector('[data-import-not-ready-card="true"]')
    );
  }
  if (kind === 'product-group-detail') {
    return Boolean(
      document.querySelector('[data-product-group-workspace="true"]') ||
        main.querySelector('form')
    );
  }
  return text.length > 80;
}

function inspectAdminRoute(routeSpec) {
  const normalize = window.normalizeForQa;
  const bodyText = document.body?.innerText || '';
  const text = normalize(bodyText);
  const main = document.querySelector('main');
  const kind = routeSpec.kind;
  const runtimeOverlay = Array.from(
    document.querySelectorAll('nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-dialog]')
  ).some((node) =>
    /Unhandled Runtime Error|Hydration failed|Application error|Failed to compile|Runtime Error|Unexpected server error/i.test(
      node.textContent || ''
    )
  );
  const productionError =
    /Internal Server Error|Application error:\s*a server-side exception|This page could not be found/i.test(
      bodyText
    );
  const overflowPx = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
  let kindOk = true;
  let kindReason = '';

  if (kind === 'dashboard') {
    kindOk = Boolean(
      document.querySelector('[data-dashboard-traffic="true"]') &&
        document.querySelector('[data-dashboard-featured-products="true"]')
    );
    kindReason = 'dashboard is missing traffic or featured-product widgets';
  } else if (kind === 'list') {
    const hasListSurface =
      Boolean(document.querySelector('[data-admin-filter-toolbar="true"]')) ||
      Boolean(document.querySelector('table')) ||
      text.includes('hien thi') ||
      text.includes('chua co') ||
      text.includes('khong co');
    kindOk = hasListSurface;
    kindReason = 'list route has no table, filter toolbar, or empty state';
  } else if (kind === 'create-form' || kind === 'form') {
    kindOk = Boolean(main?.querySelector('form') || main?.querySelector('input, textarea, select'));
    kindReason = 'form route has no editable controls';
  } else if (kind === 'files') {
    kindOk = Boolean(
      document.querySelector('[data-file-zone-nav="true"]') &&
        document.querySelector('[data-file-mode-toggle="true"]') &&
        !document.querySelector('[data-file-detail-drawer="true"]')
    );
    kindReason = 'files route missing zone/mode controls or opened drawer by default';
  } else if (kind === 'import-new') {
    kindOk = Boolean(
      document.querySelector('[data-import-primary-workflow="true"]') &&
        document.querySelector('[data-import-upload-file="true"]') &&
        document.querySelector('[data-import-upload-submit="true"]')
    );
    kindReason = 'import new route missing primary upload workflow';
  } else if (kind === 'import-detail') {
    kindOk = Boolean(
      document.querySelector('[data-import-detail-layout="single-column"]') ||
        document.querySelector('[data-import-mapping-stage="true"]') ||
        document.querySelector('[data-import-not-ready-card="true"]')
    );
    kindReason = 'import detail route missing mapping/detail layout';
  } else if (kind === 'product-group-detail') {
    kindOk = Boolean(document.querySelector('[data-product-group-workspace="true"]') || main?.querySelector('form'));
    kindReason = 'product group detail missing workspace/form';
  }

  return {
    route: routeSpec.route,
    label: routeSpec.label,
    no_runtime_overlay: !runtimeOverlay && !productionError,
    has_shell: Boolean(document.querySelector('[data-admin-sidebar]') && document.querySelector('[data-admin-topbar]')),
    has_breadcrumbs: Boolean(document.querySelector('[data-admin-breadcrumbs]')),
    no_horizontal_overflow: overflowPx <= 2,
    overflow_px: overflowPx,
    kind_ok: kindOk,
    kind_reason: kindOk ? '' : kindReason,
    text_sample: text.slice(0, 260)
  };
}

async function assertReachable() {
  const [api, admin] = await Promise.all([
    requestRaw(`${API_BASE_URL}/health`),
    requestRaw(adminUrl('/login'))
  ]);
  assert(api.status === 200, `API health returned ${api.status}`);
  assert(admin.status < 500, `Admin login returned ${admin.status}`);
}

async function login() {
  const response = await requestJson('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  assert(response.ok, `login returned ${response.status}`);
  const session = unwrap(response);
  assert(session?.access_token, 'login response missing access_token');
  return session;
}

async function seedAuth(page, session) {
  await page.navigate(adminUrl('/login'));
  await page.evaluate(`
    window.sessionStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(
      JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        user: session.user,
        permissions: session.permissions,
        roles: []
      })
    )});
  `);
}

async function findFirstDetailRoute(listPath, adminBaseRoute) {
  try {
    const response = await requestJson(`${listPath}?page=1&page_size=1`, {
      headers: authHeaders()
    });
    const first = extractItems(unwrap(response))[0];
    return first?.id ? `${adminBaseRoute}/${first.id}` : null;
  } catch {
    return null;
  }
}

async function seedImportRoute() {
  if (!existsSync(IMPORT_FIXTURE)) return null;
  try {
    const intake = await requestJson('/song-thanh/import-batches/intake', {
      method: 'POST',
      headers: authHeaders(),
      body: {
        batch_name: `QA admin route ${runId}`,
        source_workbook_path: IMPORT_FIXTURE
      }
    });
    const batchId = readBatchId(intake.payload);
    if (!batchId) return null;
    await requestJson(`/song-thanh/import-batches/${batchId}/confirm-mapping`, {
      method: 'POST',
      headers: authHeaders(),
      body: {
        category_main_column: 'Lớp ông',
        category_sub_column: 'Lớp cha',
        product_group_column: 'Tên SP',
        product_variant_column: 'Lớp con',
        spec_columns: ['Thông số'],
        attribute_columns: ['Loại/Màu'],
        save_mapping_profile: true,
        mapping_profile_name: `QA Admin Route Profile ${runId}`
      }
    }).catch(() => undefined);
    return `/import/${batchId}`;
  } catch {
    return null;
  }
}

async function requestRaw(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body
  });
  return { ok: response.ok, status: response.status, text: await response.text() };
}

async function requestJson(pathname, options = {}) {
  const url = pathname.startsWith('http') ? pathname : `${API_BASE_URL}${pathname}`;
  const headers = {
    Accept: 'application/json',
    'X-Forwarded-For': QA_CLIENT_IP,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { ok: response.ok, status: response.status, payload, text };
}

function authHeaders() {
  assert(context.session?.access_token, 'admin session missing');
  return { Authorization: `Bearer ${context.session.access_token}` };
}

function unwrap(response) {
  return response?.payload?.data ?? response?.payload;
}

function extractItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.import_batches)) return value.import_batches;
  return [];
}

function readBatchId(payload) {
  const data = payload?.data ?? payload;
  return data?.batch?.id || data?.id || null;
}

function insertAfter(routes, anchor, routeSpec) {
  const index = routes.findIndex((item) => item.route === anchor);
  if (index === -1) routes.push(routeSpec);
  else routes.splice(index + 1, 0, routeSpec);
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openBrowser() {
  if (process.env.ADMIN_ROUTE_QA_CDP_URL) {
    return {
      cdpUrl: process.env.ADMIN_ROUTE_QA_CDP_URL.replace(/\/$/, ''),
      close: async () => undefined
    };
  }
  const executable = findBrowserExecutable();
  if (!executable) throw new Error('No Chrome or Edge executable found for admin route QA.');

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'song-thanh-admin-route-qa-'));
  const child = spawn(
    executable,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank'
    ],
    { stdio: 'ignore', detached: false }
  );

  const cdpUrl = `http://127.0.0.1:${CDP_PORT}`;
  await waitForCdp(cdpUrl);
  return {
    cdpUrl,
    close: async () => {
      await closeSpawnedBrowser(child, userDataDir);
    }
  };
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

async function waitForCdp(cdpUrl) {
  const started = Date.now();
  while (Date.now() - started < 10000) {
    try {
      const response = await fetch(`${cdpUrl}/json/version`);
      if (response.ok) return;
    } catch {
      // Browser is still starting.
    }
    await delay(250);
  }
  throw new Error(`CDP browser did not start at ${cdpUrl}`);
}

async function createPage(cdpUrl) {
  let response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent('about:blank')}`);
  if (response.status === 405) {
    response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' });
  }
  const target = await response.json();
  return new CdpPage(target.webSocketDebuggerUrl);
}

class CdpPage {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
  }

  async enable() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => this.onMessage(event));
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.installQaHelpers();
  }

  async installQaHelpers() {
    await this.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.normalizeForQa = function normalizeForQa(value) {
          return String(value || '')
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/[\\u0111\\u0110]/g, function(char) { return char === '\\u0111' ? 'd' : 'D'; })
            .toLowerCase()
            .replace(/\\s+/g, ' ')
            .trim();
        };
      `
    });
  }

  onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, timeout } = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(timeout);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }

    if (message.method && this.eventWaiters.has(message.method)) {
      const waiters = this.eventWaiters.get(message.method);
      this.eventWaiters.delete(message.method);
      for (const waiter of waiters) waiter.resolve(message.params);
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, CDP_COMMAND_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async setViewport(width, height, mobile) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile
    }).catch(() => undefined);
  }

  async navigate(url) {
    const result = await this.send('Page.navigate', { url });
    if (result?.errorText) {
      throw new Error(`Navigation failed for ${url}: ${result.errorText}`);
    }
    await this.waitForLoadState(url, NAVIGATION_TIMEOUT_MS);
  }

  async waitForReady(expression, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const ready = await this.evaluate(expression);
        if (ready) return;
      } catch {
        // Page may still be hydrating.
      }
      await delay(200);
    }
    throw new Error(`Page did not become ready for expression: ${expression.slice(0, 100)}`);
  }

  async waitForLoadState(expectedUrl, timeoutMs) {
    const expectedLocation = new URL(expectedUrl);
    const normalizedExpectedUrl = expectedLocation.href;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const state = await this.evaluate(
          `({ readyState: document.readyState, href: window.location.href })`
        );
        const actualLocation = state?.href ? new URL(state.href) : null;
        // List pages may normalize harmless defaults such as
        // `deleted_scope=active` after the initial navigation. The route test
        // owns pathname/content assertions below, so accept that canonical
        // query while still rejecting a redirect to another screen or origin.
        const atExpectedUrl = Boolean(
          actualLocation &&
            actualLocation.origin === expectedLocation.origin &&
            actualLocation.pathname === expectedLocation.pathname
        );
        if (
          atExpectedUrl &&
          (state?.readyState === 'interactive' || state?.readyState === 'complete')
        ) {
          return;
        }
      } catch {
        // Navigation may still be committing.
      }
      await delay(150);
    }
    throw new Error(`Navigation did not settle at ${normalizedExpectedUrl}`);
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed');
    return result.result?.value;
  }

  async close() {
    for (const pending of this.pending.values()) clearTimeout(pending.timeout);
    this.pending.clear();
    if (this.ws) this.ws.close();
  }
}

function writeReport() {
  const reportPath = path.join(ROOT, 'docs', 'working-notes', 'admin-route-qa-last-run.md');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [
    '# Admin route QA last run',
    '',
    `Run id: \`${runId}\``,
    `Date: \`${new Date().toISOString()}\``,
    `Target: \`${ADMIN_BASE_URL}${ADMIN_BASE_PATH}\``,
    '',
    '| Route | Risk | Result | Duration | QA data | Notes |',
    '| --- | --- | --- | ---: | --- | --- |'
  ];
  for (const result of results) {
    const notes = result.status === 'PASS' ? compact(result.evidence) : result.error;
    lines.push(
      `| ${result.route} | ${result.risk} | ${result.status} | ${result.duration_ms}ms | ${escapeTable(
        result.qa_data
      )} | ${escapeTable(notes)} |`
    );
  }
  lines.push('', 'Generated by `node scripts/qa/admin-route-smoke.mjs`.');
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

function printSummary() {
  const failed = results.filter((result) => result.status === 'FAIL');
  console.log(`Admin route QA run ${runId}`);
  for (const result of results) {
    const suffix = result.status === 'PASS' ? '' : ` - ${result.error}`;
    console.log(`${result.status} ${result.route}${suffix}`);
  }
  console.log(`Report: ${path.join(ROOT, 'docs', 'working-notes', 'admin-route-qa-last-run.md')}`);
  console.log(`Summary: ${results.length - failed.length}/${results.length} passed`);
}

function compact(value) {
  if (!value) return '';
  const text = JSON.stringify(value);
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
