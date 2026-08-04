import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const API_ROOT = path.join(ROOT, 'api');
const requireFromApi = createRequire(path.join(API_ROOT, 'package.json'));
const knexFactory = requireFromApi('knex');
const dotenv = requireFromApi('dotenv');

dotenv.config({ path: path.join(API_ROOT, '.env'), override: false });

const API_BASE_URL = (
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_QA_EMAIL || 'admin@songthanh.local';
const ADMIN_PASSWORD = process.env.ADMIN_QA_PASSWORD || 'ChangeMe123!';
const QA_CLIENT_IP = '192.0.2.40';
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'working-notes',
  'file-usage-atomicity-qa-last-run.md'
);
const TRIGGER_NAME = 'trg_qa_fail_file_usage';
const FUNCTION_NAME = 'st_qa_fail_file_usage';
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const databaseName = process.env.DATABASE_NAME || '';
if (!/_qa_[0-9]{14}$/.test(databaseName)) {
  throw new Error(
    `Refusing failure-injection test outside an isolated QA database: ${databaseName || '(missing)'}`
  );
}

const db = knexFactory({
  client: 'pg',
  connection: {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: databaseName,
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? {
            rejectUnauthorized:
              process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
          }
        : false
  },
  pool: { min: 0, max: 2 }
});

const results = [];
const context = {
  accessToken: '',
  fileId: '',
  brandId: '',
  failedCreateSlug: `qa-atomic-create-${runId}`,
  failedRichPageSlug: `qa-atomic-rich-page-${runId}`,
  fixtureSlug: `qa-atomic-fixture-${runId}`
};

