import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const QA_CLIENT_IP = '192.0.2.30';
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'working-notes',
  'audit-trail-qa-last-run.md'
);
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const results = [];
const context = {
  accessToken: '',
  actorId: '',
  pageId: '',
  pageSlug: `qa-audit-${runId}`,
  initialTitle: `QA audit initial ${runId}`,
  updatedTitle: `QA audit updated ${runId}`,
  createdUserId: ''
};

await runCase('AUD-ENV', 'API and seeded admin are available', async () => {
  const health = await request('/health');
  assert(health.status === 200, `health returned ${health.status}`);
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  assert(login.status === 201 || login.status === 200, responseError(login));
  const session = unwrap(login);
  context.accessToken = String(session?.access_token || '');
  context.actorId = String(session?.user?.id || '');
  assert(context.accessToken && context.actorId, 'session identity is incomplete');
  return { actor_id: context.actorId };
});

await runCase('AUD-CREATE', 'Create audit has actor, entity, after data and changed fields', async () => {
  const response = await adminRequest('/song-thanh/page-contents', {
    method: 'POST',
    body: {
      title: context.initialTitle,
      slug: context.pageSlug,
      content_type: 'page',
      content_html: '<p>Audit baseline</p>',
      review_status: 'draft',
      publish_status: 'unpublished',
      extra_blocks: { blocks: [] }
    }
  });
  assert(response.status === 201, responseError(response));
  const page = unwrap(response)?.page_content;
  context.pageId = String(page?.id || '');
  assert(context.pageId, 'page_content.id missing');

  const audit = await waitForAudit('page_content', context.pageId, 'create');
  assert(audit.actor_id === context.actorId, 'audit actor does not match caller');
  assert(audit.entity_type === 'page_content', 'audit entity_type mismatch');
  assert(audit.entity_id === context.pageId, 'audit entity_id mismatch');
  assert(audit.old_value === null, 'create old_value must be null');
  assert(audit.new_value?.title === context.initialTitle, 'create new_value is not the created record');
  assert(
    Array.isArray(audit.changed_fields) && audit.changed_fields.includes('title'),
    'create changed_fields does not include title'
  );
  return { audit_id: audit.id };
});

await runCase('AUD-UPDATE', 'Update audit records real before and after snapshots', async () => {
  const response = await adminRequest(`/song-thanh/page-contents/${context.pageId}`, {
    method: 'PUT',
    body: {
      title: context.updatedTitle,
      content_html: '<p>Audit updated</p>'
    }
  });
  assert(response.status === 200, responseError(response));

  const audit = await waitForAudit(
    'page_content',
    context.pageId,
    'update',
    (entry) => entry.new_value?.title === context.updatedTitle
  );
  assert(audit.old_value?.title === context.initialTitle, 'old_value does not preserve the prior title');
  assert(audit.new_value?.title === context.updatedTitle, 'new_value does not contain the saved title');
  assert(audit.changed_fields?.includes('title'), 'changed_fields does not include title');
  assert(audit.changed_fields?.includes('content_html'), 'changed_fields does not include content_html');
  return { audit_id: audit.id };
});

await runCase('AUD-FAILED-MUTATION', 'Rejected mutations do not create success audit rows', async () => {
  const before = await listAudits('page_content', context.pageId);
  const response = await adminRequest(`/song-thanh/page-contents/${context.pageId}`, {
    method: 'PUT',
    body: { review_status: 'not-a-status' }
  });
  assert(response.status === 400, `invalid mutation returned ${response.status}`);
  await delay(350);
  const after = await listAudits('page_content', context.pageId);
  assert(after.length === before.length, `audit count changed from ${before.length} to ${after.length}`);
  return { audit_count: after.length };
});

await runCase('AUD-SECRET-REDACTION', 'Passwords are redacted and never stored in audit JSON', async () => {
  const roleList = await adminRequest('/song-thanh/admin-roles?status=active&page_size=100');
  assert(roleList.status === 200, responseError(roleList));
  const viewerRole = (unwrap(roleList)?.items ?? []).find((role) => role.code === 'viewer');
  assert(viewerRole?.id, 'viewer role missing');

  const temporaryPassword = `Qa-Audit-Secret-${runId}!`;
  const response = await adminRequest('/song-thanh/admin-users', {
    method: 'POST',
    body: {
      display_name: `QA Audit User ${runId}`,
      email: `qa-audit-${runId}@example.com`,
      temporary_password: temporaryPassword,
      role_ids: [viewerRole.id],
      status: 'active'
    }
  });
  assert(response.status === 201, responseError(response));
  const user = unwrap(response)?.user;
  context.createdUserId = String(user?.id || '');
  assert(context.createdUserId, 'created admin user id missing');

  const audit = await waitForAudit('admin_user', context.createdUserId, 'create');
  const serialized = JSON.stringify({
    old_value: audit.old_value,
    new_value: audit.new_value
  });
  assert(!serialized.includes(temporaryPassword), 'plaintext password leaked into audit JSON');
  assert(!serialized.includes('password_hash'), 'password hash field leaked into audit JSON');
  return { audit_id: audit.id };
});

