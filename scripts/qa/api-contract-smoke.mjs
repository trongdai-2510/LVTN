import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const API_BASE_URL = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const QA_CLIENT_IP = '192.0.2.20';
const IMPORT_FIXTURE = path.join(ROOT, 'scripts', 'qa', 'fixtures', 'qa-import-mapping-profile.csv');
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const results = [];
const context = {};

const adminReadModules = [
  { id: 'ADM-READ-BANNERS', name: 'banners', path: '/song-thanh/banners' },
  { id: 'ADM-READ-REDIRECTS', name: 'redirects', path: '/song-thanh/redirects' },
  { id: 'ADM-READ-AUDIT', name: 'audit logs', path: '/song-thanh/audit-logs', readOnly: true },
  { id: 'ADM-READ-SERVICES', name: 'services', path: '/song-thanh/services' },
  { id: 'ADM-READ-PROJECTS', name: 'projects', path: '/song-thanh/projects' },
  { id: 'ADM-READ-FILES', name: 'files', path: '/song-thanh/files' },
  { id: 'ADM-READ-CATEGORIES', name: 'product categories', path: '/song-thanh/product-categories' },
  { id: 'ADM-READ-BRANDS', name: 'brands', path: '/song-thanh/brands' },
  { id: 'ADM-READ-BRAND-PAGES', name: 'brand pages', path: '/song-thanh/brand-pages' },
  { id: 'ADM-READ-PRODUCT-GROUPS', name: 'product groups', path: '/song-thanh/product-groups' },
  { id: 'ADM-READ-PRODUCT-VARIANTS', name: 'product variants', path: '/song-thanh/product-variants' },
  { id: 'ADM-READ-DOCUMENTS', name: 'technical documents', path: '/song-thanh/technical-documents' },
  { id: 'ADM-READ-CONTACTS', name: 'contacts', path: '/song-thanh/contacts' },
  { id: 'ADM-READ-CUSTOMERS', name: 'customers', path: '/song-thanh/customers' },
  { id: 'ADM-READ-QUOTES', name: 'quotes', path: '/song-thanh/quotes' },
  { id: 'ADM-READ-WEBSITE', name: 'website settings', path: '/song-thanh/website-settings', singleton: true },
  { id: 'ADM-READ-MENUS', name: 'menus', path: '/song-thanh/menus' },
  { id: 'ADM-READ-PAGES', name: 'page contents', path: '/song-thanh/page-contents' }
];

async function main() {
  await runCase('API-HEALTH', 'api', 'API health is reachable', async () => {
    const health = await requestRaw(`${API_BASE_URL}/health`);
    assert(health.status === 200, `health returned ${health.status}`);
    return { status: health.status };
  });

  await runCase('AUTH-01', 'auth', 'Admin auth rejects bad credentials and accepts seeded admin', async () => {
    const invalid = await requestJson('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: `wrong-${runId}` }
    });
    assert(!invalid.ok && invalid.status >= 400, `bad login returned ${invalid.status}`);

    const login = await requestJson('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    assert(login.ok, `seed login returned ${login.status}`);
    const session = unwrap(login);
    assert(session?.access_token, 'login response does not include access_token');
    context.session = session;

    const me = await requestJson('/auth/me', {
      headers: authHeaders()
    });
    assert(me.ok, `auth/me returned ${me.status}`);

    return {
      rejected_status: invalid.status,
      user_email: session.user?.email || ADMIN_EMAIL,
      permissions: Array.isArray(session.permissions) ? session.permissions.length : null
    };
  }, { qaData: 'No persistent QA data.' });

  await publicReadCases();
  await adminReadCases();
  await websiteSettingsRoundTripCase();
  await publicMutationCases();
  await highlightMutationCase();
  await validationCases();
  await importIntakeCase();

  writeReport();
  printSummary();
  if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1;
}

