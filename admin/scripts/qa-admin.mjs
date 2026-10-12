import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { closeSpawnedBrowser } from '../../scripts/qa/lib/browser-process.mjs';

const ADMIN_BASE_URL = (process.env.ADMIN_BASE_URL || 'http://localhost:3001').replace(
  /\/$/,
  ''
);
const ADMIN_BASE_PATH = normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || '/admin');
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const STORAGE_KEY = 'song-thanh-admin-auth';
const CDP_PORT = Number(process.env.ADMIN_QA_CDP_PORT || 9223);
const QA_IMPORT_PROFILE_FIXTURE = path.resolve(
  process.cwd(),
  '..',
  'scripts',
  'qa',
  'fixtures',
  'qa-import-mapping-profile.csv'
);

function normalizeAdminBasePath(basePath) {
  const trimmed = basePath.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}` : '';
}

function adminUrl(route) {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  return `${ADMIN_BASE_URL}${ADMIN_BASE_PATH}${normalizedRoute}`;
}

const baseRoutes = [
  '/dashboard',
  '/website-settings',
  '/menu',
  '/page-contents',
  '/banners',
  '/redirects',
  '/files',
  '/product-categories',
  '/product-categories/main',
  '/product-categories/sub',
  '/brands',
  '/product-groups',
  '/product-variants',
  '/technical-documents',
  '/services',
  '/projects',
  '/contacts',
  '/quotes',
  '/import',
  '/import/new',
  '/audit-logs',
  '/users',
  '/roles',
  '/product-categories/new',
  '/brands/new',
  '/product-groups/new',
  '/product-variants/new',
  '/technical-documents/new',
  '/page-contents/new',
  '/banners/new',
  '/redirects/new',
  '/services/new',
  '/projects/new'
];

const routeLabels = {
  '/dashboard': 'Tổng quan',
  '/website-settings': 'Cấu hình website',
  '/menu': 'Menu điều hướng',
  '/page-contents': 'Trang nội dung',
  '/banners': 'Banner',
  '/redirects': 'Chuyển hướng',
  '/files': 'Kho tệp',
  '/product-categories': 'Danh mục sản phẩm',
  '/product-categories/main': 'Danh mục chính',
  '/product-categories/sub': 'Danh mục con',
  '/brands': 'Thương hiệu',
  '/product-groups': 'Sản phẩm',
  '/product-variants': 'Biến thể sản phẩm',
  '/technical-documents': 'Tài liệu kỹ thuật',
  '/services': 'Dịch vụ',
  '/projects': 'Dự án',
  '/contacts': 'Liên hệ',
  '/quotes': 'Yêu cầu báo giá',
  '/import': 'Nhập dữ liệu',
  '/import/new': 'Thêm dữ liệu',
  '/audit-logs': 'Nhật ký hệ thống',
  '/users': 'Người dùng',
  '/roles': 'Vai trò & quyền'
};

async function main() {
  await assertReachable(adminUrl('/login'), 'Admin dev server');
  const session = await login();
  const productGroupDetailRoute = await findEntityDetailRoute(
    session.access_token,
    `${API_BASE_URL}/song-thanh/product-groups?page=1&page_size=1`,
    '/product-groups'
  );
  const importDetailRoute =
    (process.env.QA_MUTATING_TESTS_CONFIRMED === '1'
      ? await seedImportMappingProfileRoute(session.access_token)
      : null) ||
    (await findImportDetailRoute(session.access_token));
  const routes = [...baseRoutes];
  if (productGroupDetailRoute) {
    const insertAfter = routes.indexOf('/product-groups/new');
    routes.splice(insertAfter + 1, 0, productGroupDetailRoute);
  }
  if (importDetailRoute) {
    const insertAfter = routes.indexOf('/import');
    routes.splice(insertAfter + 1, 0, importDetailRoute);
  }

  const browser = await openBrowser();
  const page = await createPage(browser.cdpUrl);

  try {
    await page.enable();
    await seedAuth(page, session);

    const rows = [];
    for (const route of routes) {
      const errorsBefore = page.runtimeErrors.length;
      await page.navigate(adminUrl(route));
      await waitForRouteReady(page, route);

      const routeState = await page.evaluate(
        `(${inspectRoute.toString()})(${JSON.stringify(route)}, ${JSON.stringify(
          routeLabels
        )})`
      );
      const interaction = await page.evaluate(
        `(${exerciseInteractions.toString()})(${JSON.stringify(route)})`
      );
      const runtimeMessages = page.runtimeErrors
        .slice(errorsBefore)
        .filter((entry) => !isIgnoredRuntimeMessage(entry));

      const row = {
        route,
        runtime: routeState.runtime && runtimeMessages.length === 0,
        shell: routeState.shell,
        breadcrumb: routeState.breadcrumb,
        topbar: routeState.topbar && interaction.topbar !== 'FAIL',
        controls: routeState.controls && interaction.controls !== 'FAIL',
        detailLayout:
          routeState.detailLayout && interaction.detailLayout !== 'FAIL',
        result:
          routeState.runtime &&
          routeState.shell &&
          routeState.breadcrumb &&
          routeState.topbar &&
          routeState.controls &&
          routeState.detailLayout &&
          runtimeMessages.length === 0 &&
          interaction.topbar !== 'FAIL' &&
          interaction.controls !== 'FAIL' &&
          interaction.detailLayout !== 'FAIL',
        evidence: {
          ...routeState.evidence,
          interaction
        },
        runtimeMessages
      };

      rows.push(row);
    }

    printResults(rows, Boolean(importDetailRoute));
    if (rows.some((row) => !row.result)) {
      process.exitCode = 1;
    }
  } finally {
    await page.close().catch(() => undefined);
    await browser.close();
  }
}

async function waitForRouteReady(page, route) {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    const ready = await page.evaluate(
      `(${isRouteReady.toString()})(${JSON.stringify(route)})`
    );
    if (ready) return;
    await page.wait(250);
  }
}

async function assertReachable(url, label) {
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok && response.status >= 500) {
      throw new Error(`${label} returned ${response.status}`);
    }
  } catch (error) {
    throw new Error(
      `${label} is not reachable at ${url}. Start API + Admin before running qa:admin. ${error.message}`
    );
  }
}

async function login() {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '192.0.2.70'
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  const payload = await safeJson(response);
  if (!response.ok || !payload?.ok) {
    throw new Error(`Login failed: HTTP ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.data;
}

async function seedImportMappingProfileRoute(accessToken) {
  if (!existsSync(QA_IMPORT_PROFILE_FIXTURE)) {
    return null;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const profileBatch = await fetchJson(`${API_BASE_URL}/song-thanh/import-batches/intake`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      batch_name: `QA profile seed ${Date.now()}`,
      source_workbook_path: QA_IMPORT_PROFILE_FIXTURE
    })
  });
  const profileBatchId = readBatchId(profileBatch);
  if (!profileBatchId) return null;

  const confirmResponse = await fetchJson(
    `${API_BASE_URL}/song-thanh/import-batches/${profileBatchId}/confirm-mapping`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        category_main_column: 'Lớp ông',
        category_sub_column: 'Lớp cha',
        product_group_column: 'Tên SP',
        product_variant_column: 'Lớp con',
        spec_columns: ['Thông số'],
        attribute_columns: ['Loại/Màu'],
        save_mapping_profile: true,
        mapping_profile_name: 'QA Mapping Profile Fixture'
      })
    }
  );
  if (!confirmResponse?.ok) return null;

  const recognizedBatch = await fetchJson(`${API_BASE_URL}/song-thanh/import-batches/intake`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      batch_name: `QA recognized ${Date.now()}`,
      source_workbook_path: QA_IMPORT_PROFILE_FIXTURE
    })
  });
  const recognizedBatchId = readBatchId(recognizedBatch);
  return recognizedBatchId ? `/import/${recognizedBatchId}` : null;
}