await runCase('AUD-ARCHIVE', 'Archive audit captures the deleted_at transition', async () => {
  const response = await adminRequest(`/song-thanh/page-contents/${context.pageId}/archive`, {
    method: 'POST',
    body: {}
  });
  assert(response.status === 200, responseError(response));
  const audit = await waitForAudit('page_content', context.pageId, 'archive');
  assert(audit.old_value?.deleted_at === null, 'archive old_value should be active');
  assert(Boolean(audit.new_value?.deleted_at), 'archive new_value should contain deleted_at');
  assert(audit.changed_fields?.includes('deleted_at'), 'archive changed_fields misses deleted_at');
  return { audit_id: audit.id };
});

await runCase('AUD-READ-ONLY', 'Audit log surface has no mutation route', async () => {
  const response = await adminRequest('/song-thanh/audit-logs', {
    method: 'POST',
    body: { action: 'create' }
  });
  assert([404, 405].includes(response.status), `audit mutation surface returned ${response.status}`);
  return { status: response.status };
});

await cleanup();
finish();

async function waitForAudit(entityType, entityId, action, predicate = () => true) {
  const deadline = Date.now() + 3000;
  do {
    const entries = await listAudits(entityType, entityId);
    for (const entry of entries) {
      if (entry.action !== action) continue;
      const detailResponse = await adminRequest(`/song-thanh/audit-logs/${entry.id}`);
      assert(detailResponse.status === 200, responseError(detailResponse));
      const detail = unwrap(detailResponse)?.audit_log;
      if (detail && predicate(detail)) return detail;
    }
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error(`audit ${action} for ${entityType}/${entityId} was not observable`);
}

async function listAudits(entityType, entityId) {
  const query = new URLSearchParams({
    entity_type: entityType,
    entity_id: entityId,
    page: '1',
    page_size: '100'
  });
  const response = await adminRequest(`/song-thanh/audit-logs?${query}`);
  assert(response.status === 200, responseError(response));
  return unwrap(response)?.items ?? [];
}

async function cleanup() {
  if (context.pageId) {
    const detail = await adminRequest(`/song-thanh/page-contents/${context.pageId}`).catch(() => null);
    const page = detail ? unwrap(detail)?.page_content : null;
    if (page && !page.deleted_at) {
      await adminRequest(`/song-thanh/page-contents/${context.pageId}/archive`, {
        method: 'POST',
        body: {}
      }).catch(() => undefined);
    }
  }
  if (context.createdUserId) {
    await adminRequest(`/song-thanh/admin-users/${context.createdUserId}/status`, {
      method: 'POST',
      body: { status: 'disabled' }
    }).catch(() => undefined);
  }
}

async function runCase(id, name, action) {
  const startedAt = Date.now();
  try {
    const evidence = await action();
    results.push({ id, name, status: 'PASS', duration_ms: Date.now() - startedAt, evidence });
    console.log(`PASS ${id} ${name}`);
  } catch (error) {
    results.push({
      id,
      name,
      status: 'FAIL',
      duration_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    });
    console.error(`FAIL ${id} ${name}: ${results.at(-1).error}`);
  }
}

async function adminRequest(route, options = {}) {
  return request(route, { ...options, token: context.accessToken });
}

async function request(route, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Forwarded-For': QA_CLIENT_IP,
    ...(options.headers ?? {})
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body;
  if (Object.prototype.hasOwnProperty.call(options, 'body')) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${API_BASE_URL}${route}`, {
    method: options.method ?? 'GET',
    headers,
    body
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, ok: response.ok, body: parsed };
}

function unwrap(response) {
  return response?.body?.data ?? response?.body;
}

function responseError(response) {
  return `HTTP ${response.status}: ${JSON.stringify(response.body)}`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finish() {
  const failed = results.filter((result) => result.status === 'FAIL');
  const lines = [
    '# Audit Trail QA - Last Run',
    '',
    `- Run ID: \`${runId}\``,
    `- Target: \`${API_BASE_URL}\``,
    `- Result: **${results.length - failed.length}/${results.length} passed**`,
    '',
    '| ID | Result | Scenario | Evidence / Error |',
    '| --- | --- | --- | --- |',
    ...results.map((result) => {
      const detail =
        result.status === 'PASS'
          ? JSON.stringify(result.evidence ?? {})
          : result.error;
      return `| ${result.id} | ${result.status} | ${escapeCell(result.name)} | ${escapeCell(detail)} |`;
    }),
    ''
  ];
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Summary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exitCode = 1;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