async function publicReadCases() {
  await runCase('PUB-READ-SHELL', 'public-api', 'Public site shell returns company identity', async () => {
    const response = await requestJson('/public/site-shell');
    assert(response.ok, `site shell returned ${response.status}`);
    const data = unwrap(response);
    assert(data?.company_info?.display_name, 'company_info.display_name missing');
    return pick(data.company_info, ['display_name', 'hotline', 'email']);
  });

  await runCase('PUB-READ-REDIRECTS', 'public-api', 'Active redirects are exposed for frontend execution', async () => {
    const response = await requestJson('/public/redirects');
    assert(response.ok, `redirects returned ${response.status}`);
    const items = extractItems(unwrap(response));
    assert(
      items.every(
        (item) =>
          typeof item?.from_path === 'string' &&
          item.from_path.startsWith('/') &&
          typeof item?.to_path === 'string' &&
          item.to_path.startsWith('/') &&
          (item.redirect_type === 301 || item.redirect_type === 302)
      ),
      'public redirects contain an invalid path or redirect type'
    );
    return { count: items.length };
  });

  await runCase('PUB-READ-CATEGORIES', 'public-api', 'Public categories list returns active taxonomy', async () => {
    const response = await requestJson('/public/product-categories?page=1&page_size=5');
    assert(response.ok, `categories returned ${response.status}`);
    return { count: extractItems(unwrap(response)).length };
  });

  await runCase('PUB-READ-PRODUCTS', 'public-api', 'Public product list/detail expose visible products', async () => {
    const response = await requestJson('/public/product-groups?page=1&page_size=5');
    assert(response.ok, `product list returned ${response.status}`);
    const products = extractItems(unwrap(response));
    assert(
      products.every((item) =>
        (item.highlight_specs || []).every((spec) => spec.product_variant_id === null)
      ),
      'product list leaked variant-level highlight specs into card payloads'
    );
    const product = products[0];
    assert(product?.id && product?.slug, 'no public product group found');
    context.product = product;

    const detail = await requestJson(`/public/product-groups/${encodeURIComponent(product.slug)}`);
    assert(detail.ok, `product detail returned ${detail.status}`);
    const detailData = unwrap(detail);
    const variants = Array.isArray(detailData?.variants) ? detailData.variants : [];
    context.productDetail = detailData;
    context.variant = variants.find((variant) => Array.isArray(variant.highlight_specs) && variant.highlight_specs.length > 0) || variants[0];
    assert(context.variant?.id, 'product detail has no usable variant');
    return {
      slug: product.slug,
      variant_count: variants.length,
      selected_variant_highlights: context.variant.highlight_specs?.length || 0
    };
  });

  await optionalPublicListDetail('PUB-READ-SERVICES', 'public services', '/public/services', '/public/services');
  await optionalPublicListDetail('PUB-READ-PROJECTS', 'public projects', '/public/projects', '/public/projects');
  await optionalPublicListDetail('PUB-READ-BRANDS', 'public brands', '/public/brands', '/public/brands');

  await runCase('PUB-READ-BANNERS', 'public-api', 'Public banners list returns safely', async () => {
    const response = await requestJson('/public/banners');
    assert(response.ok, `banners returned ${response.status}`);
    return { count: extractItems(unwrap(response)).length };
  });

  await runCase('PUB-READ-PAGE-CONTENT', 'public-api', 'Published page content can be read when present', async () => {
    for (const slug of ['gioi-thieu', 'lien-he', 'dich-vu', 'du-an', 'doi-tac-thuong-hieu']) {
      const response = await requestJson(`/public/page-contents/${encodeURIComponent(slug)}`);
      if (response.ok) {
        return { slug, status: response.status };
      }
      if (response.status !== 404) {
        throw new Error(`page content ${slug} returned ${response.status}`);
      }
    }
    return skip('No published standard page content found in local data.');
  });
}

async function optionalPublicListDetail(id, label, listPath, detailBasePath) {
  await runCase(id, 'public-api', `${label} list/detail returns safely`, async () => {
    const response = await requestJson(`${listPath}?page=1&page_size=5`);
    assert(response.ok, `${label} list returned ${response.status}`);
    const item = extractItems(unwrap(response))[0];
    if (!item?.slug) return skip(`No ${label} rows in local data.`);
    const detail = await requestJson(`${detailBasePath}/${encodeURIComponent(item.slug)}`);
    assert(detail.ok, `${label} detail returned ${detail.status}`);
    return { slug: item.slug };
  });
}

async function adminReadCases() {
  for (const module of adminReadModules) {
    await runCase(module.id, 'admin-api', `Admin ${module.name} read contract works`, async () => {
      const list = await requestJson(`${module.path}${module.path.includes('?') ? '&' : '?'}page=1&page_size=3`, {
        headers: authHeaders()
      });
      assert(list.ok, `${module.name} list returned ${list.status}`);
      if (module.singleton) {
        return { list_status: list.status, detail: 'singleton' };
      }
      const item = extractItems(unwrap(list))[0];
      if (!item?.id) {
        return { list_status: list.status, detail: 'skipped: no rows' };
      }
      const detail = await requestJson(`${module.path}/${encodeURIComponent(item.id)}`, {
        headers: authHeaders()
      });
      assert(detail.ok, `${module.name} detail ${item.id} returned ${detail.status}`);
      return { list_status: list.status, detail_status: detail.status, first_id: item.id };
    });
  }
}

