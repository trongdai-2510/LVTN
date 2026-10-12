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
const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CDP_PORT = Number(process.env.PUBLIC_UI_QA_CDP_PORT || 9226);
const CASE_TIMEOUT_MS = Number(process.env.PUBLIC_UI_QA_CASE_TIMEOUT_MS || 45000);
const CDP_COMMAND_TIMEOUT_MS = Number(
  process.env.PUBLIC_UI_QA_CDP_COMMAND_TIMEOUT_MS || 30000
);
const NAVIGATION_TIMEOUT_MS = Number(
  process.env.PUBLIC_UI_QA_NAVIGATION_TIMEOUT_MS || 30000
);
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const results = [];

async function main() {
  await assertReachable();
  const routes = await buildRoutes();
  const browser = await openBrowser();
  const page = await createPage(browser.cdpUrl);
  try {
    await page.enable();
    for (const routeSpec of routes) {
      await runUiCase(page, routeSpec, { width: 1440, height: 1000, mobile: false, label: 'desktop' });
      if (routeSpec.mobile) {
        await runUiCase(page, routeSpec, { width: 390, height: 844, mobile: true, label: 'mobile' });
      }
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
  const routes = [
    { route: '/', label: 'Trang chủ', expected: ['song thanh'], mobile: true, risk: 'P0' },
    { route: '/san-pham', label: 'Danh mục sản phẩm', expected: ['san pham'], mobile: true, risk: 'P0' },
    { route: '/san-pham/danh-sach?q=led', label: 'Danh sách sản phẩm', expected: ['san pham'], mobile: true, risk: 'P0' },
    { route: '/dich-vu', label: 'Dịch vụ', expected: ['dich vu'], mobile: true, risk: 'P1' },
    { route: '/du-an', label: 'Dự án', expected: ['du an'], mobile: true, risk: 'P1' },
    { route: '/doi-tac-thuong-hieu', label: 'Đối tác thương hiệu', expected: ['thuong hieu'], mobile: true, risk: 'P1' },
    { route: '/gioi-thieu', label: 'Giới thiệu', expected: ['song thanh'], mobile: true, risk: 'P1' },
    { route: '/ho-so-nang-luc', label: 'Hồ sơ năng lực', expected: ['song thanh'], mobile: true, risk: 'P1' },
    { route: '/lien-he', label: 'Liên hệ', expected: ['lien he'], mobile: true, risk: 'P0', formFields: ['full_name', 'phone', 'email', 'company_name', 'message'] },
    { route: '/tim-kiem?q=led', label: 'Tìm kiếm', expected: ['tim kiem'], mobile: true, risk: 'P1' },
    { route: '/tin-tuc', label: 'Tin tức', expected: ['tin tuc'], mobile: true, risk: 'P2' }
  ];

  const product = await firstPublicItem('/public/product-groups?page=1&page_size=5');
  if (product?.slug) {
    routes.splice(3, 0, {
      route: `/san-pham/${product.slug}`,
      label: 'Chi tiết sản phẩm',
      expected: ['thong so noi bat'],
      quoteProductName: product.name,
      mobile: true,
      risk: 'P0'
    });
  }

  const service = await firstPublicItem('/public/services?page=1&page_size=5');
  if (service?.slug) {
    routes.push({
      route: `/dich-vu/${service.slug}`,
      label: 'Chi tiết dịch vụ',
      expected: ['dich vu'],
      mobile: true,
      risk: 'P1'
    });
  }

  const project = await firstPublicItem('/public/projects?page=1&page_size=5');
  if (project?.slug) {
    routes.push({
      route: `/du-an/${project.slug}`,
      label: 'Chi tiết dự án',
      expected: ['du an'],
      mobile: true,
      risk: 'P1'
    });
  }

  const brand = await firstPublicItem('/public/brands?page=1&page_size=5');
  if (brand?.slug) {
    routes.push({
      route: `/doi-tac-thuong-hieu/${brand.slug}`,
      label: 'Chi tiết thương hiệu',
      expected: [brand.name || 'thuong hieu'],
      mobile: true,
      risk: 'P1'
    });
  }

  return routes;
}

async function runUiCase(page, routeSpec, viewport) {
  const started = Date.now();
  const id = `${routeSpec.route} [${viewport.label}]`;
  try {
    const evidence = await withTimeout(
      inspectRoute(page, routeSpec, viewport),
      CASE_TIMEOUT_MS,
      `${id} timed out after ${CASE_TIMEOUT_MS}ms`
    );
    results.push({
      id,
      route: routeSpec.route,
      label: routeSpec.label,
      viewport: viewport.label,
      risk: routeSpec.risk,
      status: 'PASS',
      duration_ms: Date.now() - started,
      evidence
    });
  } catch (error) {
    results.push({
      id,
      route: routeSpec.route,
      label: routeSpec.label,
      viewport: viewport.label,
      risk: routeSpec.risk,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      error: error?.message || String(error)
    });
  }
}

async function inspectRoute(page, routeSpec, viewport) {
  await page.setViewport(viewport.width, viewport.height, viewport.mobile);
  await page.navigate(`${FRONTEND_BASE_URL}${routeSpec.route}`);
  await page.waitForReady('document.body && document.body.innerText && document.body.innerText.length > 20', 8000);
  // Server-rendered detail routes can stream after the shared header appears.
  // Inspecting at that first text node produces false passes and false failures.
  if (routeSpec.expected?.length) {
    await page.waitForReady(
      `(${JSON.stringify(routeSpec.expected)}).every((item) => window.normalizeForQa(document.body?.innerText || '').includes(window.normalizeForQa(item)))`,
      10000
    );
  }
  const state = await page.evaluate(`(${inspectPublicRoute.toString()})(${JSON.stringify(routeSpec)})`);
  assert(state.no_runtime_overlay, 'runtime overlay is visible');
  assert(
    state.no_horizontal_overflow,
    `horizontal overflow ${state.overflow_px}px${
      state.overflow_culprits?.length
        ? `; culprits=${JSON.stringify(state.overflow_culprits)}`
        : ''
    }`
  );
  assert(state.has_expected_text, `missing expected text: ${routeSpec.expected.join(', ')}`);
  if (routeSpec.formFields?.length) {
    const missing = Object.entries(state.form_fields || {})
      .filter(([, present]) => !present)
      .map(([name]) => name);
    assert(missing.length === 0, `missing form fields: ${missing.join(', ')}`);
  }
  if (routeSpec.quoteProductName) {
    await page.waitForReady(`Boolean(document.querySelector('[data-product-primary-actions] [data-quote-action="open"]'))`, 6000);
    let dialogOpened = false;
    for (let attempt = 0; attempt < 4 && !dialogOpened; attempt += 1) {
      const actionFound = await page.evaluate(`(() => {
        const action = document.querySelector('[data-product-primary-actions] [data-quote-action="open"]');
        if (!(action instanceof HTMLButtonElement)) return false;
        action.click();
        return true;
      })()`);
      assert(actionFound, 'product quote action is missing');
      await delay(1000);
      dialogOpened = Boolean(await page.evaluate(`document.querySelector('[role="dialog"][aria-modal="true"]')?.getClientRects().length > 0`));
    }
    assert(dialogOpened, 'product quote action did not open its dialog');
    const quoteState = await page.evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      const text = window.normalizeForQa(dialog?.innerText || '');
      return {
        url: location.href,
        hasProduct: text.includes(window.normalizeForQa(${JSON.stringify(routeSpec.quoteProductName)})),
        hasQuantity: Boolean(dialog?.querySelector('[data-quote-quantity-index="0"]'))
      };
    })()`);
    assert(quoteState.url === `${FRONTEND_BASE_URL}${routeSpec.route}`, 'quote action navigated away from the product');
    assert(quoteState.hasProduct, 'quote form lost the selected product');
    assert(quoteState.hasQuantity, 'quote form is missing the quantity field');
    state.quote_flow = quoteState;
  }
  return state;
}

function inspectPublicRoute(routeSpec) {
  const bodyText = document.body?.innerText || '';
  const text = window.normalizeForQa(bodyText);
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
  const viewportWidth = document.documentElement.clientWidth;
  const overflowCulprits = overflowPx > 2
    ? Array.from(document.body?.querySelectorAll('*') || [])
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const rightOverflow = Math.max(0, rect.right - viewportWidth);
          const leftOverflow = Math.max(0, -rect.left);
          const style = window.getComputedStyle(element);
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || null,
            class_name: String(element.className || '').slice(0, 180) || null,
            width: Math.round(rect.width),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            scroll_width: element.scrollWidth,
            display: style.display,
            white_space: style.whiteSpace,
            overflow_px: Math.round(Math.max(rightOverflow, leftOverflow))
          };
        })
        .filter((candidate) => candidate.overflow_px > 2 && candidate.width > 0)
        .sort((left, right) => right.overflow_px - left.overflow_px)
        .slice(0, 8)
    : [];
  const formFields = Object.fromEntries(
    (routeSpec.formFields || []).map((name) => [name, Boolean(document.querySelector(`[name="${name}"]`))])
  );
  return {
    url: window.location.href,
    title: document.title,
    no_runtime_overlay: !runtimeOverlay && !productionError,
    no_horizontal_overflow: overflowPx <= 2,
    overflow_px: overflowPx,
    overflow_culprits: overflowCulprits,
    has_expected_text: (routeSpec.expected || []).every((item) => text.includes(window.normalizeForQa(item))),
    form_fields: formFields,
    text_sample: text.slice(0, 260)
  };
}

async function firstPublicItem(pathname) {
  try {
    const response = await requestJson(pathname);
    if (!response.ok) return null;
    return extractItems(unwrap(response))[0] || null;
  } catch {
    return null;
  }
}

async function assertReachable() {
  const [api, frontend] = await Promise.all([
    requestRaw(`${API_BASE_URL}/health`),
    requestRaw(FRONTEND_BASE_URL)
  ]);
  assert(api.status === 200, `API health returned ${api.status}`);
  assert(frontend.status < 500, `frontend returned ${frontend.status}`);
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

function unwrap(response) {
  return response?.payload?.data ?? response?.payload;
}

function extractItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  return [];
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
  if (process.env.PUBLIC_UI_QA_CDP_URL) {
    return {
      cdpUrl: process.env.PUBLIC_UI_QA_CDP_URL.replace(/\/$/, ''),
      close: async () => undefined
    };
  }
  const executable = findBrowserExecutable();
  if (!executable) throw new Error('No Chrome or Edge executable found for public UI QA.');

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'song-thanh-public-ui-qa-'));
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
    const normalizedExpectedUrl = new URL(expectedUrl).href;
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        const state = await this.evaluate(
          `({ readyState: document.readyState, href: window.location.href })`
        );
        const atExpectedUrl =
          state?.href === normalizedExpectedUrl ||
          state?.href?.startsWith(`${normalizedExpectedUrl}#`);
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
  const reportPath = path.join(ROOT, 'tmp', 'qa-artifacts', 'public-ui-qa-last-run.md');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [
    '# Public UI QA last run',
    '',
    `Run id: \`${runId}\``,
    `Date: \`${new Date().toISOString()}\``,
    `Target: \`${FRONTEND_BASE_URL}\``,
    '',
    '| Route | Viewport | Risk | Result | Duration | Notes |',
    '| --- | --- | --- | --- | ---: | --- |'
  ];
  for (const result of results) {
    const notes = result.status === 'PASS' ? compact(result.evidence) : result.error;
    lines.push(
      `| ${result.route} | ${result.viewport} | ${result.risk} | ${result.status} | ${result.duration_ms}ms | ${escapeTable(notes)} |`
    );
  }
  lines.push('', 'Generated by `node scripts/qa/public-ui-smoke.mjs`.');
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

function printSummary() {
  const failed = results.filter((result) => result.status === 'FAIL');
  console.log(`Public UI QA run ${runId}`);
  for (const result of results) {
    const suffix = result.status === 'PASS' ? '' : ` - ${result.error}`;
    console.log(`${result.status} ${result.route} [${result.viewport}]${suffix}`);
  }
  console.log(`Report: ${path.join(ROOT, 'tmp', 'qa-artifacts', 'public-ui-qa-last-run.md')}`);
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
