const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');

const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const QA_CLIENT_IP = '192.0.2.10';
const RUN_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const SLUG = `qa-page-lifecycle-${RUN_ID}`;
const STEPS = [];

let accessToken = '';
let pageContentId = '';
let currentUpdatedAt = '';
let staleActionVersion = '';
let preArchiveVersion = '';

assertSafeTarget();

try {
  await step('API is healthy', async () => {
    const response = await request('/health');
    assert(response.status === 200, `Expected 200, received ${response.status}`);
  });

  await step('Admin can sign in', async () => {
    const response = await request('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    assert(response.ok, responseError(response));
    const session = unwrap(response.body);
    accessToken = String(session?.access_token || '');
    assert(accessToken, 'Login response did not include access_token.');
  });

  await step('Create starts as draft and unpublished', async () => {
    const response = await adminRequest('/song-thanh/page-contents', {
      method: 'POST',
      body: {
        title: `QA page lifecycle ${RUN_ID}`,
        slug: SLUG,
        content_type: 'page',
        excerpt: 'Initial QA excerpt',
        content_html: '<p>Initial QA content</p>',
        seo_title: `Initial QA SEO ${RUN_ID}`,
        seo_description: 'Initial QA search description',
        review_status: 'draft',
        publish_status: 'unpublished',
        extra_blocks: { blocks: [] }
      }
    });
    assert(response.ok, responseError(response));
    const record = pageRecord(response.body);
    pageContentId = String(record?.id || '');
    currentUpdatedAt = String(record?.updated_at || '');
    assert(pageContentId, 'Create response did not include page_content.id.');
    assert(currentUpdatedAt, 'Create response did not include page_content.updated_at.');
    assert(record.review_status === 'draft', `Expected draft, received ${record.review_status}`);
    assert(record.publish_status === 'unpublished', `Expected unpublished, received ${record.publish_status}`);
  });

  await step('Draft is hidden from the public website', async () => {
    const response = await request(`/public/page-contents/${SLUG}`);
    assert(response.status === 404, `Expected 404, received ${response.status}`);
  });

  await step('Publishing without approval is rejected', async () => {
    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}`, {
      method: 'PUT',
      body: { publish_status: 'published' }
    });
    assert(response.status === 409, `Expected 409, received ${response.status}`);
  });

  await step('Approved page can be published', async () => {
    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}`, {
      method: 'PUT',
      body: {
        expected_updated_at: currentUpdatedAt,
        review_status: 'approved',
        publish_status: 'published',
        published_at: new Date().toISOString()
      }
    });
    assert(response.ok, responseError(response));
    const record = pageRecord(response.body);
    currentUpdatedAt = String(record?.updated_at || '');
    assert(record.review_status === 'approved', `Expected approved, received ${record.review_status}`);
    assert(record.publish_status === 'published', `Expected published, received ${record.publish_status}`);
  });

  await step('Published page is available through the public API', async () => {
    const response = await request(`/public/page-contents/${SLUG}`);
    assert(response.ok, responseError(response));
    const record = publicPageRecord(response.body);
    assert(record?.slug === SLUG, `Expected slug ${SLUG}, received ${record?.slug}`);
    assert(record?.content_html?.includes('Initial QA content'), 'Public content did not match the saved draft.');
  });

  await step('Super Admin major edit keeps the approved page live and updates the public copy', async () => {
    const updatedTitle = `Updated QA page ${RUN_ID}`;
    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}`, {
      method: 'PUT',
      body: {
        expected_updated_at: currentUpdatedAt,
        title: updatedTitle,
        excerpt: 'Updated QA excerpt',
        content_html: '<p>Updated QA content</p>',
        seo_title: `Updated QA SEO ${RUN_ID}`,
        seo_description: 'Updated QA search description'
      }
    });
    assert(response.ok, responseError(response));
    const adminRecord = pageRecord(response.body);
    currentUpdatedAt = String(adminRecord?.updated_at || '');
    assert(
      adminRecord?.review_status === 'approved',
      `Expected approved, received ${adminRecord?.review_status}`
    );
    assert(
      adminRecord?.publish_status === 'published',
      `Expected published, received ${adminRecord?.publish_status}`
    );

    const publicResponse = await request(`/public/page-contents/${SLUG}`);
    assert(publicResponse.ok, responseError(publicResponse));
    const publicRecord = publicPageRecord(publicResponse.body);
    assert(publicRecord?.title === updatedTitle, 'Public title did not reflect the edit.');
    assert(publicRecord?.content_html?.includes('Updated QA content'), 'Public HTML did not reflect the edit.');
  });

  await step('Approved page can be hidden and explicitly republished', async () => {
    const hidden = await adminRequest(`/song-thanh/page-contents/${pageContentId}`, {
      method: 'PUT',
      body: { expected_updated_at: currentUpdatedAt, publish_status: 'unpublished' }
    });
    assert(hidden.ok, responseError(hidden));
    const hiddenRecord = pageRecord(hidden.body);
    currentUpdatedAt = String(hiddenRecord?.updated_at || '');
    assert(hiddenRecord?.publish_status === 'unpublished', 'Page did not become unpublished.');
    const hiddenResponse = await request(`/public/page-contents/${SLUG}`);
    assert(hiddenResponse.status === 404, `Hidden page returned ${hiddenResponse.status}`);

    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}`, {
      method: 'PUT',
      body: { expected_updated_at: currentUpdatedAt, publish_status: 'published' }
    });
    assert(response.ok, responseError(response));
    currentUpdatedAt = String(pageRecord(response.body)?.updated_at || '');

    const publicResponse = await request(`/public/page-contents/${SLUG}`);
    assert(publicResponse.ok, responseError(publicResponse));
    const record = publicPageRecord(publicResponse.body);
    assert(
      record?.title === `Updated QA page ${RUN_ID}`,
      `Public title was not updated: ${record?.title}`
    );
    assert(record?.content_html?.includes('Updated QA content'), 'Public HTML was not updated.');
    assert(record?.seo_title === `Updated QA SEO ${RUN_ID}`, 'Public SEO title was not updated.');
    assert(record?.seo_description === 'Updated QA search description', 'Public SEO description was not updated.');
  });

  await step('Stale admin write is rejected without losing the first writer change', async () => {
    const staleVersion = currentUpdatedAt;
    staleActionVersion = staleVersion;
    const firstWriter = await adminRequest(`/song-thanh/page-contents/${pageContentId}`, {
      method: 'PUT',
      body: {
        expected_updated_at: staleVersion,
        seo_description: 'First writer keeps this value'
      }
    });
    assert(firstWriter.ok, responseError(firstWriter));
    const firstWriterRecord = pageRecord(firstWriter.body);
    currentUpdatedAt = String(firstWriterRecord?.updated_at || '');
    assert(currentUpdatedAt && currentUpdatedAt !== staleVersion, 'First write did not advance updated_at.');

    const staleWriter = await adminRequest(`/song-thanh/page-contents/${pageContentId}`, {
      method: 'PUT',
      body: {
        expected_updated_at: staleVersion,
        seo_description: 'Stale writer must not overwrite'
      }
    });
    assert(staleWriter.status === 409, `Expected stale write 409, received ${staleWriter.status}`);
    assert(
      staleWriter.body?.error?.code === 'PAGE_CONTENT_VERSION_CONFLICT',
      `Expected PAGE_CONTENT_VERSION_CONFLICT, received ${staleWriter.body?.error?.code}`
    );

    const detail = await adminRequest(`/song-thanh/page-contents/${pageContentId}`);
    assert(detail.ok, responseError(detail));
    const persisted = pageRecord(detail.body);
    assert(
      persisted?.seo_description === 'First writer keeps this value',
      'Stale writer overwrote the first writer value.'
    );
  });

  await step('Stale archive action is rejected and leaves the page active', async () => {
    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}/archive`, {
      method: 'POST',
      body: { expected_updated_at: staleActionVersion }
    });
    assert(response.status === 409, `Expected stale archive 409, received ${response.status}`);
    assert(
      response.body?.error?.code === 'PAGE_CONTENT_VERSION_CONFLICT',
      `Expected PAGE_CONTENT_VERSION_CONFLICT, received ${response.body?.error?.code}`
    );
    const detail = await adminRequest(`/song-thanh/page-contents/${pageContentId}`);
    assert(detail.ok, responseError(detail));
    assert(!pageRecord(detail.body)?.deleted_at, 'Stale archive unexpectedly archived the page.');
  });

  await step('Archive hides the page and keeps an admin record', async () => {
    preArchiveVersion = currentUpdatedAt;
    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}/archive`, {
      method: 'POST',
      body: { expected_updated_at: currentUpdatedAt }
    });
    assert(response.ok, responseError(response));
    const record = pageRecord(response.body);
    currentUpdatedAt = String(record?.updated_at || '');
    assert(record?.deleted_at, 'Archived record did not receive deleted_at.');

    const publicResponse = await request(`/public/page-contents/${SLUG}`);
    assert(publicResponse.status === 404, `Expected public 404, received ${publicResponse.status}`);
  });

  await step('Stale restore action is rejected and leaves the page archived', async () => {
    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}/restore`, {
      method: 'POST',
      body: { expected_updated_at: preArchiveVersion }
    });
    assert(response.status === 409, `Expected stale restore 409, received ${response.status}`);
    assert(
      response.body?.error?.code === 'PAGE_CONTENT_VERSION_CONFLICT',
      `Expected PAGE_CONTENT_VERSION_CONFLICT, received ${response.body?.error?.code}`
    );
    const detail = await adminRequest(`/song-thanh/page-contents/${pageContentId}`);
    assert(detail.ok, responseError(detail));
    assert(pageRecord(detail.body)?.deleted_at, 'Stale restore unexpectedly restored the page.');
  });

  await step('Restore is safe and does not republish automatically', async () => {
    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}/restore`, {
      method: 'POST',
      body: { expected_updated_at: currentUpdatedAt }
    });
    assert(response.ok, responseError(response));
    const record = pageRecord(response.body);
    currentUpdatedAt = String(record?.updated_at || '');
    assert(!record?.deleted_at, 'Restored record still has deleted_at.');
    assert(record?.publish_status !== 'published', 'Restore unexpectedly republished the page.');

    const publicResponse = await request(`/public/page-contents/${SLUG}`);
    assert(publicResponse.status === 404, `Restored page should remain hidden; received ${publicResponse.status}`);
  });

  await step('Cleanup archives the temporary QA page', async () => {
    const response = await adminRequest(`/song-thanh/page-contents/${pageContentId}/archive`, {
      method: 'POST',
      body: { expected_updated_at: currentUpdatedAt }
    });
    assert(response.ok, responseError(response));
    const record = pageRecord(response.body);
    assert(record?.deleted_at, 'Cleanup did not archive the QA record.');
  });
} catch (error) {
  await bestEffortCleanup();
  printReport();
  console.error(`\nFAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (!process.exitCode) printReport();
}

async function step(name, action) {
  const startedAt = Date.now();
  try {
    await action();
    STEPS.push({ name, status: 'PASS', duration_ms: Date.now() - startedAt });
  } catch (error) {
    STEPS.push({
      name,
      status: 'FAIL',
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function request(pathname, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Forwarded-For': QA_CLIENT_IP,
    ...(options.headers || {})
  };
  if (typeof options.body !== 'undefined') headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: typeof options.body === 'undefined' ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: response.ok, status: response.status, body };
}

function adminRequest(pathname, options = {}) {
  return request(pathname, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) }
  });
}

function unwrap(body) {
  if (body && typeof body === 'object' && 'data' in body) return body.data;
  return body;
}

function pageRecord(body) {
  const data = unwrap(body);
  return data?.page_content || data;
}

function publicPageRecord(body) {
  const data = unwrap(body);
  return data?.page_content || data?.item || data;
}

function responseError(response) {
  const error = response.body?.error;
  return `${response.status}: ${error?.code || 'REQUEST_FAILED'} - ${error?.message || JSON.stringify(response.body)}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSafeTarget() {
  const hostname = new URL(API_BASE_URL).hostname;
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if (!isLocal && process.env.ALLOW_QA_MUTATIONS !== '1') {
    throw new Error(
      `Refusing to mutate non-local API ${API_BASE_URL}. Set ALLOW_QA_MUTATIONS=1 only for an intentional QA environment.`
    );
  }
}

async function bestEffortCleanup() {
  if (!pageContentId || !accessToken) return;
  const detail = await adminRequest(`/song-thanh/page-contents/${pageContentId}`).catch(() => null);
  const record = detail?.ok ? pageRecord(detail.body) : null;
  if (!record || record.deleted_at) return;
  await adminRequest(`/song-thanh/page-contents/${pageContentId}/archive`, {
    method: 'POST',
    body: {}
  }).catch(() => undefined);
}

function printReport() {
  console.log('\nPage content lifecycle QA');
  console.log(`Target: ${API_BASE_URL}`);
  console.log(`Temporary slug: ${SLUG}`);
  for (const result of STEPS) {
    console.log(`${result.status === 'PASS' ? 'PASS' : 'FAIL'}  ${result.name} (${result.duration_ms} ms)`);
    if (result.error) console.log(`      ${result.error}`);
  }
  const passed = STEPS.filter((result) => result.status === 'PASS').length;
  console.log(`Result: ${passed}/${STEPS.length} steps passed.`);
}