async function websiteSettingsRoundTripCase() {
  await runCase('ADM-MUT-WEBSITE-SYNC', 'admin-public', 'Website settings and active social links stay synchronized with the public shell', async () => {
    const headers = authHeaders();
    const beforeResponse = await requestJson('/song-thanh/website-settings', { headers });
    assert(beforeResponse.ok, `website settings returned ${beforeResponse.status}`);
    const before = unwrap(beforeResponse);
    const settings = before?.settings;
    assert(settings?.id, 'active website settings singleton is missing');

    const fields = [
      'display_name',
      'legal_name',
      'hotline',
      'hotlines',
      'email',
      'address',
      'map_embed_code',
      'working_hours_from',
      'working_hours_to',
      'working_days',
      'logo_file_id',
      'favicon_file_id'
    ];
    const noOpUpdate = Object.fromEntries(fields.map((field) => [field, settings[field] ?? null]));
    const updateResponse = await requestJson('/song-thanh/website-settings', {
      method: 'PUT',
      headers,
      body: noOpUpdate
    });
    assert(updateResponse.ok, `website settings no-op update returned ${updateResponse.status}`);

    const [publicResponse, socialResponse] = await Promise.all([
      requestJson('/public/site-shell'),
      requestJson('/song-thanh/website-settings/social-links?deleted_scope=active', { headers })
    ]);
    assert(publicResponse.ok, `public site shell returned ${publicResponse.status}`);
    assert(socialResponse.ok, `active social links returned ${socialResponse.status}`);

    const publicShell = unwrap(publicResponse);
    const publicCompany = publicShell?.company_info;
    assert(publicCompany?.id === settings.id, 'public shell points to a different company_info row');
    for (const field of fields) {
      assert(
        JSON.stringify(normalizeComparable(publicCompany?.[field])) === JSON.stringify(normalizeComparable(settings[field])),
        `public company_info.${field} does not match admin settings`
      );
    }

    const adminSocialIds = extractItems(unwrap(socialResponse))
      .filter((item) => item?.status === 'active' && !item?.deleted_at)
      .map((item) => item.id)
      .sort();
    const publicSocialIds = (Array.isArray(publicShell?.social_links) ? publicShell.social_links : [])
      .map((item) => item.id)
      .sort();
    assert(
      JSON.stringify(publicSocialIds) === JSON.stringify(adminSocialIds),
      'public social links do not match the active admin social-link set'
    );

    return {
      company_info_id: settings.id,
      verified_fields: fields.length,
      active_social_links: publicSocialIds.length
    };
  }, { qaData: 'Writes the current website-settings values back unchanged; creates no business record.' });
}