async function main() {
  try {
    await installFailureFunction();

    await runCase('ATOMIC-ENV', 'QA database, API, administrator and an active file are available', async () => {
      const health = await request('/health');
      assert(health.status === 200, `health returned ${health.status}`);
      const login = await request('/auth/login', {
        method: 'POST',
        body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
      });
      assert([200, 201].includes(login.status), responseError(login));
      context.accessToken = String(unwrap(login)?.access_token || '');
      assert(context.accessToken, 'access token missing');

      const file = await db('file_metadata')
        .whereNull('deleted_at')
        .whereRaw('mime_type LIKE ?', ['image/%'])
        .orderBy('created_at', 'asc')
        .first('id');
      assert(file?.id, 'an active managed image is required for atomicity QA');
      context.fileId = String(file.id);
      return { database: databaseName, file_id: context.fileId };
    });

    await runCase('ATOMIC-CREATE-ROLLBACK', 'A file-usage insert failure rolls back the owning brand insert', async () => {
      await configureFailure('INSERT', '*');
      const response = await adminRequest('/song-thanh/brands', {
        method: 'POST',
        body: {
          name: `QA Atomic Create ${runId}`,
          slug: context.failedCreateSlug,
          logo_file_id: context.fileId,
          status: 'active'
        }
      });
      assert(response.status === 500, `injected create returned ${response.status}`);
      const row = await db('brand').where({ slug: context.failedCreateSlug }).first('id');
      assert(!row, 'brand insert survived a failed file-usage write');
      return { response_status: response.status, brand_persisted: false };
    });

    await runCase('ATOMIC-RICH-CONTENT-CREATE-ROLLBACK', 'A rich-content usage failure rolls back both the page and its managed image usage', async () => {
      await configureFailure('INSERT', '*', 'page_content');
      const response = await adminRequest('/song-thanh/page-contents', {
        method: 'POST',
        body: {
          title: `QA Atomic Rich Page ${runId}`,
          slug: context.failedRichPageSlug,
          content_type: 'page',
          content_html: `<p>Atomic rich content</p><img src="/public/files/${context.fileId}" alt="QA">`
        }
      });
      assert(response.status === 500, `injected rich page create returned ${response.status}`);
      const row = await db('page_content')
        .where({ slug: context.failedRichPageSlug })
        .first('id');
      assert(!row, 'page insert survived a failed rich-content usage write');
      const usage = await db('file_usage')
        .where({
          file_id: context.fileId,
          entity_type: 'page_content',
          field_name: 'content_html'
        })
        .whereNull('deleted_at')
        .first('id');
      assert(!usage, 'rich-content file usage survived a rolled-back page create');
      return {
        response_status: response.status,
        page_persisted: false,
        usage_persisted: false
      };
    });

    await runCase('ATOMIC-FIXTURE', 'A brand fixture with no file reference can be created safely', async () => {
      await removeFailureTrigger();
      const response = await adminRequest('/song-thanh/brands', {
        method: 'POST',
        body: {
          name: `QA Atomic Fixture ${runId}`,
          slug: context.fixtureSlug,
          status: 'active'
        }
      });
      assert(response.status === 201, responseError(response));
      context.brandId = String(unwrap(response)?.brand?.id || '');
      assert(context.brandId, 'fixture brand id missing');
      return { brand_id: context.brandId };
    });

    await runCase('ATOMIC-UPDATE-ROLLBACK', 'A file-usage insert failure rolls back the owning brand update', async () => {
      await configureFailure('INSERT', context.brandId);
      const response = await adminRequest(`/song-thanh/brands/${context.brandId}`, {
        method: 'PUT',
        body: { logo_file_id: context.fileId }
      });
      assert(response.status === 500, `injected update returned ${response.status}`);
      const row = await db('brand').where({ id: context.brandId }).first('logo_file_id');
      assert(row?.logo_file_id === null, 'brand logo changed despite failed usage insert');
      const usage = await activeBrandUsage();
      assert(!usage, 'file usage survived a rolled-back brand update');
      return { response_status: response.status, logo_file_id: row.logo_file_id };
    });

    await runCase('ATOMIC-BASELINE-USAGE', 'A normal update persists the business reference and active usage together', async () => {
      await removeFailureTrigger();
      const response = await adminRequest(`/song-thanh/brands/${context.brandId}`, {
        method: 'PUT',
        body: { logo_file_id: context.fileId }
      });
      assert(response.status === 200, responseError(response));
      const row = await db('brand').where({ id: context.brandId }).first('logo_file_id');
      const usage = await activeBrandUsage();
      assert(row?.logo_file_id === context.fileId, 'brand logo was not stored');
      assert(usage, 'active file usage was not stored');
      return { logo_file_id: row.logo_file_id, usage_id: usage.id };
    });

    await runCase('ATOMIC-ARCHIVE-ROLLBACK', 'A file-usage archive failure rolls back the owning brand archive', async () => {
      await configureFailure('UPDATE', context.brandId);
      const response = await adminRequest(`/song-thanh/brands/${context.brandId}/archive`, {
        method: 'POST',
        body: {}
      });
      assert(response.status === 500, `injected archive returned ${response.status}`);
      const row = await db('brand').where({ id: context.brandId }).first('deleted_at');
      assert(row?.deleted_at === null, 'brand was archived despite failed usage update');
      assert(await activeBrandUsage(), 'active usage disappeared despite archive rollback');
      return { response_status: response.status, brand_archived: false };
    });

    await runCase('ATOMIC-ARCHIVE-BASELINE', 'A normal archive updates the business row and usage together', async () => {
      await removeFailureTrigger();
      const response = await adminRequest(`/song-thanh/brands/${context.brandId}/archive`, {
        method: 'POST',
        body: {}
      });
      assert(response.status === 200, responseError(response));
      const row = await db('brand').where({ id: context.brandId }).first('deleted_at');
      assert(row?.deleted_at, 'brand archive was not persisted');
      assert(!(await activeBrandUsage()), 'usage remained active after brand archive');
      return { brand_archived: true, active_usage: false };
    });

    await runCase('ATOMIC-RESTORE-ROLLBACK', 'A file-usage restore failure rolls back the owning brand restore', async () => {
      await configureFailure('UPDATE', context.brandId);
      const response = await adminRequest(`/song-thanh/brands/${context.brandId}/restore`, {
        method: 'POST',
        body: {}
      });
      assert(response.status === 500, `injected restore returned ${response.status}`);
      const row = await db('brand').where({ id: context.brandId }).first('deleted_at');
      assert(row?.deleted_at, 'brand restored despite failed usage update');
      assert(!(await activeBrandUsage()), 'usage restored despite transaction rollback');
      return { response_status: response.status, brand_remains_archived: true };
    });

    await runCase('ATOMIC-RESTORE-BASELINE', 'A normal restore reactivates the business row and usage together', async () => {
      await removeFailureTrigger();
      const response = await adminRequest(`/song-thanh/brands/${context.brandId}/restore`, {
        method: 'POST',
        body: {}
      });
      assert(response.status === 200, responseError(response));
      const row = await db('brand').where({ id: context.brandId }).first('deleted_at');
      assert(row?.deleted_at === null, 'brand restore was not persisted');
      assert(await activeBrandUsage(), 'usage was not restored with the brand');
      return { brand_archived: false, active_usage: true };
    });
  } finally {
    await cleanup().catch((error) => {
      results.push({
        id: 'ATOMIC-CLEANUP',
        title: 'Failure-injection artifacts are removed',
        status: 'FAIL',
        error: error?.message || String(error)
      });
    });
    await db.destroy();
    writeReport();
    printSummary();
  }

  if (results.some((result) => result.status === 'FAIL')) {
    process.exitCode = 1;
  }
}

