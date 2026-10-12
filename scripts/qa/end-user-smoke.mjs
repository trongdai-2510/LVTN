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
const FRONTEND_BASE_URL = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const QA_CLIENT_IP = '192.0.2.60';
const STORAGE_KEY = 'song-thanh-admin-auth';
const CDP_PORT = Number(process.env.END_USER_QA_CDP_PORT || 9224);
const CDP_COMMAND_TIMEOUT_MS = Number(
  process.env.END_USER_QA_CDP_COMMAND_TIMEOUT_MS || 30000
);
const NAVIGATION_TIMEOUT_MS = Number(
  process.env.END_USER_QA_NAVIGATION_TIMEOUT_MS || 30000
);

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
const CASE_DATA_IMPACT = {
  'PUB-API-04': 'Temporarily creates one QA contact_request; QA-CLEANUP-01 removes it.',
  'PUB-API-05': 'Temporarily creates one QA quote_request and one QA quote_item; QA-CLEANUP-01 removes them.',
  'QA-CLEANUP-01': 'Permanently deletes the QA requests and generated customer profiles.',
  'ADM-API-02': 'Creates, public-verifies, then archives one QA product_highlight_spec.'
};

async function main() {
  await apiCase('ENV-01', 'API, admin, frontend are reachable', async () => {
    const [api, admin, frontend] = await Promise.all([
      requestRaw(`${API_BASE_URL}/health`),
      requestRaw(adminUrl('/login')),
      requestRaw(FRONTEND_BASE_URL)
    ]);

    assert(api.status === 200, `API health returned ${api.status}`);
    assert(admin.status < 500, `Admin login returned ${admin.status}`);
    assert(frontend.status < 500, `Frontend home returned ${frontend.status}`);

    return {
      api: api.status,
      admin: admin.status,
      frontend: frontend.status
    };
  });

  await apiCase('PUB-API-01', 'Public site shell exposes company identity', async () => {
    const response = await requestJson('/public/site-shell');
    assert(response.ok, `site-shell returned ${response.status}`);
    const data = unwrap(response);
    assert(data?.company_info?.display_name, 'company_info.display_name is missing');
    assert(data?.company_info?.hotline || data?.company_info?.email, 'contact identity is missing');
    return pick(data.company_info, ['display_name', 'hotline', 'email']);
  });

  await apiCase('PUB-API-02', 'Public product list and detail expose variants and quick specs', async () => {
    const list = await requestJson('/public/product-groups?page=1&page_size=5');
    assert(list.ok, `product list returned ${list.status}`);
    const product = extractItems(unwrap(list))[0];
    assert(product?.id && product?.slug, 'no public product group returned');

    const detail = await requestJson(`/public/product-groups/${encodeURIComponent(product.slug)}`);
    assert(detail.ok, `product detail returned ${detail.status}`);
    const productDetail = unwrap(detail);
    const variants = Array.isArray(productDetail?.variants) ? productDetail.variants : [];
    assert(variants.length > 0, 'product detail has no variants');
    const firstVariant = variants.find((variant) => Array.isArray(variant.highlight_specs) && variant.highlight_specs.length > 0) || variants[0];
    assert(firstVariant?.id, 'first variant id is missing');
    assert(Array.isArray(firstVariant.highlight_specs), 'variant highlight_specs is missing');

    context.product = product;
    context.productDetail = productDetail;
    context.variant = firstVariant;

    return {
      product: product.slug,
      variant_count: variants.length,
      first_variant_highlights: firstVariant.highlight_specs.length
    };
  });

  await apiCase('PUB-API-03', 'Public search suggestions return product candidates', async () => {
    const query = firstSearchToken(context.product?.name || 'led');
    const response = await requestJson(`/public/search-suggestions?q=${encodeURIComponent(query)}`);
    assert(response.ok, `search suggestions returned ${response.status}`);
    const items = extractItems(unwrap(response));
    assert(items.length > 0, `no suggestions for ${query}`);
    return { query, count: items.length };
  });

  await apiCase('PUB-API-04', 'Public contact form validates and accepts a real submission', async () => {
    const invalid = await requestJson('/public/contact-requests', {
      method: 'POST',
      body: {}
    });
    assert(!invalid.ok && invalid.status >= 400, `invalid contact payload returned ${invalid.status}`);

    const valid = await requestJson('/public/contact-requests', {
      method: 'POST',
      body: {
        full_name: `QA End User ${runId}`,
        phone: '0900000000',
        email: `qa-contact-${runId}@example.com`,
        company_name: 'QA Song Thanh',
        message: `End-user smoke test contact ${runId}`,
        source_page: '/qa/end-user-smoke'
      }
    });
    assert(valid.status === 201, `valid contact returned ${valid.status}`);
    const data = unwrap(valid);
    assert(data?.contact_request?.id, 'created contact_request.id is missing');
    context.qaContact = {
      id: data.contact_request.id,
      email: `qa-contact-${runId}@example.com`
    };
    return {
      rejected_status: invalid.status,
      created_contact_id: data.contact_request.id,
      created_status: data.contact_request.status
    };
  });

  await apiCase('PUB-API-05', 'Public quote request accepts selected product and variant', async () => {
    const product = context.product;
    const variant = context.variant;
    assert(product?.id, 'product id is missing from previous case');

    const valid = await requestJson('/public/quote-requests', {
      method: 'POST',
      body: {
        full_name: `QA Quote ${runId}`,
        phone: '0901234567',
        email: `qa-quote-${runId}@example.com`,
        company_name: 'QA Song Thanh',
        address: 'QA address',
        message: `End-user smoke test quote ${runId}`,
        items: [
          {
            product_group_id: product.id,
            product_variant_id: variant?.id,
            quantity: 1,
            notes: 'Created by end-user smoke test'
          }
        ]
      }
    });
    assert(valid.status === 201, `valid quote returned ${valid.status}`);
    const data = unwrap(valid);
    assert(data?.quote_request?.id, 'created quote_request.id is missing');
    assert(Array.isArray(data.items) && data.items.length === 1, 'quote item was not created');
    context.qaQuote = {
      id: data.quote_request.id,
      email: `qa-quote-${runId}@example.com`
    };
    return {
      created_quote_id: data.quote_request.id,
      item_count: data.items.length
    };
  });

  await apiCase('ADM-API-01', 'Admin auth rejects bad credentials and accepts seeded admin', async () => {
    const invalid = await requestJson('/auth/login', {
      method: 'POST',
      body: {
        email: ADMIN_EMAIL,
        password: `wrong-${runId}`
      }
    });
    assert(!invalid.ok && invalid.status >= 400, `bad login returned ${invalid.status}`);

    const login = await requestJson('/auth/login', {
      method: 'POST',
      body: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      }
    });
    assert(login.ok, `seeded login returned ${login.status}`);
    const session = unwrap(login);
    assert(session?.access_token, 'access_token is missing');

    const me = await requestJson('/auth/me', {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });
    assert(me.ok, `auth/me returned ${me.status}`);
    context.session = session;
    return {
      rejected_status: invalid.status,
      user_email: session.user?.email || ADMIN_EMAIL,
      permission_count: Array.isArray(session.permissions) ? session.permissions.length : null
    };
  });

  await apiCase('QA-CLEANUP-01', 'QA contact, quote, items, and customer profiles are removed', async () => {
    const contact = context.qaContact;
    const quote = context.qaQuote;
    assert(contact?.id && quote?.id, 'QA request ids are missing');

    const [contactCleanup, quoteCleanup] = await Promise.all([
      cleanupPublicRequestAndCustomer('contacts', contact.id, contact.email),
      cleanupPublicRequestAndCustomer('quotes', quote.id, quote.email)
    ]);
    context.qaContact = null;
    context.qaQuote = null;
    return { contact: contactCleanup, quote: quoteCleanup };
  });

  await apiCase('ADM-API-02', 'Admin can manage a manual highlight spec and public detail reflects it', async () => {
    const session = context.session;
    const product = context.product;
    const variant = context.variant;
    assert(session?.access_token, 'admin session is missing');
    assert(product?.id && product?.slug && variant?.id, 'product or variant context is missing');

    const headers = { Authorization: `Bearer ${session.access_token}` };
    const listBefore = await requestJson(
      `/song-thanh/product-groups/${product.id}/highlight-specs?variant_id=${variant.id}`,
      { headers }
    );
    assert(listBefore.ok, `highlight list returned ${listBefore.status}`);

    const suggestions = await requestJson(
      `/song-thanh/product-groups/${product.id}/highlight-spec-suggestions?variant_id=${variant.id}`,
      { headers }
    );
    assert(suggestions.ok, `highlight suggestions returned ${suggestions.status}`);

    const createLabel = `QA highlight ${runId}`;
    const create = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs`, {
      method: 'POST',
      headers,
      body: {
        product_variant_id: variant.id,
        source_type: 'manual',
        display_label: createLabel,
        display_value: 'before update',
        sort_order: 999
      }
    });
    assert(create.ok, `highlight create returned ${create.status}`);
    const created = unwrap(create)?.highlight_spec;
    assert(created?.id, 'created highlight id is missing');

    let archived = false;
    try {
      const updatedLabel = `QA highlight updated ${runId}`;
      const update = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/${created.id}`, {
        method: 'PUT',
        headers,
        body: {
          display_label: updatedLabel,
          display_value: 'after update',
          sort_order: 998
        }
      });
      assert(update.ok, `highlight update returned ${update.status}`);

      const reorder = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/reorder`, {
        method: 'POST',
        headers,
        body: {
          items: [{ id: created.id, sort_order: 997 }]
        }
      });
      assert(reorder.ok, `highlight reorder returned ${reorder.status}`);

      const publicDetail = await requestJson(`/public/product-groups/${encodeURIComponent(product.slug)}`);
      assert(publicDetail.ok, `public detail after highlight update returned ${publicDetail.status}`);
      const variants = unwrap(publicDetail)?.variants || [];
      const publicVariant = variants.find((item) => item.id === variant.id);
      const publicLabels = (publicVariant?.highlight_specs || []).map((item) => item.display_label || item.label);
      assert(publicLabels.includes(updatedLabel), 'updated highlight is not visible in public variant detail');

      const archive = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/${created.id}/archive`, {
        method: 'POST',
        headers
      });
      assert(archive.ok, `highlight archive returned ${archive.status}`);
      archived = true;

      const listAfter = await requestJson(
        `/song-thanh/product-groups/${product.id}/highlight-specs?variant_id=${variant.id}`,
        { headers }
      );
      assert(listAfter.ok, `highlight list after archive returned ${listAfter.status}`);
      const stillActive = extractItems(unwrap(listAfter)).some((item) => item.id === created.id);
      assert(!stillActive, 'archived highlight is still active');

      return {
        variant_id: variant.id,
        suggestions: extractItems(unwrap(suggestions)).length,
        before_count: extractItems(unwrap(listBefore)).length,
        created_highlight_id: created.id,
        public_verified: true,
        archived: true
      };
    } finally {
      if (!archived) {
        await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/${created.id}/archive`, {
          method: 'POST',
          headers
        }).catch(() => undefined);
      }
    }
  });

  let browser;
  try {
    browser = await openBrowser();
    const page = await createPage(browser.cdpUrl);
    await page.enable();

    await browserCase('UI-PUB-01', 'Public home renders without runtime overlay on desktop', async () => {
      await page.setViewport(1440, 1000, false);
      await page.navigate(`${FRONTEND_BASE_URL}/`);
      const state = await inspectBrowserPage(page, ['song thanh']);
      assert(state.no_runtime_overlay, 'Next/runtime overlay is visible');
      assert(state.has_expected_text, 'home did not contain expected text');
      assert(state.no_horizontal_overflow, `horizontal overflow ${state.overflow_px}px`);
      return state;
    });

    await browserCase('UI-PUB-02', 'Public search page works with a product query', async () => {
      const query = firstSearchToken(context.product?.name || 'led');
      await page.setViewport(1440, 1000, false);
      await page.navigate(`${FRONTEND_BASE_URL}/tim-kiem?q=${encodeURIComponent(query)}`);
      const state = await inspectBrowserPage(page, ['tim kiem']);
      assert(state.no_runtime_overlay, 'Next/runtime overlay is visible');
      assert(state.has_expected_text, 'search page did not contain search wording');
      assert(state.no_horizontal_overflow, `horizontal overflow ${state.overflow_px}px`);
      return { ...state, query };
    });

    await browserCase('UI-PUB-03', 'Public product detail shows quick specs and request actions', async () => {
      const slug = context.product?.slug;
      assert(slug, 'product slug is missing');
      await page.setViewport(1440, 1000, false);
      await page.navigate(`${FRONTEND_BASE_URL}/san-pham/${encodeURIComponent(slug)}`);
      const state = await inspectBrowserPage(page, ['thong so noi bat']);
      assert(state.no_runtime_overlay, 'Next/runtime overlay is visible');
      assert(state.has_expected_text, 'detail did not show quick specs');
      const hasRequestAction = await page.evaluate(`Boolean(document.querySelector('[data-product-primary-actions] [data-quote-action="open"]'))`);
      assert(hasRequestAction, 'detail did not show its primary request action');
      assert(state.no_horizontal_overflow, `horizontal overflow ${state.overflow_px}px`);
      return state;
    });

    await browserCase('UI-PUB-04', 'Public product detail is usable on mobile width', async () => {
      const slug = context.product?.slug;
      assert(slug, 'product slug is missing');
      await page.setViewport(390, 844, true);
      await page.navigate(`${FRONTEND_BASE_URL}/san-pham/${encodeURIComponent(slug)}`);
      const state = await inspectBrowserPage(page, ['thong so noi bat']);
      assert(state.no_runtime_overlay, 'Next/runtime overlay is visible');
      assert(state.has_expected_text, 'mobile detail did not show spec navigation');
      assert(state.no_horizontal_overflow, `horizontal overflow ${state.overflow_px}px`);
      return state;
    });

    await browserCase('UI-PUB-05', 'Public contact page exposes the expected form fields', async () => {
      await page.setViewport(1440, 1000, false);
      await page.navigate(`${FRONTEND_BASE_URL}/lien-he`);
      const state = await page.evaluate(`(() => {
        const names = ['full_name', 'phone', 'email', 'company_name', 'message'];
        const fields = Object.fromEntries(names.map((name) => [name, Boolean(document.querySelector('[name="' + name + '"]'))]));
        const text = normalizeForQa(document.body.innerText || '');
        return {
          fields,
          has_submit: /gui|lien he|yeu cau/.test(text),
          no_runtime_overlay: noRuntimeOverlay(),
          no_horizontal_overflow: noHorizontalOverflow(),
          overflow_px: overflowPixels()
        };
      })()`);
      assert(state.no_runtime_overlay, 'Next/runtime overlay is visible');
      assert(Object.values(state.fields).every(Boolean), `missing fields ${JSON.stringify(state.fields)}`);
      assert(state.no_horizontal_overflow, `horizontal overflow ${state.overflow_px}px`);
      return state;
    });

    await browserCase('UI-ADM-01', 'Admin dashboard loads after seeded login', async () => {
      await seedAdminAuth(page, context.session);
      await page.setViewport(1440, 1000, false);
      await page.navigate(adminUrl('/dashboard'));
      await page.waitForCondition(`Boolean(document.querySelector('[data-admin-sidebar]') && document.querySelector('[data-admin-topbar]'))`, NAVIGATION_TIMEOUT_MS, 'dashboard shell did not hydrate');
      const state = await inspectAdminPage(page, ['tong quan']);
      assert(state.no_runtime_overlay, 'Next/runtime overlay is visible');
      assert(state.has_shell, 'admin shell is missing');
      assert(state.has_expected_text, 'dashboard wording is missing');
      return state;
    });

    await browserCase('UI-ADM-02', 'Admin product group detail exposes variant highlight workspace', async () => {
      const product = context.product;
      assert(product?.id, 'product id is missing');
      await page.setViewport(1440, 1100, false);
      page.runtimeErrors.length = 0;
      await page.navigate(adminUrl(`/product-groups/${product.id}?view=variants`));
      const workspaceStartedAt = Date.now();
      try {
        await page.waitForCondition(
          `Boolean(document.querySelector('[data-variant-workspace-trigger="true"]'))`,
          NAVIGATION_TIMEOUT_MS,
          'variant workspace trigger did not become ready'
        );
      } catch (error) {
        const diagnostic = await page.evaluate(`(() => {
          const bodyText = document.body?.innerText || '';
          const resources = performance.getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => /(?:\\/api\\/|product-groups|product-variants|highlight-specs)/i.test(name))
            .slice(-12);
          return {
            workspace_present: Boolean(document.querySelector('[data-product-group-workspace="true"]')),
            trigger_present: Boolean(document.querySelector('[data-variant-workspace-trigger="true"]')),
            alerts: Array.from(document.querySelectorAll('[role="alert"]'))
              .map((node) => (node.textContent || '').trim())
              .filter(Boolean)
              .slice(0, 4),
            text_sample: window.normalizeForQa(bodyText).slice(-700),
            api_resources: resources
          };
        })()`);
        throw new Error(
          `${error?.message || String(error)}; diagnostic=${JSON.stringify(diagnostic)}; runtime_errors=${JSON.stringify(
            page.runtimeErrors.slice(-8)
          )}`
        );
      }
      const workspaceReadyMs = Date.now() - workspaceStartedAt;
      const opened = await page.evaluate(`(() => {
        const root = document.querySelector('[data-product-group-workspace="true"]') || document.querySelector('main');
        const button = root?.querySelector('[data-variant-workspace-trigger="true"]');
        if (!button) return false;
        button.click();
        return true;
      })()`);
      assert(opened, 'could not open the first variant workspace');
      await page.waitForCondition(
        `(() => {
          const normalized = window.normalizeForQa(document.body?.innerText || '');
          return ['thong so noi bat', 'preview ngoai web', 'them thu cong']
            .every((item) => normalized.includes(item));
        })()`,
        NAVIGATION_TIMEOUT_MS,
        'variant highlight editor did not become ready'
      );
      const state = await inspectAdminPage(page, ['thong so noi bat', 'preview ngoai web', 'them thu cong']);
      assert(state.no_runtime_overlay, 'Next/runtime overlay is visible');
      assert(state.has_shell, 'admin shell is missing');
      assert(state.has_expected_text, 'highlight workspace wording is missing');
      return { ...state, workspace_ready_ms: workspaceReadyMs };
    });

    await page.close().catch(() => undefined);
  } finally {
    if (browser) await browser.close();
  }

  writeReport();
  printSummary();

  if (results.some((result) => result.status === 'FAIL')) {
    process.exitCode = 1;
  }
}

async function apiCase(id, title, fn) {
  return runCase(id, 'api', title, fn);
}

async function browserCase(id, title, fn) {
  return runCase(id, 'browser', title, fn);
}

async function runCase(id, area, title, fn) {
  const started = Date.now();
  try {
    const evidence = await fn();
    results.push({
      id,
      area,
      title,
      status: 'PASS',
      duration_ms: Date.now() - started,
      evidence
    });
  } catch (error) {
    results.push({
      id,
      area,
      title,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      error: error?.message || String(error)
    });
  }
}

async function requestRaw(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text
  };
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
  return {
    ok: response.ok,
    status: response.status,
    payload,
    text
  };
}

async function cleanupPublicRequestAndCustomer(kind, requestId, email) {
  const headers = {
    Authorization: `Bearer ${context.session?.access_token || ''}`
  };
  assert(context.session?.access_token, 'admin session missing for QA cleanup');

  const archive = await requestJson(`/song-thanh/${kind}/${requestId}/archive`, {
    method: 'POST',
    headers
  });
  assert(archive.ok || archive.status === 409, `${kind} archive returned ${archive.status}`);

  const remove = await requestJson(`/song-thanh/${kind}/${requestId}/permanent`, {
    method: 'DELETE',
    headers
  });
  assert(remove.ok || remove.status === 404, `${kind} permanent delete returned ${remove.status}`);

  const customers = await requestJson(
    `/song-thanh/customers?q=${encodeURIComponent(email)}&deleted_scope=all&page=1&page_size=100`,
    { headers }
  );
  assert(customers.ok, `customer cleanup lookup returned ${customers.status}`);

  let removedCustomers = 0;
  for (const customer of extractItems(unwrap(customers))) {
    if (String(customer?.email || '').toLowerCase() !== email.toLowerCase()) continue;
    if (!customer.deleted_at) {
      const customerArchive = await requestJson(`/song-thanh/customers/${customer.id}/archive`, {
        method: 'POST',
        headers
      });
      assert(
        customerArchive.ok || customerArchive.status === 409,
        `customer archive returned ${customerArchive.status}`
      );
    }
    const customerRemove = await requestJson(`/song-thanh/customers/${customer.id}/permanent`, {
      method: 'DELETE',
      headers
    });
    assert(
      customerRemove.ok || customerRemove.status === 404,
      `customer permanent delete returned ${customerRemove.status}`
    );
    if (customerRemove.ok) removedCustomers += 1;
  }

  return {
    request_deleted: remove.ok || remove.status === 404,
    customer_profiles_deleted: removedCustomers
  };
}

function unwrap(response) {
  return response?.payload?.data ?? response?.payload;
}

function extractItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.suggestions)) return value.suggestions;
  if (Array.isArray(value?.data?.suggestions)) return value.data.suggestions;
  return [];
}

function firstSearchToken(value) {
  const token = String(value || 'led')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .find((part) => part.length >= 3);
  return token || 'led';
}

function pick(record, keys) {
  return Object.fromEntries(keys.map((key) => [key, record?.[key] ?? null]));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function seedAdminAuth(page, session) {
  assert(session?.access_token, 'admin session missing');
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

async function inspectBrowserPage(page, expectedText) {
  return page.evaluate(`(() => inspectQaPage(${JSON.stringify(expectedText)}, false))()`);
}

async function inspectAdminPage(page, expectedText) {
  return page.evaluate(`(() => inspectQaPage(${JSON.stringify(expectedText)}, true))()`);
}

async function openBrowser() {
  if (process.env.END_USER_QA_CDP_URL) {
    return {
      cdpUrl: process.env.END_USER_QA_CDP_URL.replace(/\/$/, ''),
      close: async () => undefined
    };
  }

  const executable = findBrowserExecutable();
  if (!executable) {
    throw new Error('No Chrome or Edge executable found for browser QA.');
  }

  const userDataDir = mkdtempSync(path.join(tmpdir(), 'song-thanh-end-user-qa-'));
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
        window.noRuntimeOverlay = function noRuntimeOverlay() {
          var hasOverlay = Array.from(document.querySelectorAll('nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-dialog]')).some(function(node) {
            return /Unhandled Runtime Error|Hydration failed|Application error|Failed to compile|Runtime Error|Unexpected server error/i.test(node.textContent || '');
          });
          var bodyText = document.body ? document.body.innerText || '' : '';
          var hasProductionError = /Internal Server Error|Application error:\s*a server-side exception|This page could not be found/i.test(bodyText);
          return !hasOverlay && !hasProductionError;
        };
        window.overflowPixels = function overflowPixels() {
          return Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
        };
        window.noHorizontalOverflow = function noHorizontalOverflow() {
          return window.overflowPixels() <= 2;
        };
        window.inspectQaPage = function inspectQaPage(expectedText, admin) {
          var bodyText = document.body ? document.body.innerText || '' : '';
          var normalized = window.normalizeForQa(bodyText);
          var expected = expectedText || [];
          return {
            url: window.location.href,
            title: document.title,
            no_runtime_overlay: window.noRuntimeOverlay(),
            no_horizontal_overflow: window.noHorizontalOverflow(),
            overflow_px: window.overflowPixels(),
            has_expected_text: expected.every(function(item) { return normalized.includes(window.normalizeForQa(item)); }),
            has_shell: admin ? Boolean(document.querySelector('[data-admin-sidebar]') && document.querySelector('[data-admin-topbar]')) : true,
            text_sample: normalized.slice(0, 240)
          };
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
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      this.runtimeErrors.push(message.params?.exceptionDetails?.text || 'Runtime exception');
    }
    if (message.method === 'Log.entryAdded' && message.params?.entry?.level === 'error') {
      this.runtimeErrors.push(message.params.entry.text || 'Log error');
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
      await this.wait(150);
    }
    throw new Error(`Navigation did not settle at ${normalizedExpectedUrl}`);
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

  async waitForCondition(expression, timeoutMs, message) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try {
        if (await this.evaluate(expression)) return;
      } catch {
        // The page may still be committing or hydrating.
      }
      await this.wait(150);
    }
    throw new Error(message);
  }

  async close() {
    for (const pending of this.pending.values()) clearTimeout(pending.timeout);
    this.pending.clear();
    if (this.ws) this.ws.close();
  }
}

function writeReport() {
  const reportDir = path.join(ROOT, 'tmp', 'qa-artifacts');
  mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'end-user-qa-last-run.md');
  const lines = [
    '# End-user QA last run',
    '',
    `Run id: \`${runId}\``,
    `Date: \`${new Date().toISOString()}\``,
    '',
    '| Case | Area | Result | Duration | QA data | Notes |',
    '| --- | --- | --- | ---: | --- | --- |'
  ];

  for (const result of results) {
    const note = result.status === 'PASS'
      ? compactEvidence(result.evidence)
      : result.error;
    lines.push(
      `| ${result.id} | ${result.area} | ${result.status} | ${result.duration_ms}ms | ${escapeTable(
        CASE_DATA_IMPACT[result.id] || 'No persistent QA data.'
      )} | ${escapeTable(note)} |`
    );
  }

  lines.push('', 'Generated by `node scripts/qa/end-user-smoke.mjs`.');
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

function compactEvidence(value) {
  if (!value) return '';
  const text = JSON.stringify(value);
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function printSummary() {
  const failed = results.filter((result) => result.status === 'FAIL');
  console.log(`End-user QA run ${runId}`);
  console.log(`Targets: API=${API_BASE_URL} Admin=${ADMIN_BASE_URL}${ADMIN_BASE_PATH} Frontend=${FRONTEND_BASE_URL}`);
  for (const result of results) {
    const suffix = result.status === 'PASS' ? '' : ` - ${result.error}`;
    console.log(`${result.status} ${result.id} ${result.title}${suffix}`);
  }
  console.log(`Report: ${path.join(ROOT, 'tmp', 'qa-artifacts', 'end-user-qa-last-run.md')}`);
  console.log(`Summary: ${results.length - failed.length}/${results.length} passed`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