async function publicMutationCases() {
  await runCase('PUB-MUT-CONTACT', 'public-api', 'Public contact invalid fails; valid create is verified and fully cleaned', async () => {
    const email = `qa-contract-contact-${runId}@example.com`;
    let createdId = null;
    const invalid = await requestJson('/public/contact-requests', { method: 'POST', body: {} });
    assert(!invalid.ok && invalid.status >= 400, `invalid contact returned ${invalid.status}`);
    try {
      const valid = await requestJson('/public/contact-requests', {
        method: 'POST',
        body: {
          full_name: `QA Contract Contact ${runId}`,
          phone: '0900000000',
          email,
          company_name: 'QA Song Thanh',
          message: `API contract smoke contact ${runId}`,
          source_page: '/qa/api-contract-smoke'
        }
      });
      assert(valid.status === 201, `valid contact returned ${valid.status}`);
      const data = unwrap(valid);
      createdId = data?.contact_request?.id ?? null;
      assert(createdId, 'contact_request.id missing');
      const cleanup = await cleanupPublicRequestAndCustomer('contacts', createdId, email);
      createdId = null;
      return { rejected_status: invalid.status, cleanup };
    } finally {
      if (createdId) await cleanupPublicRequestAndCustomer('contacts', createdId, email, false);
    }
  }, { qaData: 'Creates, verifies, then permanently deletes the QA contact and generated customer profile.' });

  await runCase('PUB-MUT-QUOTE', 'public-api', 'Public quote invalid fails; valid create is verified and fully cleaned', async () => {
    assert(context.product?.id, 'public product context missing');
    const email = `qa-contract-quote-${runId}@example.com`;
    let createdId = null;
    const invalid = await requestJson('/public/quote-requests', { method: 'POST', body: { phone: '123' } });
    assert(!invalid.ok && invalid.status >= 400, `invalid quote returned ${invalid.status}`);
    try {
      const valid = await requestJson('/public/quote-requests', {
        method: 'POST',
        body: {
          full_name: `QA Contract Quote ${runId}`,
          phone: '0901234567',
          email,
          company_name: 'QA Song Thanh',
          message: `API contract smoke quote ${runId}`,
          items: [
            {
              product_group_id: context.product.id,
              product_variant_id: context.variant?.id,
              quantity: 1,
              notes: 'Created by API contract smoke'
            }
          ]
        }
      });
      assert(valid.status === 201, `valid quote returned ${valid.status}`);
      const data = unwrap(valid);
      createdId = data?.quote_request?.id ?? null;
      assert(createdId, 'quote_request.id missing');
      const itemCount = Array.isArray(data.items) ? data.items.length : null;
      const cleanup = await cleanupPublicRequestAndCustomer('quotes', createdId, email);
      createdId = null;
      return { rejected_status: invalid.status, item_count: itemCount, cleanup };
    } finally {
      if (createdId) await cleanupPublicRequestAndCustomer('quotes', createdId, email, false);
    }
  }, { qaData: 'Creates, verifies, then permanently deletes the QA quote, items, and generated customer profile.' });
}

async function cleanupPublicRequestAndCustomer(kind, requestId, email, strict = true) {
  const headers = authHeaders();
  const archive = await requestJson(`/song-thanh/${kind}/${requestId}/archive`, { method: 'POST', headers });
  if (strict) assert(archive.ok || archive.status === 409, `${kind} archive returned ${archive.status}`);

  const remove = await requestJson(`/song-thanh/${kind}/${requestId}/permanent`, { method: 'DELETE', headers });
  if (strict) assert(remove.ok || remove.status === 404, `${kind} permanent delete returned ${remove.status}`);

  const customers = await requestJson(
    `/song-thanh/customers?q=${encodeURIComponent(email)}&deleted_scope=all&page=1&page_size=100`,
    { headers }
  );
  if (strict) assert(customers.ok, `customer cleanup lookup returned ${customers.status}`);

  let removedCustomers = 0;
  for (const customer of extractItems(unwrap(customers))) {
    if (String(customer?.email || '').toLowerCase() !== email.toLowerCase()) continue;
    if (!customer.deleted_at) {
      const customerArchive = await requestJson(`/song-thanh/customers/${customer.id}/archive`, { method: 'POST', headers });
      if (strict) assert(customerArchive.ok || customerArchive.status === 409, `customer archive returned ${customerArchive.status}`);
    }
    const customerRemove = await requestJson(`/song-thanh/customers/${customer.id}/permanent`, { method: 'DELETE', headers });
    if (strict) assert(customerRemove.ok || customerRemove.status === 404, `customer permanent delete returned ${customerRemove.status}`);
    if (customerRemove.ok) removedCustomers += 1;
  }

  return {
    request_deleted: remove.ok || remove.status === 404,
    customer_profiles_deleted: removedCustomers
  };
}