async function findImportDetailRoute(accessToken) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/song-thanh/import-batches?page=1&page_size=20`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    const payload = await safeJson(response);
    const data = payload?.data;
    const items = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.import_batches)
          ? data.import_batches
          : [];
    const notReady = items.find(
      (item) =>
        !['ready_to_apply', 'applied'].includes(String(item?.status || ''))
    );
    return notReady?.id ? `/import/${notReady.id}` : null;
  } catch {
    return null;
  }
}

function readBatchId(payload) {
  const data = payload?.data ?? payload;
  return data?.batch?.id || data?.id || null;
}

async function fetchJson(url, options) {
  try {
    const response = await fetch(url, options);
    const payload = await safeJson(response);
    if (!response.ok) {
      return { ok: false, status: response.status, payload };
    }
    return payload;
  } catch {
    return null;
  }
}

async function findEntityDetailRoute(accessToken, url, baseRoute) {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await safeJson(response);
    const data = payload?.data;
    const items = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.import_batches)
          ? data.import_batches
          : [];
    const id = items[0]?.id;
    return id ? `${baseRoute}/${id}` : null;
  } catch {
    return null;
  }
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

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function openBrowser() {
  if (process.env.ADMIN_QA_CDP_URL) {
    return {
      cdpUrl: process.env.ADMIN_QA_CDP_URL.replace(/\/$/, ''),
      close: async () => undefined
    };
  }

  const executable = findBrowserExecutable();
  if (!executable) {
    throw new Error('No Chrome or Edge executable found for browser QA.');
  }

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'song-thanh-admin-qa-'));
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
    {
      stdio: 'ignore',
      detached: false
    }
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
      // Wait for browser startup.
    }
    await delay(250);
  }
  throw new Error(`CDP browser did not start at ${cdpUrl}`);
}

async function createPage(cdpUrl) {
  let response = await fetch(
    `${cdpUrl}/json/new?${encodeURIComponent('about:blank')}`
  );
  if (response.status === 405) {
    response = await fetch(
      `${cdpUrl}/json/new?${encodeURIComponent('about:blank')}`,
      { method: 'PUT' }
    );
  }
  const target = await response.json();
  return new CdpPage(target.webSocketDebuggerUrl);
}

class CdpPage {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.runtimeErrors = [];
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
    await this.send('Log.enable');
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false
    }).catch(() => undefined);
  }

  onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
      return;
    }

    if (message.method === 'Runtime.exceptionThrown') {
      this.runtimeErrors.push(
        message.params?.exceptionDetails?.text || 'Runtime exception'
      );
    }

    if (
      message.method === 'Log.entryAdded' &&
      message.params?.entry?.level === 'error'
    ) {
      this.runtimeErrors.push(message.params.entry.text || 'Log error');
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 10000);
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await this.wait(1200);
    await this.evaluate('document.readyState');
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Evaluation failed');
    }
    return result.result?.value;
  }

  wait(ms) {
    return delay(ms);
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

function inspectRoute(route, labels) {
  const text = document.body?.innerText || '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  const normalizeAscii = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0111\u0110]/g, (char) => (char === '\u0111' ? 'd' : 'D'))
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const normalizedAscii = normalizeAscii(normalized);
  const breadcrumbText =
    document.querySelector('[data-admin-breadcrumbs]')?.innerText || '';
  const breadcrumbAscii = normalizeAscii(breadcrumbText);
  const quickNavInput = document.querySelector(
    '[data-topbar-quick-nav="true"] input'
  );
  const topbarPlaceholder = quickNavInput?.getAttribute('placeholder') || '';
  const topbarPlaceholderAscii = normalizeAscii(topbarPlaceholder);
  const main = document.querySelector('main');
  const mainText = main?.innerText || '';
  const mainAscii = normalizeAscii(mainText);

  const shell = Boolean(
    document.querySelector('[data-admin-sidebar]') &&
      document.querySelector('[data-admin-topbar]')
  );
  const runtimeOverlay = Array.from(
    document.querySelectorAll(
      'nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-dialog]'
    )
  ).some((node) =>
    /Unhandled Runtime Error|Hydration failed|Application error|Failed to compile|Runtime Error/i.test(
      node.textContent || ''
    )
  );

  const isCreateRoute = route.endsWith('/new');
  const routeParts = route.split('/').filter(Boolean);
  const looksLikeUuid =
    routeParts.length >= 2 &&
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(routeParts[routeParts.length - 1] || '');
  const baseRoute = looksLikeUuid
    ? `/${routeParts.slice(0, -1).join('/')}`
    : isCreateRoute
      ? route.replace(/\/new$/, '')
      : route.startsWith('/import/')
        ? '/import'
        : route;
  const expectedLabel = labels[baseRoute];
  const expectedLabelAscii = normalizeAscii(expectedLabel);
  const topbarOk =
    topbarPlaceholderAscii.includes('tim man hinh quan tri') &&
    !topbarPlaceholderAscii.includes('ma hoac ten ban ghi');

  const breadcrumbOk =
    route === '/dashboard'
      ? breadcrumbAscii.includes('tong quan')
      : breadcrumbAscii.includes('tong quan') &&
        Boolean(expectedLabelAscii) &&
        breadcrumbAscii.includes(expectedLabelAscii);

  const usersRolesFakeCrud =
    ['/users', '/roles'].includes(route) &&
    Array.from(main?.querySelectorAll('button, a') || []).some((node) => {
      const value = (node.textContent || '').trim();
      return ['T?o', 'S?a', 'L?u', 'X?a', 'Kh?i ph?c', 'L?u tr?'].some(
        (label) => value === label || value.startsWith(label + ' ')
      );
    });

  const filesPanelVisibleByDefault =
    route === '/files' && Boolean(document.querySelector('[data-file-detail-drawer="true"]'));
  const dashboardTrafficMissing =
    route === '/dashboard' && !document.querySelector('[data-dashboard-traffic="true"]');
  const dashboardFeaturedProductsMissing =
    route === '/dashboard' &&
    !document.querySelector('[data-dashboard-featured-products="true"]');

  const tableHeadersAscii = Array.from(
    document.querySelectorAll('thead th')
  ).map((node) => normalizeAscii(node.textContent || ''));
  const emptyRecordsVisible =
    mainAscii.includes('chua co ban ghi phu hop') ||
    mainAscii.includes('chua co ban ghi nao') ||
    mainAscii.includes('chua co danh muc nao') ||
    mainAscii.includes('chua co danh muc phu hop') ||
    mainAscii.includes('chua co thuong hieu nao') ||
    mainAscii.includes('chua co thuong hieu phu hop') ||
    mainAscii.includes('chua co san pham nao') ||
    mainAscii.includes('chua co san pham phu hop') ||
    mainAscii.includes('chua co nhom san pham nao') ||
    mainAscii.includes('chua co nhom san pham phu hop') ||
    mainAscii.includes('chua co bien the nao') ||
    mainAscii.includes('chua co tai lieu nao') ||
    mainAscii.includes('chua co tai lieu ky thuat phu hop');
  const productCategoryLevelSelect = document.querySelector(
    '[data-product-category-level-select="true"]'
  );
  const productCategoryParentSelect = document.querySelector(
    '[data-product-category-parent-select="true"]'
  );
  const productGroupLevel1Select = document.querySelector(
    '[data-product-group-level1-select="true"]'
  );
  const productGroupLevel2Select = document.querySelector(
    '[data-product-group-level2-select="true"]'
  );
  const productGroupBrandSelect = document.querySelector(
    '[data-product-group-brand-select="true"]'
  );
  const productVariantGroupSelect = document.querySelector(
    '[data-product-variant-group-select="true"]'
  );
  const productVariantPriceModeSelect = document.querySelector(
    '[data-product-variant-price-mode-select="true"]'
  );
  const productVariantAdvanced = document.querySelector(
    '[data-product-variant-advanced="true"]'
  );
  const technicalDocumentGroupSelect = document.querySelector(
    '[data-technical-document-group-select="true"]'
  );
  const technicalDocumentVariantSelect = document.querySelector(
    '[data-technical-document-variant-select="true"]'
  );
  const productDeleteButtons = document.querySelectorAll(
    '[data-product-delete-button="true"]'
  );
  const toolbar = document.querySelector('[data-admin-filter-toolbar]');
  const toolbarAscii = normalizeAscii(toolbar?.innerText || '');
  const toolbarAllAscii = normalizeAscii(toolbar?.textContent || '');
  const toolbarDateInput = toolbar?.querySelector('input[type="date"]');
  const productClusterListRoutes = [
    '/product-categories',
    '/product-categories/main',
    '/product-categories/sub',
    '/brands',
    '/product-groups',
    '/product-variants',
    '/technical-documents'
  ];
  const productClusterBaseRoutes = [
    '/product-categories',
    '/brands',
    '/product-groups',
    '/product-variants',
    '/technical-documents'
  ];
  const productClusterDateFilterRoutes = [
    '/product-categories',
    '/product-categories/main',
    '/product-categories/sub',
    '/brands',
    '/technical-documents'
  ];

  const advancedSeoCreateRoutes = [
    '/product-groups/new',
    '/services/new',
    '/projects/new'
  ];
  const noSeoCreateRoutes = [
    '/product-variants/new',
    '/technical-documents/new',
    '/banners/new',
    '/redirects/new'
  ];
  const filesZoneNav = document.querySelector('[data-file-zone-nav="true"]');
  const filesUploadOpen = document.querySelector('[data-file-upload-open="true"]');
  const filesUploadDisabledReason = document.querySelector(
    '[data-file-upload-disabled-reason="true"]'
  );
  const filesModeToggle = document.querySelector('[data-file-mode-toggle="true"]');
  const filesUsageMode = document.querySelector('[data-file-mode="usage"]');
  const filesAllMode = document.querySelector('[data-file-mode="files"]');
  const filesUsageRecords = document.querySelector('[data-file-usage-records="true"]');
  const filesLinkedFiles = document.querySelector('[data-file-linked-files="true"]');
  const createSystemRailVisible =
    isCreateRoute && Boolean(document.querySelector('[data-record-system-rail="true"]'));
  const createFormMissing =
    isCreateRoute &&
    route !== '/page-contents/new' &&
    !main?.querySelector('form');
  const pageContentCreateHubMissing =
    route === '/page-contents/new' &&
    !document.querySelector('[data-page-content-create-hub="true"]');
  const pickerCopyBroken =
    isCreateRoute &&
    (mainAscii.includes('chua chon lien ket') ||
      mainAscii.includes('id ky thuat') ||
      mainAscii.includes('lien ket ky thuat'));
  const advancedSeoMissing =
    advancedSeoCreateRoutes.includes(route) &&
    !document.querySelector('[data-advanced-seo="true"]') &&
    !mainAscii.includes('seo & duong dan');
  const unexpectedSeoVisible =
    noSeoCreateRoutes.includes(route) &&
    (mainAscii.includes('seo nang cao') ||
      mainAscii.includes('tieu de seo') ||
      mainAscii.includes('mo ta seo') ||
      mainAscii.includes('anh chia se seo'));
  const filesZoneNavMissing = route === '/files' && !filesZoneNav;
  const filesUploadEntryMissing =
    route === '/files' && !filesUploadOpen && !filesUploadDisabledReason;
  const filesUploadDisabledWithoutReason =
    route === '/files' &&
    filesUploadOpen instanceof HTMLButtonElement &&
    filesUploadOpen.disabled &&
    !filesUploadDisabledReason;
  const filesModeToggleMissing = route === '/files' && !filesModeToggle;
  const filesModeButtonsMissing = route === '/files' && (!filesUsageMode || !filesAllMode);
  const filesUsageLayoutMissing =
    route === '/files' && (!filesUsageRecords || !filesLinkedFiles);

  const importUploadInput = document.querySelector(
    '[data-import-upload-file="true"]'
  );
  const importAdvancedSection = document.querySelector(
    '[data-import-technical-options="true"]'
  );
  const importSourcePathInput = document.querySelector(
    '[data-import-source-path="true"]'
  );
  const importUploadAccept = importUploadInput?.getAttribute('accept') || '';
  const importUploadCard = document.querySelector(
    '[data-import-primary-workflow="true"]'
  );
  const importBatchList = document.querySelector('[data-import-batch-list="true"]');
  const importSpecNote = document.querySelector('[data-import-spec-note="true"]');
  const importSpecDetails = document.querySelector(
    '[data-import-spec-columns-details="true"]'
  );
  const uploadRect = importUploadCard?.getBoundingClientRect();
  const listRect = importBatchList?.getBoundingClientRect();
  const importMainContent = document.querySelector('[data-import-main-content="true"]');
  const importMainContentRect = importMainContent?.getBoundingClientRect();
  const importDetailLayout = document.querySelector(
    '[data-import-detail-layout="single-column"]'
  );
  const importVisibleText = route.startsWith('/import')
    ? main?.innerText || text
    : '';
  const importMojibakeTokens = [
    'D\u00C3\u00B2NG',
    'T\u00C3\u00AAp',
    'NG\u00C3',
    'B\u00E1\u00BA\u00A3n xem tr\u00C6\u00B0\u00E1\u00BB\u203A',
    'XUNG \u00C4\u2018\u00E1\u00BB\u2122T M\u00C3\u00BB\u0178',
    'TH\u00E1\u00BB\u009DI \u00C4\u2018i\u00E1\u00BB\u0192m',
    'GHI CH\u00C3',
    'Nh\u0103\u00B3m',
    'Bi\u00E1\u00BA\u00BFn th\u00E1\u00BB\u0192',
    'D\u00E1\u00BB\u00AF li\u00E1\u00BB\u2021u'
  ];
  const importMatchedMojibakeTokens = route.startsWith('/import')
    ? importMojibakeTokens.filter((token) => importVisibleText.includes(token))
    : [];
  const importMojibakeVisible = importMatchedMojibakeTokens.length > 0;

  const importUploadContractBroken =
    route === '/import/new' &&
    (!importUploadInput ||
      !importAdvancedSection ||
      !importSourcePathInput ||
      !importUploadAccept.includes('.xlsx') ||
      !importUploadAccept.includes('.csv') ||
      !importAdvancedSection.contains(importSourcePathInput));

  const importPrimaryWorkflowBroken =
    route === '/import/new' &&
    (!uploadRect || uploadRect.width < 680 || uploadRect.height < 260 || importBatchList);

  const importHelperDensityBroken =
    route === '/import/new' &&
    (!importSpecNote ||
      normalizedAscii.includes('cot thong so chua anh xa') ||
      (document.querySelector('[data-import-preview="true"]') &&
        (!importSpecDetails || importSpecDetails.open)));

  const importRawErrorVisible =
    route === '/import/new' &&
    normalized.includes('source_workbook_path is not a readable .xlsx file.');
  const importNotReadyCard = document.querySelector(
    '[data-import-not-ready-card="true"]'
  );
  const importAppliedCard = document.querySelector(
    '[data-import-applied-card="true"]'
  );
  const importOpenGroupsButton = document.querySelector(
    '[data-import-open-groups="true"]'
  );
  const importOpenVariantsButton = document.querySelector(
    '[data-import-open-variants="true"]'
  );
  const importOpenReadinessButton = document.querySelector(
    '[data-import-open-readiness="true"]'
  );
  const importApplyGuard = document.querySelector(
    '[data-import-apply-guard="true"]'
  );
  const importApplyButton = document.querySelector(
    '[data-import-apply-button="true"]'
  );
  const importMappingStage = document.querySelector(
    '[data-import-mapping-stage="true"]'
  );
  const importMappingPanel = document.querySelector(
    '[data-import-column-mapping="true"]'
  );
  const importMappingSubmit = document.querySelector(
    '[data-import-mapping-submit="true"]'
  );
  const importUseSuggestedMapping = document.querySelector(
    '[data-import-use-suggested-mapping="true"]'
  );
  const importUseManualMapping = document.querySelector(
    '[data-import-use-manual-mapping="true"]'
  );
  const importRecognizedProfileCard = document.querySelector(
    '[data-import-mapping-recognized-profile="true"]'
  );
  const importUseRecognizedProfile = document.querySelector(
    '[data-import-use-recognized-profile="true"]'
  );
  const importRequiredMappingRoles = Array.from(
    document.querySelectorAll('[data-import-required-role]')
  );
  const importTechnicalDetails = document.querySelector(
    '[data-import-technical-details="true"]'
  );
  const importDeleteButton = document.querySelector(
    '[data-import-delete-button="true"]'
  );
  const importInlineDeleteButton = document.querySelector(
    '[data-import-inline-delete="true"]'
  );
  const importInlineArchiveButton = document.querySelector(
    '[data-import-inline-archive="true"]'
  );
  const importInlineRestoreButton = document.querySelector(
    '[data-import-inline-restore="true"]'
  );
  const importNotReadyAscii = normalizeAscii(importNotReadyCard?.innerText || '');
  const importAppliedAscii = normalizeAscii(importAppliedCard?.innerText || '');
  const importApplyGuardAscii = normalizeAscii(importApplyGuard?.innerText || '');
  const importApplyButtonDisabled =
    importApplyButton instanceof HTMLButtonElement ? importApplyButton.disabled : null;
  const importNotReadyHasTitle = importNotReadyAscii.includes('chua san sang ap dung');
  const importNotReadyHasReason = importNotReadyAscii.includes(
    'lo nhap chua du dieu kien de ap dung vao du lieu chinh thuc'
  );
  const importNotReadyHasStatus =
    importNotReadyAscii.includes('trang thai') &&
    importNotReadyAscii.includes('san sang ap dung');
  const importNotReadyHasPending = `${importNotReadyAscii} ${importApplyGuardAscii}`.includes(
    'dong can kiem tra hoac duyet'
  );
  const importNotReadyHasApproved = `${importNotReadyAscii} ${importApplyGuardAscii}`.includes(
    'chua co dong nao duoc duyet de ap dung'
  );
  const importAppliedHasTitle = importAppliedAscii.includes(
    'da ap dung vao du lieu chinh thuc'
  );
  const importAppliedHasDone =
    importAppliedAscii.includes('lo nhap nay da hoan tat ap dung') ||
    importAppliedAscii.includes('lo nhap da ap dung xong');
  const importPreviewWarningItems = Array.from(
    document.querySelectorAll('[data-import-preview="true"] section ul li')
  )
    .map((node) => normalizeAscii(node.textContent || ''))
    .filter(Boolean);
  const importPreviewWarningDuplicates =
    importPreviewWarningItems.length > 0 &&
    new Set(importPreviewWarningItems).size !== importPreviewWarningItems.length;
  const importNotReadyRawVisible =
    route.startsWith('/import/') &&
    route !== '/import/new' &&
    (normalized.includes('HTTP 409') ||
      normalized.includes('IMPORT_NOT_READY') ||
      normalized.includes('IMPORT_BATCH_STATUS_NOT_READY') ||
      normalized.includes('IMPORT_PENDING_REVIEW_ROWS') ||
      normalized.includes('IMPORT_NO_APPROVED_ROWS') ||
      normalized.includes('"blockers"'));
  const importMappingContractBroken =
    route.startsWith('/import/') &&
    route !== '/import/new' &&
    importMappingStage &&
    (!importMappingPanel ||
      !(importMappingSubmit instanceof HTMLButtonElement) ||
      importRequiredMappingRoles.length < 4 ||
      !(importUseSuggestedMapping instanceof HTMLElement) ||
      !(importUseManualMapping instanceof HTMLElement) ||
      !(importRecognizedProfileCard instanceof HTMLElement) ||
      !(importUseRecognizedProfile instanceof HTMLElement));
  const importNotReadyContractBroken =
    route.startsWith('/import/') &&
    route !== '/import/new' &&
    !importMappingStage &&
    !importAppliedCard &&
    importNotReadyCard &&
    (!(importApplyButton instanceof HTMLButtonElement) ||
      !importApplyButtonDisabled ||
      !importApplyGuard ||
      !importNotReadyHasTitle ||
      !importNotReadyHasReason ||
      !importNotReadyHasStatus ||
      !importNotReadyHasPending ||
      !importNotReadyHasApproved ||
      !importOpenGroupsButton ||
      !importOpenVariantsButton ||
      !importOpenReadinessButton ||
      !importTechnicalDetails ||
      importTechnicalDetails.open);
  const importAppliedContractBroken =
    route.startsWith('/import/') &&
    route !== '/import/new' &&
    !importMappingStage &&
    importAppliedCard &&
    (!importAppliedHasTitle ||
      !importAppliedHasDone ||
      !importOpenGroupsButton ||
      !importOpenVariantsButton ||
      !importOpenReadinessButton ||
      (importApplyButton instanceof HTMLButtonElement) ||
      Boolean(importNotReadyCard) ||
      !importTechnicalDetails ||
      importTechnicalDetails.open);
  const importDetailLayoutBroken =
    route.startsWith('/import/') &&
    route !== '/import/new' &&
    (!importDetailLayout ||
      !importMainContentRect ||
      importMainContentRect.width < 780 ||
      (!importMappingStage &&
        document.querySelectorAll('[data-import-not-ready-card="true"]').length > 1));
  const importDeleteButtonMissing =
    route.startsWith('/import/') &&
    route !== '/import/new' &&
    !importDeleteButton &&
    !document.querySelector('[data-import-archive-button="true"]');
  const importListHasItems = Boolean(
    main?.querySelector('[data-import-batch-list="true"] article')
  );
  const importInlineDeleteButtonMissing =
    route === '/import' &&
    importListHasItems &&
    !importInlineDeleteButton &&
    !importInlineArchiveButton &&
    !importInlineRestoreButton;

  const productCategoryCreateBroken =
    route === '/product-categories/new' &&
    (!productCategoryLevelSelect ||
      !mainAscii.includes('danh muc cap 1 / lop ong') ||
      !mainAscii.includes('danh muc cap 2 / lop cha'));
  const brandCreateBroken =
    route === '/brands/new' &&
    (Boolean(document.querySelector('[data-brand-level1-select="true"]')) ||
      mainAscii.includes('danh muc cap 1 / lop ong'));
  const productGroupCreateBroken =
    route === '/product-groups/new' &&
    (!productGroupLevel1Select ||
      !productGroupLevel2Select ||
      !productGroupBrandSelect ||
      !(
        mainAscii.includes('danh muc cap 1 / lop ong') ||
        mainAscii.includes('danh muc chinh')
      ) ||
      !(
        mainAscii.includes('danh muc cap 2 / lop cha') ||
        mainAscii.includes('danh muc con')
      ));
  const productVariantCreateBroken =
    route === '/product-variants/new' &&
    (!productVariantGroupSelect ||
      !productVariantPriceModeSelect ||
      !(productVariantAdvanced instanceof HTMLDetailsElement) ||
      productVariantAdvanced.open ||
      mainAscii.includes('chon trang thai duyet') ||
      mainAscii.includes('chon trang thai xuat ban'));
  const technicalDocumentCreateBroken =
    route === '/technical-documents/new' &&
    (!technicalDocumentGroupSelect || !technicalDocumentVariantSelect);

  const productCategoryListBroken =
    route === '/product-categories' &&
    !emptyRecordsVisible &&
    (!document.querySelector('[data-product-category-overview="true"]') ||
      !document.querySelector('[data-product-category-tree="true"]') ||
      !mainAscii.includes('danh muc chinh') ||
      !mainAscii.includes('danh muc con'));
  const productCategoryMainBroken =
    route === '/product-categories/main' &&
    (!document.querySelector('[data-product-category-scope="main"]') ||
      !mainAscii.includes('danh muc chinh'));
  const productCategorySubBroken =
    route === '/product-categories/sub' &&
    (!document.querySelector('[data-product-category-scope="sub"]') ||
      !mainAscii.includes('danh muc con'));
  const brandListBroken =
    route === '/brands' &&
    !emptyRecordsVisible &&
    !(
      tableHeadersAscii.includes('thuong hieu') &&
      tableHeadersAscii.includes('logo') &&
      !tableHeadersAscii.includes('danh muc cap 1')
    );
  const productGroupListBroken =
    route === '/product-groups' &&
    !emptyRecordsVisible &&
    !(
      tableHeadersAscii.includes('danh muc') &&
      tableHeadersAscii.includes('lien quan') &&
      tableHeadersAscii.includes('thuong hieu') &&
      !tableHeadersAscii.includes('slug')
    );
  const productVariantListBroken =
    route === '/product-variants' &&
    !emptyRecordsVisible &&
    !(
      tableHeadersAscii.includes('bien the') &&
      tableHeadersAscii.includes('thuoc san pham') &&
      tableHeadersAscii.includes('bao gia') &&
      tableHeadersAscii.includes('tinh trang')
    );
  const technicalDocumentListBroken =
    route === '/technical-documents' &&
    !emptyRecordsVisible &&
    !(
      tableHeadersAscii.includes('tai lieu') &&
      (tableHeadersAscii.includes('san pham') ||
        tableHeadersAscii.includes('nhom san pham')) &&
      tableHeadersAscii.includes('bien the')
    );
  const productClusterListDeleteMissing =
    productClusterListRoutes.includes(route) &&
    !emptyRecordsVisible &&
    productDeleteButtons.length === 0;
  const productClusterDetailDeleteMissing =
    looksLikeUuid &&
    productClusterBaseRoutes.includes(baseRoute) &&
    !document.querySelector('[data-product-delete-button="true"]') &&
    !mainAscii.includes('khoi phuc') &&
    !mainAscii.includes('che do chi doc');

  const productClusterDateFilterMissing =
    productClusterDateFilterRoutes.includes(route) &&
    !(toolbarDateInput instanceof HTMLInputElement);
  const productClusterDisplayFilterMissing =
    [...productClusterDateFilterRoutes, '/product-variants'].includes(route) &&
    (!toolbarAllAscii.includes('hien thi') ||
      !toolbarAllAscii.includes('dang dung') ||
      !toolbarAllAscii.includes('da luu tru') ||
      !toolbarAllAscii.includes('tat ca'));
  const productCategoryOverviewFilterBroken =
    route === '/product-categories' &&
    (!toolbarAscii.includes('ngay') ||
      !toolbarAscii.includes('trang thai') ||
      !toolbarAscii.includes('hien thi'));
  const productCategoryMainFilterBroken =
    route === '/product-categories/main' &&
    (!toolbarAscii.includes('ngay') ||
      !toolbarAscii.includes('trang thai') ||
      !toolbarAscii.includes('hien thi'));
  const productCategorySubFilterBroken =
    route === '/product-categories/sub' &&
    (!toolbarAscii.includes('danh muc chinh') ||
      !toolbarAscii.includes('ngay') ||
      !toolbarAscii.includes('hien thi'));
  const brandFilterBroken =
    route === '/brands' &&
    (!toolbarAscii.includes('ngay') || !toolbarAscii.includes('hien thi'));
  const productGroupFilterBroken =
    route === '/product-groups' &&
    (!toolbarAscii.includes('danh muc chinh') ||
      !toolbarAscii.includes('danh muc con') ||
      !toolbarAscii.includes('thuong hieu') ||
      !toolbarAscii.includes('bo loc nang cao'));
  const productVariantFilterBroken =
    route === '/product-variants' &&
    (!(toolbarAllAscii.includes('san pham') || toolbarAllAscii.includes('nhom san pham')) ||
      !toolbarAllAscii.includes('cach bao gia') ||
      !toolbarAllAscii.includes('hien thi'));
  const technicalDocumentFilterBroken =
    route === '/technical-documents' &&
    (!(toolbarAscii.includes('san pham') || toolbarAscii.includes('nhom san pham')) ||
      !toolbarAscii.includes('bien the') ||
      !toolbarAscii.includes('loai tai lieu') ||
      !toolbarAllAscii.includes('ngay') ||
      !toolbarAllAscii.includes('hien thi'));

  const misleadingSearchClaim =
    normalizedAscii.includes('ma hoac ten ban ghi') ||
    normalizedAscii.includes('tim nhanh theo man hinh');

  const controlsOk =
    !usersRolesFakeCrud &&
    !dashboardTrafficMissing &&
    !dashboardFeaturedProductsMissing &&
    !productClusterDateFilterMissing &&
    !productClusterDisplayFilterMissing &&
    !productCategoryOverviewFilterBroken &&
    !productCategoryMainFilterBroken &&
    !productCategorySubFilterBroken &&
    !brandFilterBroken &&
    !productGroupFilterBroken &&
    !productVariantFilterBroken &&
    !technicalDocumentFilterBroken &&
    !misleadingSearchClaim &&
    !importUploadContractBroken &&
    !importPrimaryWorkflowBroken &&
    !importHelperDensityBroken &&
    !importRawErrorVisible &&
    !createSystemRailVisible &&
    !createFormMissing &&
    !pageContentCreateHubMissing &&
    !pickerCopyBroken &&
    !advancedSeoMissing &&
    !unexpectedSeoVisible &&
    !filesZoneNavMissing &&
    !filesModeToggleMissing &&
    !filesModeButtonsMissing &&
    !filesUsageLayoutMissing &&
    !filesUploadEntryMissing &&
    !filesUploadDisabledWithoutReason &&
    !importMojibakeVisible &&
    !importPreviewWarningDuplicates &&
    !importNotReadyRawVisible &&
    !importMappingContractBroken &&
    !importNotReadyContractBroken &&
    !importAppliedContractBroken &&
    !importDetailLayoutBroken &&
    !importDeleteButtonMissing &&
    !importInlineDeleteButtonMissing &&
    !productCategoryCreateBroken &&
    !brandCreateBroken &&
    !productGroupCreateBroken &&
    !productVariantCreateBroken &&
    !technicalDocumentCreateBroken &&
    !productCategoryListBroken &&
    !productCategoryMainBroken &&
    !productCategorySubBroken &&
    !brandListBroken &&
    !productGroupListBroken &&
    !productVariantListBroken &&
    !technicalDocumentListBroken &&
    !productClusterListDeleteMissing &&
    !productClusterDetailDeleteMissing;

  const detailLayoutOk = !filesPanelVisibleByDefault && !importDetailLayoutBroken;

  return {
    runtime: !runtimeOverlay,
    shell,
    breadcrumb: breadcrumbOk,
    topbar: topbarOk,
    controls: controlsOk,
    detailLayout: detailLayoutOk,
    evidence: {
      breadcrumbText,
      topbarPlaceholder,
      usersRolesFakeCrud,
      filesPanelVisibleByDefault,
      dashboardTrafficMissing,
      dashboardFeaturedProductsMissing,
      createSystemRailVisible,
      createFormMissing,
      pageContentCreateHubMissing,
      pickerCopyBroken,
      advancedSeoMissing,
      unexpectedSeoVisible,
      filesZoneNavMissing,
      filesModeToggleMissing,
      filesModeButtonsMissing,
      filesUsageLayoutMissing,
      filesUploadEntryMissing,
      filesUploadDisabledWithoutReason,
      importUploadContractBroken,
      importPrimaryWorkflowBroken,
      importHelperDensityBroken,
      importRawErrorVisible,
      importMojibakeVisible,
      importMatchedMojibakeTokens,
      importPreviewWarningDuplicates,
      importNotReadyRawVisible,
      importMappingContractBroken,
      importNotReadyContractBroken,
      importAppliedContractBroken,
      importDetailLayoutBroken,
      importApplyButtonDisabled,
      importNotReadyHasTitle,
      importNotReadyHasReason,
      importNotReadyHasStatus,
      importNotReadyHasPending,
      importNotReadyHasApproved,
      importAppliedHasTitle,
      importAppliedHasDone,
      importDeleteButtonMissing,
      importInlineDeleteButtonMissing,
      productCategoryCreateBroken,
      brandCreateBroken,
      productGroupCreateBroken,
      productVariantCreateBroken,
      technicalDocumentCreateBroken,
      productCategoryListBroken,
      brandListBroken,
      productGroupListBroken,
      productVariantListBroken,
      technicalDocumentListBroken,
      productClusterListDeleteMissing,
      productClusterDetailDeleteMissing,
      importUploadAccept,
      uploadWidth: uploadRect?.width ?? null,
      productClusterDateFilterMissing,
      productClusterDisplayFilterMissing,
      productCategoryOverviewFilterBroken,
      productCategoryMainFilterBroken,
      productCategorySubFilterBroken,
      brandFilterBroken,
      productGroupFilterBroken,
      productVariantFilterBroken,
      technicalDocumentFilterBroken,
      misleadingSearchClaim
    }
  };
}

async function exerciseInteractions(route) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalizeAscii = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0111\u0110]/g, (char) => (char === '\u0111' ? 'd' : 'D'))
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const setInputValue = (input, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    );
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const hasInlineValidation = (...fields) => {
    const bodyAscii = normalizeAscii(document.body?.innerText || '');
    return (
      fields.every((field) =>
        document.querySelector(`[data-field="${field}"][aria-invalid="true"]`)
      ) &&
      !bodyAscii.includes('http 409') &&
      !bodyAscii.includes('validation_error')
    );
  };

  const result = {
    topbar: 'SKIPPED',
    controls: 'SKIPPED',
    detailLayout: 'SKIPPED'
  };
  const waitForSelector = async (selector, timeout = 3000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const node = document.querySelector(selector);
      if (node) return node;
      await wait(100);
    }
    return document.querySelector(selector);
  };
  const waitForPath = async (expectedPath, timeout = 3000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (window.location.pathname === expectedPath) return true;
      await wait(100);
    }
    return window.location.pathname === expectedPath;
  };

  if (route === '/dashboard') {
    const quickNavInput = document.querySelector(
      '[data-topbar-quick-nav="true"] input'
    );
    if (!quickNavInput) {
      result.topbar = 'FAIL';
    } else {
      quickNavInput.focus();
      setInputValue(quickNavInput, 'bien the');
      await wait(350);
      const resultsContainer = await waitForSelector(
        '[data-topbar-quick-nav-results="true"]',
        2500
      );
      const hasVariantMatch =
        normalizeAscii(resultsContainer?.innerText || '').includes('bien the san pham');
      const variantButton = Array.from(
        resultsContainer?.querySelectorAll('button') || []
      ).find((button) =>
        normalizeAscii(button.textContent || '').includes('bien the san pham')
      );

      if (!hasVariantMatch || !variantButton) {
        result.topbar = 'FAIL';
      } else {
        setInputValue(quickNavInput, '');
        await wait(150);
        quickNavInput.focus();
        setInputValue(quickNavInput, 'tep');
        await wait(350);
        const fileResults = await waitForSelector(
          '[data-topbar-quick-nav-results="true"]',
          2500
        );
        const hasFileMatch = normalizeAscii(fileResults?.innerText || '').includes(
          'kho tep'
        );
        const fileButton = Array.from(
          fileResults?.querySelectorAll('button') || []
        ).find((button) =>
          normalizeAscii(button.textContent || '').includes('kho tep')
        );
        if (!hasFileMatch || !fileButton) {
          result.topbar = 'FAIL';
        } else {
          result.topbar = 'PASS';
        }
      }
    }
  }

  const toolbar = document.querySelector('[data-admin-filter-toolbar]');
  if (toolbar && route !== '/files' && route !== '/import') {
    const textInput = toolbar.querySelector('input:not([type="date"])');
    const select = toolbar.querySelector('select');
    let searchOk = true;
    let selectOk = true;

    if (textInput) {
      setInputValue(textInput, 'qa');
      searchOk = textInput.value === 'qa';
    }

    if (select && select.options.length > 1) {
      select.selectedIndex = 1;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      selectOk = select.selectedIndex === 1;
    }

    result.controls = searchOk && selectOk ? 'PASS' : 'FAIL';
  }

  if (route === '/product-groups' || route === '/product-variants') {
    const advancedToggle =
      route === '/product-groups'
        ? Array.from(toolbar?.querySelectorAll('button') || []).find((button) =>
            normalizeAscii(button.textContent || '').includes('bo loc nang cao')
          )
        : toolbar?.querySelector('details[data-product-filter-advanced="true"] summary');
    advancedToggle?.click();
    await wait(200);
    const advancedPanel = toolbar?.querySelector('[data-product-filter-advanced="true"]');
    const advancedAscii = normalizeAscii(advancedPanel?.textContent || '');
    const advancedOk = Boolean(
      advancedPanel &&
        advancedAscii.includes('hien thi') &&
        advancedAscii.includes('dang dung') &&
        advancedAscii.includes('da luu tru') &&
        advancedAscii.includes('tat ca')
    );
    result.controls =
      result.controls !== 'FAIL' && advancedOk ? 'PASS' : 'FAIL';
  }

  if (route === '/files') {
    const zoneNav = document.querySelector('[data-file-zone-nav="true"]');
    const uploadButton = document.querySelector('[data-file-upload-open="true"]');
    const disabledReason = document.querySelector(
      '[data-file-upload-disabled-reason="true"]'
    );
    const modeToggle = document.querySelector('[data-file-mode-toggle="true"]');
    const usageModeButton = document.querySelector('[data-file-mode="usage"]');
    const filesModeButton = document.querySelector('[data-file-mode="files"]');
    const usageRecords = document.querySelector('[data-file-usage-records="true"]');
    const linkedFiles = document.querySelector('[data-file-linked-files="true"]');
    const drawerBefore = document.querySelector('[data-file-detail-drawer="true"]');
    let filesControlsOk = Boolean(
      zoneNav &&
        modeToggle &&
        usageModeButton &&
        filesModeButton &&
        linkedFiles &&
        (usageRecords || normalizeAscii(document.body.textContent || '').includes('chua co ban ghi dung tep'))
    );
    if (uploadButton instanceof HTMLButtonElement) {
      if (uploadButton.disabled) {
        filesControlsOk = filesControlsOk && Boolean(disabledReason);
      } else {
        uploadButton.click();
        await wait(350);
        const uploadModal = document.querySelector('[data-file-upload-modal="true"]');
        const uploadInput = document.querySelector('[data-file-upload-input="true"]');
        filesControlsOk = filesControlsOk && Boolean(uploadModal && uploadInput);
        const cancelButton = Array.from(document.querySelectorAll('button')).find(
          (button) => normalizeAscii(button.textContent || '') === 'huy'
        );
        cancelButton?.click();
        await wait(250);
      }
    } else {
      filesControlsOk = false;
    }
    result.controls = filesControlsOk ? 'PASS' : 'FAIL';

    if (filesModeButton instanceof HTMLButtonElement) {
      filesModeButton.click();
      await wait(300);
      const filesModeOpenButtons = Array.from(
        document.querySelectorAll('[data-file-detail-open="true"]')
      );
      filesControlsOk =
        filesControlsOk &&
        Boolean(
          document.querySelector('[data-file-mode="files"]') &&
            (filesModeOpenButtons[0] ||
              normalizeAscii(document.body.textContent || '').includes('kho tep trong') ||
              normalizeAscii(document.body.textContent || '').includes('khong co ket qua phu hop'))
        );
      if (usageModeButton instanceof HTMLButtonElement) {
        usageModeButton.click();
        await wait(300);
      }
    }

    result.controls = filesControlsOk ? 'PASS' : 'FAIL';

    if (drawerBefore) {
      result.detailLayout = 'FAIL';
    } else {
      const openButtons = Array.from(
        document.querySelectorAll('[data-file-detail-open="true"]')
      );
      const openButton = openButtons[0];
      if (!openButton) {
        result.detailLayout = 'PASS';
      } else {
        openButton.click();
        await wait(700);
        const drawer = document.querySelector('[data-file-detail-drawer="true"]');
        const closeButton = document.querySelector('[data-file-detail-close="true"]');
        if (!drawer || !closeButton) {
          result.detailLayout = 'FAIL';
        } else {
          closeButton.click();
          await wait(350);
          result.detailLayout = document.querySelector(
            '[data-file-detail-drawer="true"]'
          )
            ? 'FAIL'
            : 'PASS';
        }
      }
    }
  }

  if (route === '/import') {
    result.controls = document.querySelector('[data-import-new-entry="true"]')
      ? 'PASS'
      : 'FAIL';
  }

  if (route === '/import/new') {
    const uploadInput = document.querySelector('[data-import-upload-file="true"]');
    const submitButton = document.querySelector('[data-import-upload-submit="true"]');
    result.controls =
      uploadInput instanceof HTMLInputElement &&
      submitButton instanceof HTMLButtonElement &&
      !document.querySelector('[data-import-batch-list="true"]')
        ? 'PASS'
        : 'FAIL';
  }

  if (route === '/product-categories/new') {
    const levelSelect = document.querySelector('[data-product-category-level-select="true"]');
    const nameInput = document.querySelector('main form input');
    const submitButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalizeAscii(button.textContent || '').includes('tao ban ghi')
    );
    let ok =
      levelSelect instanceof HTMLSelectElement &&
      nameInput instanceof HTMLInputElement &&
      submitButton instanceof HTMLButtonElement;

    if (ok) {
      levelSelect.value = 'level_2';
      levelSelect.dispatchEvent(new Event('change', { bubbles: true }));
      await wait(150);
      setInputValue(nameInput, 'QA Category');
      submitButton.click();
      await wait(300);
      ok =
        ok &&
        Boolean(document.querySelector('[data-product-category-parent-select="true"]')) &&
        hasInlineValidation('parent_id');
    }

    result.controls = ok ? 'PASS' : 'FAIL';
  }

  if (route === '/brands/new') {
    const submitButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalizeAscii(button.textContent || '').includes('tao ban ghi')
    );
    let ok = submitButton instanceof HTMLButtonElement;
    if (ok) {
      submitButton.click();
      await wait(300);
      ok = hasInlineValidation('name');
    }

    result.controls = ok ? 'PASS' : 'FAIL';
  }

  if (route === '/product-groups/new') {
    const level2Select = document.querySelector('[data-product-group-level2-select="true"]');
    const brandSelect = document.querySelector('[data-product-group-brand-select="true"]');
    const submitButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalizeAscii(button.textContent || '').includes('tao ban ghi')
    );
    let ok =
      level2Select instanceof HTMLSelectElement &&
      brandSelect instanceof HTMLSelectElement &&
      submitButton instanceof HTMLButtonElement &&
      level2Select.disabled &&
      !brandSelect.disabled;
    if (ok) {
      submitButton.click();
      await wait(300);
      ok = hasInlineValidation('name', 'category_level_1_id');
    }

    result.controls = ok ? 'PASS' : 'FAIL';
  }

  if (route === '/product-variants/new') {
    const priceMode = document.querySelector('[data-product-variant-price-mode-select="true"]');
    const groupSelect = document.querySelector('[data-product-variant-group-select="true"]');
    const priceInput = Array.from(document.querySelectorAll('input')).find((input) =>
      normalizeAscii(input.closest('label, div')?.textContent || '').includes('gia cong khai')
    );
    const submitButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalizeAscii(button.textContent || '').includes('tao ban ghi')
    );
    let ok =
      priceMode instanceof HTMLSelectElement &&
      groupSelect instanceof HTMLSelectElement &&
      priceInput instanceof HTMLInputElement &&
      submitButton instanceof HTMLButtonElement &&
      priceInput.disabled;
    if (ok) {
      submitButton.click();
      await wait(300);
      ok = hasInlineValidation('variant_name', 'product_group_id');
    }

    result.controls = ok ? 'PASS' : 'FAIL';
  }

  if (route === '/technical-documents/new') {
    const variantSelect = document.querySelector(
      '[data-technical-document-variant-select="true"]'
    );
    const submitButton = Array.from(document.querySelectorAll('button')).find((button) =>
      normalizeAscii(button.textContent || '').includes('tao ban ghi')
    );
    let ok =
      variantSelect instanceof HTMLSelectElement &&
      submitButton instanceof HTMLButtonElement &&
      variantSelect.disabled;
    if (ok) {
      submitButton.click();
      await wait(300);
      ok = hasInlineValidation('document_name', 'product_group_id', 'file_id');
    }

    result.controls = ok ? 'PASS' : 'FAIL';
  }

  if (route.startsWith('/import/') && route !== '/import/new') {
    const mappingStage = document.querySelector('[data-import-mapping-stage="true"]');
    let importReviewFlowOk = Boolean(
      document.querySelector('[data-import-detail-layout="single-column"]') &&
        document.querySelector('[data-import-main-content="true"]')
    );

    if (mappingStage) {
      const submitButton = document.querySelector('[data-import-mapping-submit="true"]');
      const requiredRoles = document.querySelectorAll('[data-import-required-role]');
      importReviewFlowOk =
        importReviewFlowOk &&
        Boolean(
          document.querySelector('[data-import-column-mapping="true"]') &&
            submitButton instanceof HTMLButtonElement &&
            requiredRoles.length >= 4 &&
            document.querySelector('[data-import-preview="true"]')
        );
    } else {
      const openGroupsButton = document.querySelector('[data-import-open-groups="true"]');
      const tabs = Array.from(document.querySelectorAll('button, [role="tab"]'));
      const groupsTab = tabs.find((node) =>
        normalizeAscii(node.textContent || '').includes('nhom san pham tam')
      );

      const reviewEntry =
        (openGroupsButton instanceof HTMLElement && openGroupsButton) ||
        (groupsTab instanceof HTMLElement && groupsTab);

      if (reviewEntry) {
        reviewEntry.click();
        await wait(450);
        const groupsPanel = document.querySelector(
          '[data-import-review-panel="groups"]'
        );
        const reviewFilters = document.querySelector(
          '[data-import-review-panel="groups"] [data-import-review-filters="true"]'
        );
        const reviewSearch = document.querySelector(
          '[data-import-review-search="groups"]'
        );
        const reviewAction =
          document.querySelector('[data-import-bulk-approve-all="groups"]') ||
          document.querySelector('[data-import-approve-row="groups"]') ||
          document.querySelector('[data-import-skip-row="groups"]');
        importReviewFlowOk =
          importReviewFlowOk &&
          Boolean(groupsPanel && reviewFilters && reviewSearch && reviewAction);
      } else {
        importReviewFlowOk = false;
      }
    }

    result.controls = importReviewFlowOk ? 'PASS' : 'FAIL';
    result.detailLayout = importReviewFlowOk ? 'PASS' : 'FAIL';
  }

  return result;
}

function isIgnoredRuntimeMessage(message) {
  return /favicon\.ico|React DevTools|Failed to load resource: the server responded with a status of 404|Blocked attempt to show a 'beforeunload' confirmation panel/i.test(
    String(message)
  );
}

function isRouteReady(route) {
  const breadcrumbs = document.querySelector('[data-admin-breadcrumbs]');
  if (!breadcrumbs) return false;
  const normalizeAscii = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0111\u0110]/g, (char) => (char === '\u0111' ? 'd' : 'D'))
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const bodyAscii = normalizeAscii(document.body?.innerText || '');

  if (route === '/import') {
    return Boolean(
        document.querySelector('[data-import-batch-list="true"]') &&
        document.querySelector('[data-import-new-entry="true"]')
    );
  }

  if (route === '/import/new') {
    return Boolean(
      document.querySelector('[data-import-primary-workflow="true"]') &&
        document.querySelector('[data-import-upload-file="true"]') &&
        document.querySelector('[data-import-upload-submit="true"]') &&
        !document.querySelector('[data-import-batch-list="true"]')
    );
  }

  if (route === '/files') {
    const bodyAscii = normalizeAscii(document.body.textContent || '');
    return Boolean(
      document.querySelector('[data-admin-filter-toolbar="true"]') &&
        document.querySelector('[data-file-zone-nav="true"]') &&
        document.querySelector('[data-file-mode-toggle="true"]') &&
        document.querySelector('[data-file-linked-files="true"]') &&
        (document.querySelector('[data-file-upload-open="true"]') ||
          document.querySelector('[data-file-upload-disabled-reason="true"]')) &&
        (document.querySelector('[data-file-usage-records="true"]') ||
          bodyAscii.includes('chua co ban ghi dung tep')) &&
        (document.querySelector('[data-file-detail-open="true"]') ||
          bodyAscii.includes('chua co tep phu hop') ||
          bodyAscii.includes('chua co tep nao'))
    );
  }

  if (route === '/page-contents/new') {
    return Boolean(document.querySelector('[data-page-content-create-hub="true"]'));
  }

  if (
    [
      '/product-categories',
      '/product-categories/main',
      '/product-categories/sub',
      '/brands',
      '/product-groups',
      '/product-variants',
      '/technical-documents'
    ].includes(route)
  ) {
    const hasRowsOrEmptyState =
      document.querySelectorAll('thead th').length > 0 ||
      bodyAscii.includes('chua co ban ghi') ||
      bodyAscii.includes('chua co danh muc') ||
      bodyAscii.includes('chua co thuong hieu') ||
      bodyAscii.includes('chua co san pham') ||
      bodyAscii.includes('chua co nhom san pham') ||
      bodyAscii.includes('chua co bien the') ||
      bodyAscii.includes('chua co tai lieu');
    return Boolean(
      document.querySelector('[data-admin-filter-toolbar="true"]') &&
        hasRowsOrEmptyState
    );
  }

  if (route === '/technical-documents') {
    return bodyAscii.includes('tai lieu ky thuat');
  }

  if (route.endsWith('/new')) {
    return Boolean(document.querySelector('main form'));
  }

  if (route.startsWith('/import/') && route !== '/import/new') {
    return Boolean(
      document.querySelector('[data-import-detail-layout="single-column"]') &&
        (document.querySelector('[data-import-mapping-stage="true"]') ||
          document.querySelector('[data-import-not-ready-card="true"]') ||
          document.querySelector('[data-import-applied-card="true"]')) &&
        (document.querySelector('[data-import-delete-button="true"]') ||
          document.querySelector('[data-import-archive-button="true"]'))
    );
  }

  if (
    /^\/(product-categories|brands|product-groups|product-variants|technical-documents)\/[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(
      route
    )
  ) {
    return Boolean(
      document.querySelector('main form') &&
        (document.querySelector('[data-product-delete-button="true"]') ||
          bodyAscii.includes('khoi phuc') ||
          bodyAscii.includes('che do chi doc'))
    );
  }

  return true;
}

function printResults(rows, checkedImportDetail) {
  console.log(`Admin QA: ${ADMIN_BASE_URL}`);
  console.log(
    `Import detail checked: ${checkedImportDetail ? 'yes' : 'skipped - no batch returned'}`
  );
  console.log(
    'Route | Runtime | Shell | Breadcrumb | Topbar | Controls | Detail | Result'
  );
  for (const row of rows) {
    console.log(
      [
        row.route,
        pass(row.runtime),
        pass(row.shell),
        pass(row.breadcrumb),
        pass(row.topbar),
        pass(row.controls),
        pass(row.detailLayout),
        pass(row.result)
      ].join(' | ')
    );
    if (!row.result) {
      console.log(`  Evidence: ${JSON.stringify(row.evidence)}`);
      if (row.runtimeMessages.length) {
        console.log(`  Runtime messages: ${JSON.stringify(row.runtimeMessages)}`);
      }
    }
  }
}

function pass(value) {
  return value ? 'PASS' : 'FAIL';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