async function installFailureFunction() {
  await db.raw(`
    CREATE OR REPLACE FUNCTION ${FUNCTION_NAME}()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.entity_type = TG_ARGV[0]
        AND (TG_ARGV[1] = '*' OR NEW.entity_id::text = TG_ARGV[1])
        AND TG_OP = TG_ARGV[2]
      THEN
        RAISE EXCEPTION 'QA injected file_usage failure'
          USING ERRCODE = 'P0001';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
}

async function configureFailure(operation, entityId, entityType = 'brand') {
  await removeFailureTrigger();
  assert(['INSERT', 'UPDATE'].includes(operation), `unsupported trigger operation ${operation}`);
  assert(
    ['brand', 'page_content'].includes(entityType),
    `unsupported trigger entity type ${entityType}`
  );
  assert(entityId === '*' || /^[0-9a-f-]{36}$/i.test(entityId), 'unsafe trigger entity id');
  await db.raw(`
    CREATE TRIGGER ${TRIGGER_NAME}
    BEFORE INSERT OR UPDATE ON file_usage
    FOR EACH ROW
    EXECUTE FUNCTION ${FUNCTION_NAME}('${entityType}', '${entityId}', '${operation}')
  `);
}

async function removeFailureTrigger() {
  await db.raw(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON file_usage`);
}

async function activeBrandUsage() {
  return db('file_usage')
    .where({
      file_id: context.fileId,
      entity_type: 'brand',
      entity_id: context.brandId,
      field_name: 'logo_file_id'
    })
    .whereNull('deleted_at')
    .first('id');
}

async function cleanup() {
  await removeFailureTrigger();
  await db.raw(`DROP FUNCTION IF EXISTS ${FUNCTION_NAME}()`);
  if (context.brandId) {
    await db('file_usage')
      .where({ entity_type: 'brand', entity_id: context.brandId })
      .delete();
    await db('brand_page').where({ brand_id: context.brandId }).delete();
    await db('brand').where({ id: context.brandId }).delete();
  }
  await db('brand_page')
    .whereIn(
      'brand_id',
      db('brand')
        .select('id')
        .whereIn('slug', [context.failedCreateSlug, context.fixtureSlug])
    )
    .delete();
  await db('brand')
    .whereIn('slug', [context.failedCreateSlug, context.fixtureSlug])
    .delete();
  if (context.fileId) {
    await db('file_usage')
      .where({
        file_id: context.fileId,
        entity_type: 'page_content',
        field_name: 'content_html'
      })
      .whereIn(
        'entity_id',
        db('page_content')
          .select('id')
          .where({ slug: context.failedRichPageSlug })
      )
      .delete();
  }
  await db('page_content')
    .where({ slug: context.failedRichPageSlug })
    .delete();

  if (context.fileId) {
    const activeUsage = await db('file_usage')
      .where({ file_id: context.fileId })
      .whereNull('deleted_at')
      .first('id');
    await db('file_metadata')
      .where({ id: context.fileId })
      .update({ is_orphan: !activeUsage });
  }
}

async function adminRequest(route, options = {}) {
  return request(route, { ...options, token: context.accessToken });
}

async function request(route, options = {}) {
  const headers = {
    Accept: 'application/json',
    'X-Forwarded-For': QA_CLIENT_IP
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${API_BASE_URL}${route}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return {
    status: response.status,
    ok: response.ok,
    payload
  };
}

function unwrap(response) {
  return response?.payload?.data ?? response?.payload;
}

function responseError(response) {
  return `${response.status}: ${JSON.stringify(response.payload)}`;
}

async function runCase(id, title, test) {
  const started = Date.now();
  try {
    const evidence = await test();
    results.push({
      id,
      title,
      status: 'PASS',
      duration_ms: Date.now() - started,
      evidence
    });
    console.log(`PASS ${id} ${title}`);
  } catch (error) {
    results.push({
      id,
      title,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      error: error?.message || String(error)
    });
    console.error(`FAIL ${id} ${title}: ${error?.message || String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function writeReport() {
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const lines = [
    '# File usage atomicity QA last run',
    '',
    `Run id: \`${runId}\``,
    `Date: \`${new Date().toISOString()}\``,
    `Database: \`${databaseName}\` (isolated QA clone)`,
    '',
    '| Case | Result | Duration | Evidence |',
    '| --- | --- | ---: | --- |'
  ];
  for (const result of results) {
    lines.push(
      `| ${result.id} — ${result.title} | ${result.status} | ${result.duration_ms ?? 0}ms | ${escapeTable(
        result.status === 'PASS'
          ? JSON.stringify(result.evidence ?? {})
          : result.error
      )} |`
    );
  }
  lines.push(
    '',
    'The test installs a QA-only PostgreSQL trigger that deliberately fails `file_usage` writes. It refuses to run unless `DATABASE_NAME` ends in `_qa_YYYYMMDDHHMMSS`.',
    '',
    'Generated by `node scripts/qa/file-usage-atomicity-smoke.mjs`.'
  );
  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function printSummary() {
  const passed = results.filter((result) => result.status === 'PASS').length;
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Summary: ${passed}/${results.length} passed`);
}

function escapeTable(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

await main();