async function highlightMutationCase() {
  await runCase('ADM-MUT-HIGHLIGHT', 'admin-api', 'Highlight specs can be listed, suggested, mutated, verified publicly, and archived', async () => {
    const product = context.product;
    const variant = context.variant;
    assert(product?.id && product?.slug && variant?.id, 'product/variant context missing');

    const headers = authHeaders();
    const list = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs?variant_id=${variant.id}`, { headers });
    assert(list.ok, `highlight list returned ${list.status}`);
    const suggestions = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-spec-suggestions?variant_id=${variant.id}`, { headers });
    assert(suggestions.ok, `highlight suggestions returned ${suggestions.status}`);

    const label = `QA API highlight ${runId}`;
    const create = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs`, {
      method: 'POST',
      headers,
      body: {
        product_variant_id: variant.id,
        source_type: 'manual',
        display_label: label,
        display_value: 'before update',
        sort_order: 900
      }
    });
    assert(create.ok, `highlight create returned ${create.status}`);
    const created = unwrap(create)?.highlight_spec;
    assert(created?.id, 'created highlight id missing');

    let archived = false;
    try {
      const updatedLabel = `QA API highlight updated ${runId}`;
      const update = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/${created.id}`, {
        method: 'PUT',
        headers,
        body: {
          display_label: updatedLabel,
          display_value: 'after update',
          sort_order: 901
        }
      });
      assert(update.ok, `highlight update returned ${update.status}`);

      const reorder = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/reorder`, {
        method: 'POST',
        headers,
        body: { items: [{ id: created.id, sort_order: 902 }] }
      });
      assert(reorder.ok, `highlight reorder returned ${reorder.status}`);

      const publicDetail = await requestJson(`/public/product-groups/${encodeURIComponent(product.slug)}`);
      assert(publicDetail.ok, `public detail returned ${publicDetail.status}`);
      const publicVariant = (unwrap(publicDetail)?.variants || []).find((item) => item.id === variant.id);
      const labels = (publicVariant?.highlight_specs || []).map((item) => item.display_label || item.label);
      assert(labels.includes(updatedLabel), 'updated highlight not visible on public detail');

      const archive = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/${created.id}/archive`, {
        method: 'POST',
        headers
      });
      assert(archive.ok, `highlight archive returned ${archive.status}`);
      archived = true;
      return {
        created_highlight_id: created.id,
        before_count: extractItems(unwrap(list)).length,
        suggestions: extractItems(unwrap(suggestions)).length,
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
  }, { qaData: 'Creates, public-verifies, then archives one QA product_highlight_spec.' });
}

async function validationCases() {
  await runCase('VALIDATION-INVALID-UUID', 'admin-api', 'Invalid UUID returns a validation-style error', async () => {
    const response = await requestJson('/song-thanh/product-groups/not-a-uuid', { headers: authHeaders() });
    assert(!response.ok && response.status >= 400 && response.status < 500, `invalid UUID returned ${response.status}`);
    return { status: response.status, code: response.payload?.error?.code || response.payload?.code || null };
  });

  await runCase('VALIDATION-DUPLICATE-HIGHLIGHT-SOURCE', 'admin-api', 'Duplicate sourced highlight is rejected when a safe candidate exists', async () => {
    const product = context.product;
    const variant = context.variant;
    assert(product?.id && variant?.id, 'product/variant context missing');
    const headers = authHeaders();
    const suggestions = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-spec-suggestions?variant_id=${variant.id}`, { headers });
    assert(suggestions.ok, `highlight suggestions returned ${suggestions.status}`);
    const candidate = extractItems(unwrap(suggestions)).find(
      (item) => !item.already_highlighted && item.source_id && item.source_type !== 'manual'
    );
    if (!candidate) return skip('No unhighlighted sourced suggestion available in local data.');

    const createBody = {
      product_variant_id: variant.id,
      source_type: candidate.source_type,
      source_id: candidate.source_id
    };
    const first = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs`, {
      method: 'POST',
      headers,
      body: createBody
    });
    assert(first.ok, `first sourced highlight create returned ${first.status}`);
    const created = unwrap(first)?.highlight_spec;
    assert(created?.id, 'created sourced highlight id missing');
    let archived = false;
    try {
      const duplicate = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs`, {
        method: 'POST',
        headers,
        body: createBody
      });
      assert(duplicate.status === 409, `duplicate sourced highlight returned ${duplicate.status}, expected 409`);
      const archive = await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/${created.id}/archive`, {
        method: 'POST',
        headers
      });
      assert(archive.ok, `archive sourced highlight returned ${archive.status}`);
      archived = true;
      return { duplicate_status: duplicate.status, archived: true };
    } finally {
      if (!archived) {
        await requestJson(`/song-thanh/product-groups/${product.id}/highlight-specs/${created.id}/archive`, {
          method: 'POST',
          headers
        }).catch(() => undefined);
      }
    }
  }, { qaData: 'Creates and archives one sourced product_highlight_spec when a safe candidate exists.' });
}

async function importIntakeCase() {
  await runCase('IMPORT-INTAKE-MAPPING', 'admin-api', 'Import intake and mapping fixture work without leaving a QA batch', async () => {
    if (!existsSync(IMPORT_FIXTURE)) {
      return skip(`Fixture not found: ${IMPORT_FIXTURE}`);
    }
    const headers = authHeaders();
    const intake = await requestJson('/song-thanh/import-batches/intake', {
      method: 'POST',
      headers,
      body: {
        batch_name: `QA API contract ${runId}`,
        source_workbook_path: IMPORT_FIXTURE
      }
    });
    assert(intake.ok, `import intake returned ${intake.status}`);
    const batchId = readBatchId(intake.payload);
    assert(batchId, 'intake response did not return batch id');

    const mapping = await requestJson(`/song-thanh/import-batches/${batchId}/confirm-mapping`, {
      method: 'POST',
      headers,
      body: {
        category_main_column: 'Lớp ông',
        category_sub_column: 'Lớp cha',
        product_group_column: 'Tên SP',
        product_variant_column: 'Lớp con',
        spec_columns: ['Thông số'],
        attribute_columns: ['Loại/Màu'],
        save_mapping_profile: false
      }
    });
    assert(mapping.ok, `confirm mapping returned ${mapping.status}`);
    const readiness = await requestJson(`/song-thanh/import-batches/${batchId}/readiness`, { headers });
    assert(readiness.ok || readiness.status === 409, `readiness returned ${readiness.status}`);
    const cleanup = await requestJson(`/song-thanh/import-batches/${batchId}`, {
      method: 'DELETE',
      headers
    });
    assert(cleanup.ok, `import cleanup returned ${cleanup.status}`);
    return {
      mapping_status: mapping.status,
      readiness_status: readiness.status,
      apply_attempted: false,
      batch_deleted: true
    };
  }, { qaData: 'Creates and verifies one QA import batch, then permanently deletes the batch and source metadata.' });
}

async function runCase(id, area, title, fn, options = {}) {
  const started = Date.now();
  try {
    const evidence = await withTimeout(Promise.resolve().then(fn), Number(process.env.API_CONTRACT_CASE_TIMEOUT_MS || 20000), `${id} timed out`);
    if (evidence?.__skip) {
      results.push({
        id,
        area,
        title,
        status: 'SKIP',
        duration_ms: Date.now() - started,
        qa_data: options.qaData || 'No persistent QA data.',
        notes: evidence.reason
      });
      return;
    }
    results.push({
      id,
      area,
      title,
      status: 'PASS',
      duration_ms: Date.now() - started,
      qa_data: options.qaData || 'No persistent QA data.',
      evidence
    });
  } catch (error) {
    results.push({
      id,
      area,
      title,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      qa_data: options.qaData || 'No persistent QA data.',
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
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text()
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
  if (Array.isArray(value?.suggestions)) return value.suggestions;
  return [];
}

function readBatchId(payload) {
  const data = payload?.data ?? payload;
  return data?.batch?.id || data?.id || null;
}

function skip(reason) {
  return { __skip: true, reason };
}

function pick(record, keys) {
  return Object.fromEntries(keys.map((key) => [key, record?.[key] ?? null]));
}

function normalizeComparable(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  return value ?? null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function writeReport() {
  const reportPath = path.join(ROOT, 'tmp', 'qa-artifacts', 'api-contract-qa-last-run.md');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  const lines = [
    '# API contract QA last run',
    '',
    `Run id: \`${runId}\``,
    `Date: \`${new Date().toISOString()}\``,
    `Target: \`${API_BASE_URL}\``,
    '',
    '| Case | Area | Result | Duration | QA data | Notes |',
    '| --- | --- | --- | ---: | --- | --- |'
  ];
  for (const result of results) {
    const notes =
      result.status === 'PASS'
        ? compact(result.evidence)
        : result.status === 'SKIP'
          ? result.notes
          : result.error;
    lines.push(
      `| ${result.id} | ${result.area} | ${result.status} | ${result.duration_ms}ms | ${escapeTable(
        result.qa_data
      )} | ${escapeTable(notes)} |`
    );
  }
  lines.push('', 'Generated by `node scripts/qa/api-contract-smoke.mjs`.');
  writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

function printSummary() {
  const failed = results.filter((result) => result.status === 'FAIL');
  const skipped = results.filter((result) => result.status === 'SKIP');
  console.log(`API contract QA run ${runId}`);
  for (const result of results) {
    const suffix = result.status === 'PASS' ? '' : ` - ${result.error || result.notes}`;
    console.log(`${result.status} ${result.id} ${result.title}${suffix}`);
  }
  console.log(`Report: ${path.join(ROOT, 'tmp', 'qa-artifacts', 'api-contract-qa-last-run.md')}`);
  console.log(`Summary: ${results.length - failed.length - skipped.length}/${results.length} passed, ${skipped.length} skipped`);
}

function compact(value) {
  if (!value) return '';
  const text = JSON.stringify(value);
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
