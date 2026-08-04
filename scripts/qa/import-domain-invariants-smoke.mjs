import { createRequire } from 'node:module';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
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
const QA_CLIENT_IP = '198.51.100.77';
const RUN_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const FIXTURE_ROOT = path.join(ROOT, 'tmp', 'qa-import', RUN_ID);
const OUTSIDE_ROOT = mkdtempSync(path.join(tmpdir(), 'song-thanh-import-outside-'));
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'working-notes',
  'import-domain-invariants-qa-last-run.md'
);
const MAX_IMPORT_WORKBOOK_BYTES = 20 * 1024 * 1024;

const results = [];
const context = {
  accessToken: '',
  adminUserId: '',
  logicUserId: null,
  batchId: '',
  sourceFileId: '',
  conflictId: '',
  pendingGroupId: '',
  pendingVariantId: '',
  officialGroupId: '',
  officialVariantId: '',
  secondBatchId: ''
};

const mapping = {
  category_main_column: 'Main Category',
  category_sub_column: 'Sub Category',
  product_group_column: 'Product Group',
  product_variant_column: 'Variant',
  group_external_code_column: 'Group Code',
  variant_external_code_column: 'Variant Code',
  sku_column: 'SKU',
  model_code_column: 'Model Code',
  public_price_column: 'Price',
  attribute_columns: ['Power'],
  save_mapping_profile: false
};

const identifiers = {
  mainCategory: `QA Import Main ${RUN_ID}`,
  subCategory: `QA Import Sub ${RUN_ID}`,
  groupName: `QA Import Group ${RUN_ID}`,
  variantName: `QA Import Variant ${RUN_ID}`,
  groupCode: `QA-GRP-${RUN_ID}`,
  variantCode: `QA-VAR-${RUN_ID}`,
  sku: `QA-SKU-${RUN_ID}`,
  modelCode: `QA-MODEL-${RUN_ID}`
};

const db = knexFactory({
  client: 'pg',
  connection: {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'song_thanh_cms',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    ssl: parseBoolean(process.env.DATABASE_SSL)
      ? {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
        }
      : false
  },
  pool: { min: 0, max: 2 }
});

assertSafeTarget();
mkdirSync(FIXTURE_ROOT, { recursive: true });

try {
  await runCase('IMPORT-ENV', 'The API and isolated QA database are safe to mutate', async () => {
    const health = await request('/health');
    assert(health.status === 200, `health returned ${health.status}`);
    return { database: process.env.DATABASE_NAME, target: API_BASE_URL };
  });

  await runCase('IMPORT-AUTH', 'Import mutations resolve both admin and business actor identities', async () => {
    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    assertOk(login);
    const session = unwrap(login.body);
    context.accessToken = String(session?.access_token || '');
    context.adminUserId = String(session?.user?.id || '');
    assert(context.accessToken, 'login response did not include access_token');

    const contacts = await adminRequest('/song-thanh/contacts?page=1&page_size=1');
    assertOk(contacts);
    const options = unwrap(contacts.body)?.assignee_options || [];
    const actor = options.find(
      (option) => String(option.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()
    );
    assert(actor && Number.isSafeInteger(actor.id), 'logic-user identity is missing');
    context.logicUserId = actor.id;
    return {
      admin_user_id: context.adminUserId,
      logic_user_id: context.logicUserId
    };
  });

  await runCase('IMPORT-DATE-BOUNDARIES', 'Date filters reject impossible/reversed dates and use complete Vietnam-local days', async () => {
    const impossible = await adminRequest(
      '/song-thanh/import-batches?created_from=2026-02-30'
    );
    assertError(impossible, 400, 'VALIDATION_ERROR');
    const reversed = await adminRequest(
      '/song-thanh/import-batches?created_from=2026-07-31&created_to=2026-07-30'
    );
    assertError(reversed, 400, 'VALIDATION_ERROR');
    const valid = await adminRequest(
      '/song-thanh/import-batches?created_from=2026-07-30&created_to=2026-07-30'
    );
    assertOk(valid);
    const filters = unwrap(valid.body)?.filters;
    assert(
      filters?.created_from === '2026-07-29T17:00:00.000Z',
      `unexpected created_from ${filters?.created_from}`
    );
    assert(
      filters?.created_to === '2026-07-30T16:59:59.999Z',
      `unexpected created_to ${filters?.created_to}`
    );
    return { impossible: impossible.status, reversed: reversed.status, filters };
  });

  await runCase('IMPORT-PARSER-BOUNDARIES', 'Intake rejects malformed CSV/JSON, overlapping/empty ranges, and path escape', async () => {
    const malformed = [
      ['duplicate.csv', 'Ma_San_Pham,ma-san-pham\nA,B\n', {}],
      ['blank.csv', 'name,,sku\nA,B,C\n', {}],
      ['uneven.csv', 'name,sku\nA\n', {}],
      ['unterminated.csv', 'name,sku\n"A,B\n', {}],
      ['invalid.json', '[{"name":', {}],
      ['nested.json', JSON.stringify([{ name: { nested: true } }]), {}]
    ];
    const evidence = [];
    for (const [filename, contents, extraBody] of malformed) {
      const fixture = writeFixture(filename, contents);
      const response = await intake(fixture, {
        batch_name: `QA malformed ${RUN_ID} ${filename}`,
        ...extraBody
      });
      assertError(response, 400, 'VALIDATION_ERROR');
      evidence.push({ filename, status: response.status });
    }

    const validFixture = writeFixture(
      'range-source.csv',
      'name,sku\nA,A-1\nB,B-1\n'
    );
    const overlap = await intake(validFixture, {
      batch_name: `QA overlap ${RUN_ID}`,
      row_ranges: [
        { start_row: 2, end_row: 3 },
        { start_row: 3, end_row: 4 }
      ]
    });
    assertError(overlap, 400, 'VALIDATION_ERROR');
    evidence.push({ filename: 'overlapping ranges', status: overlap.status });

    const emptySelection = await intake(validFixture, {
      batch_name: `QA empty selection ${RUN_ID}`,
      row_ranges: [{ start_row: 99, end_row: 100 }]
    });
    assertError(emptySelection, 400, 'VALIDATION_ERROR');
    evidence.push({ filename: 'empty selected range', status: emptySelection.status });

    const outsideFixture = path.join(OUTSIDE_ROOT, 'outside.csv');
    writeFileSync(outsideFixture, 'name\noutside\n', 'utf8');
    const outside = await intake(outsideFixture, {
      batch_name: `QA outside path ${RUN_ID}`
    });
    assertError(outside, 400, 'VALIDATION_ERROR');
    evidence.push({ filename: 'outside allowed roots', status: outside.status });
    return evidence;
  });

  await runCase('IMPORT-JSON-UNION', 'JSON preview keeps columns introduced after the first row', async () => {
    const fixture = writeFixture(
      'union.json',
      JSON.stringify([
        { first: 'A' },
        { second: 'B' }
      ])
    );
    const response = await intake(fixture, {
      batch_name: `QA JSON union ${RUN_ID}`
    });
    assertOk(response);
    const data = unwrap(response.body);
    const batchId = readBatchId(data);
    assert(
      JSON.stringify(data?.preview?.detected_columns) ===
        JSON.stringify(['first', 'second']),
      `unexpected detected columns ${JSON.stringify(data?.preview?.detected_columns)}`
    );
    const cleanup = await adminRequest(`/song-thanh/import-batches/${batchId}`, {
      method: 'DELETE'
    });
    assertOk(cleanup);
    return { detected_columns: data.preview.detected_columns, batch_deleted: true };
  });

  await runCase('IMPORT-UPLOAD-LIMIT', 'Multipart upload is rejected before buffering beyond the 20 MB contract', async () => {
    const form = new FormData();
    form.append(
      'file',
      new Blob([Buffer.alloc(MAX_IMPORT_WORKBOOK_BYTES + 1, 0x61)], {
        type: 'text/csv'
      }),
      'too-large.csv'
    );
    form.append('batch_name', `QA upload limit ${RUN_ID}`);
    const response = await adminMultipart('/song-thanh/import-batches/upload', form);
    assert(
      response.status === 413,
      `expected 413 for oversized multipart upload, received ${response.status}: ${responseError(
        response
      )}`
    );
    return { bytes: MAX_IMPORT_WORKBOOK_BYTES + 1, status: response.status };
  });

  await runCase('IMPORT-MAPPING-ATOMICITY', 'Invalid mapping and mid-file staging failure leave no partial rows', async () => {
    const duplicateRoleFixture = writeFixture(
      'duplicate-role.csv',
      'main,sub,group,variant\nMain,Sub,Group,Variant\n'
    );
    const duplicateRoleIntake = await intake(duplicateRoleFixture, {
      batch_name: `QA duplicate role ${RUN_ID}`
    });
    assertOk(duplicateRoleIntake);
    const duplicateRoleBatchId = readBatchId(unwrap(duplicateRoleIntake.body));
    const duplicateRoleMapping = await adminRequest(
      `/song-thanh/import-batches/${duplicateRoleBatchId}/confirm-mapping`,
      {
        method: 'POST',
        body: {
          category_main_column: 'main',
          category_sub_column: 'main',
          product_group_column: 'group',
          product_variant_column: 'variant'
        }
      }
    );
    assertError(duplicateRoleMapping, 400, 'VALIDATION_ERROR');
    await assertEmptyStaging(duplicateRoleBatchId);
    await deleteBatch(duplicateRoleBatchId);

    const partialFixture = writeFixture(
      'partial-staging.csv',
      [
        'main,sub,group,variant',
        'Main,Sub,Group,Variant',
        'Main,Sub,Group,'
      ].join('\n')
    );
    const partialIntake = await intake(partialFixture, {
      batch_name: `QA partial staging ${RUN_ID}`
    });
    assertOk(partialIntake);
    const partialBatchId = readBatchId(unwrap(partialIntake.body));
    const partialMapping = await adminRequest(
      `/song-thanh/import-batches/${partialBatchId}/confirm-mapping`,
      {
        method: 'POST',
        body: {
          category_main_column: 'main',
          category_sub_column: 'sub',
          product_group_column: 'group',
          product_variant_column: 'variant'
        }
      }
    );
    assertError(partialMapping, 400, 'VALIDATION_ERROR');
    await assertEmptyStaging(partialBatchId);
    const batchAfterFailure = await db('import_batch')
      .where({ id: partialBatchId })
      .first('status', 'column_mapping');
    assert(batchAfterFailure?.status === 'created', 'failed staging changed batch status');
    assert(batchAfterFailure?.column_mapping === null, 'failed staging persisted mapping');
    await deleteBatch(partialBatchId);

    const oversizedFieldFixture = writeFixture(
      'oversized-business-field.csv',
      [
        'main,sub,group,variant',
        `Main,Sub,${'x'.repeat(256)},Variant`
      ].join('\n')
    );
    const oversizedFieldIntake = await intake(oversizedFieldFixture, {
      batch_name: `QA oversized business field ${RUN_ID}`
    });
    assertOk(oversizedFieldIntake);
    const oversizedFieldBatchId = readBatchId(unwrap(oversizedFieldIntake.body));
    const oversizedFieldMapping = await adminRequest(
      `/song-thanh/import-batches/${oversizedFieldBatchId}/confirm-mapping`,
      {
        method: 'POST',
        body: {
          category_main_column: 'main',
          category_sub_column: 'sub',
          product_group_column: 'group',
          product_variant_column: 'variant'
        }
      }
    );
    assertError(oversizedFieldMapping, 400, 'VALIDATION_ERROR');
    await assertEmptyStaging(oversizedFieldBatchId);
    await deleteBatch(oversizedFieldBatchId);
    return {
      duplicate_role_rolled_back: true,
      mid_file_failure_rolled_back: true,
      schema_length_failure_rolled_back: true
    };
  });

  await runCase('IMPORT-CONFIRM-CONCURRENCY', 'Two concurrent mapping confirmations create staging exactly once', async () => {
    const fixture = writeFixture(
      'concurrent-confirm.csv',
      [
        'main,sub,group,variant',
        'Main,Sub,Concurrent Group,Concurrent Variant'
      ].join('\n')
    );
    const intakeResponse = await intake(fixture, {
      batch_name: `QA concurrent confirm ${RUN_ID}`
    });
    assertOk(intakeResponse);
    const batchId = readBatchId(unwrap(intakeResponse.body));
    const body = {
      category_main_column: 'main',
      category_sub_column: 'sub',
      product_group_column: 'group',
      product_variant_column: 'variant'
    };
    const responses = await Promise.all([
      adminRequest(`/song-thanh/import-batches/${batchId}/confirm-mapping`, {
        method: 'POST',
        body
      }),
      adminRequest(`/song-thanh/import-batches/${batchId}/confirm-mapping`, {
        method: 'POST',
        body
      })
    ]);
    assert(
      responses.filter((response) => response.status === 200).length === 1,
      `concurrent confirm statuses=${responses.map((response) => response.status)}`
    );
    const rejected = responses.find((response) => response.status !== 200);
    assertError(rejected, 409, 'IMPORT_STAGING_ALREADY_CREATED');
    const stats = await batchStats(batchId);
    assert(
      stats.raw === 1 && stats.groups === 1 && stats.variants === 1,
      `concurrent confirm duplicated staging: ${JSON.stringify(stats)}`
    );
    await deleteBatch(batchId);
    return {
      statuses: responses.map((response) => response.status).sort(),
      staging: stats
    };
  });

  await runCase('IMPORT-CONSISTENCY-GUARDS', 'Repeated group identity conflicts and unknown brands cannot silently lose data', async () => {
    const inconsistentFixture = writeFixture(
      'inconsistent-group.csv',
      [
        'main,sub,group,variant,group_code,variant_code',
        `Main,Sub,Group A,Variant A,QA-CONSISTENT-${RUN_ID},QA-CONSISTENT-V1-${RUN_ID}`,
        `Main,Sub,Group B,Variant B,QA-CONSISTENT-${RUN_ID},QA-CONSISTENT-V2-${RUN_ID}`
      ].join('\n')
    );
    const inconsistentIntake = await intake(inconsistentFixture, {
      batch_name: `QA inconsistent group ${RUN_ID}`
    });
    assertOk(inconsistentIntake);
    const inconsistentBatchId = readBatchId(unwrap(inconsistentIntake.body));
    const inconsistentMapping = await adminRequest(
      `/song-thanh/import-batches/${inconsistentBatchId}/confirm-mapping`,
      {
        method: 'POST',
        body: {
          category_main_column: 'main',
          category_sub_column: 'sub',
          product_group_column: 'group',
          product_variant_column: 'variant',
          group_external_code_column: 'group_code',
          variant_external_code_column: 'variant_code'
        }
      }
    );
    assertOk(inconsistentMapping);
    const groupConflict = await db('data_conflict')
      .where({
        import_batch_id: inconsistentBatchId,
        conflict_type: 'inconsistent_group_data'
      })
      .first('*');
    assert(groupConflict, 'inconsistent group metadata was silently ignored');
    await deleteBatch(inconsistentBatchId);

    const unknownBrand = `QA Missing Brand ${RUN_ID}`;
    const brandFixture = writeFixture(
      'unknown-brand.csv',
      [
        'main,sub,group,variant,brand',
        `Main,Sub,Brand Group,Brand Variant,${unknownBrand}`
      ].join('\n')
    );
    const brandIntake = await intake(brandFixture, {
      batch_name: `QA unknown brand ${RUN_ID}`
    });
    assertOk(brandIntake);
    const brandBatchId = readBatchId(unwrap(brandIntake.body));
    const brandMapping = await adminRequest(
      `/song-thanh/import-batches/${brandBatchId}/confirm-mapping`,
      {
        method: 'POST',
        body: {
          category_main_column: 'main',
          category_sub_column: 'sub',
          product_group_column: 'group',
          product_variant_column: 'variant',
          brand_column: 'brand'
        }
      }
    );
    assertOk(brandMapping);
    for (const endpoint of [
      'pending-product-groups/bulk-approve',
      'pending-variants/bulk-approve'
    ]) {
      const approved = await adminRequest(
        `/song-thanh/import-batches/${brandBatchId}/${endpoint}`,
        { method: 'POST', body: { target_status: 'in_review' } }
      );
      assertOk(approved);
    }
    const ready = await adminRequest(
      `/song-thanh/import-batches/${brandBatchId}/review-transition`,
      { method: 'POST', body: { target_status: 'ready_to_apply' } }
    );
    assertError(ready, 409, 'IMPORT_NOT_READY');
    const blockerCodes =
      errorObject(ready)?.details?.blockers?.map((blocker) => blocker.code) || [];
    assert(
      blockerCodes.includes('MISSING_BRAND_MAPPING'),
      `missing brand blocker absent: ${JSON.stringify(blockerCodes)}`
    );
    await deleteBatch(brandBatchId);
    return {
      group_conflict: groupConflict.conflict_type,
      unknown_brand_blocker: 'MISSING_BRAND_MAPPING'
    };
  });

  await runCase('IMPORT-SKIP-SEMANTICS', 'Skipping a row conflict rejects that staging row instead of approving or applying it', async () => {
    const fixture = writeFixture(
      'skip-conflict.csv',
      primaryCsv('invalid-for-skip')
    );
    const intakeResponse = await intake(fixture, {
      batch_name: `QA skip conflict ${RUN_ID}`
    });
    assertOk(intakeResponse);
    const batchId = readBatchId(unwrap(intakeResponse.body));
    const confirmed = await adminRequest(
      `/song-thanh/import-batches/${batchId}/confirm-mapping`,
      { method: 'POST', body: mapping }
    );
    assertOk(confirmed);
    const conflict = await db('data_conflict')
      .where({ import_batch_id: batchId, status: 'open' })
      .first('*');
    assert(conflict, 'skip fixture conflict is missing');
    const skipped = await adminRequest(
      `/song-thanh/import-conflicts/${conflict.id}/resolve`,
      { method: 'POST', body: { decision: 'skip', note: 'QA skip row' } }
    );
    assertOk(skipped);
    const pendingVariant = await db('pending_variant')
      .where({ id: conflict.entity_id })
      .first('*');
    const updatedConflict = await db('data_conflict')
      .where({ id: conflict.id })
      .first('*');
    assert(pendingVariant?.status === 'rejected', `skipped row status=${pendingVariant?.status}`);
    assert(updatedConflict?.status === 'skipped', `conflict status=${updatedConflict?.status}`);
    const approve = await adminRequest(
      `/song-thanh/import-batches/${batchId}/pending-variants/bulk-approve`,
      { method: 'POST', body: { target_status: 'in_review' } }
    );
    assertOk(approve);
    assert(
      Number(unwrap(approve.body)?.updated_count) === 0,
      'skipped row was unexpectedly bulk-approved'
    );
    await deleteBatch(batchId);
    return {
      conflict_status: updatedConflict.status,
      pending_variant_status: pendingVariant.status,
      bulk_approved: 0
    };
  });

  await runCase('IMPORT-PREVIEW-TRACE', 'Preview intake is side-effect limited and records uploader trace', async () => {
    const fixture = writeFixture(
      'primary-invalid-price.csv',
      primaryCsv('not-a-price')
    );
    const response = await intake(fixture, {
      batch_name: `QA primary import ${RUN_ID}`,
      notes: 'Preview must not create staging rows.'
    });
    assertOk(response);
    const data = unwrap(response.body);
    context.batchId = readBatchId(data);
    context.sourceFileId = String(data?.source_file?.id || '');
    assert(context.batchId && context.sourceFileId, 'preview identifiers are missing');
    await assertEmptyStaging(context.batchId);

    const [batch, file] = await Promise.all([
      db('import_batch').where({ id: context.batchId }).first('*'),
      db('file_metadata').where({ id: context.sourceFileId }).first('*')
    ]);
    assert(Number(batch?.uploaded_by) === context.logicUserId, 'batch uploaded_by mismatch');
    assert(Number(file?.uploaded_by) === context.logicUserId, 'file uploaded_by mismatch');
    assert(batch?.status === 'created', `preview batch status=${batch?.status}`);
    return {
      batch_id: context.batchId,
      source_file_id: context.sourceFileId,
      uploaded_by: batch.uploaded_by,
      staging_rows: 0
    };
  });

  await runCase('IMPORT-STAGING-CONFLICT', 'Confirmed mapping creates traceable staging and one invalid-price conflict', async () => {
    const confirmed = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/confirm-mapping`,
      { method: 'POST', body: mapping }
    );
    assertOk(confirmed);
    const stats = await batchStats(context.batchId);
    assert(stats.raw === 1, `raw_data count=${stats.raw}`);
    assert(stats.groups === 1, `pending group count=${stats.groups}`);
    assert(stats.variants === 1, `pending variant count=${stats.variants}`);
    assert(stats.conflicts === 1, `conflict count=${stats.conflicts}`);

    const conflicts = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/conflicts?status=open&page=1&page_size=100`
    );
    assertOk(conflicts);
    const conflictItems = extractItems(unwrap(conflicts.body));
    const conflict = conflictItems.find(
      (item) => item.conflict_type === 'invalid_public_price'
    );
    assert(conflict, 'invalid_public_price conflict is missing');
    context.conflictId = conflict.id;

    const groups = await db('pending_product_group')
      .where({ import_batch_id: context.batchId })
      .select('*');
    const variants = await db('pending_variant')
      .where({ import_batch_id: context.batchId })
      .select('*');
    context.pendingGroupId = groups[0]?.id || '';
    context.pendingVariantId = variants[0]?.id || '';
    assert(variants[0]?.conflict_id === context.conflictId, 'pending conflict link mismatch');
    return { ...stats, conflict_id: context.conflictId };
  });

  await runCase('IMPORT-READINESS-ROLLBACK', 'Premature ready transition is rejected without changing batch status', async () => {
    const response = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/review-transition`,
      { method: 'POST', body: { target_status: 'ready_to_apply' } }
    );
    assertError(response, 409, 'IMPORT_NOT_READY');
    const batch = await db('import_batch')
      .where({ id: context.batchId })
      .first('status');
    assert(batch?.status === 'in_review', `batch status leaked as ${batch?.status}`);
    return {
      rejected_status: response.status,
      persisted_batch_status: batch.status
    };
  });

  await runCase('IMPORT-CONFLICT-RESOLUTION', 'Invalid price accepts only safe resolution and records resolver identity exactly once', async () => {
    const unsafe = await adminRequest(
      `/song-thanh/import-conflicts/${context.conflictId}/resolve`,
      { method: 'POST', body: { decision: 'overwrite' } }
    );
    assertError(unsafe, 409, 'IMPORT_UNSAFE_PRICE_RESOLUTION');

    const resolutionBody = {
      decision: 'manual_edit',
      note: 'QA corrected price',
      resolution_payload: {
        public_price_mode: 'public_price',
        public_price_amount: 123450
      }
    };
    const resolutionResponses = await Promise.all([
      adminRequest(`/song-thanh/import-conflicts/${context.conflictId}/resolve`, {
        method: 'POST',
        body: resolutionBody
      }),
      adminRequest(`/song-thanh/import-conflicts/${context.conflictId}/resolve`, {
        method: 'POST',
        body: resolutionBody
      })
    ]);
    assert(
      resolutionResponses.filter((response) => response.status === 200).length === 1,
      `concurrent resolution statuses=${resolutionResponses.map(
        (response) => response.status
      )}`
    );
    const duplicate = resolutionResponses.find(
      (response) => response.status !== 200
    );
    assertError(duplicate, 409, 'IMPORT_CONFLICT_ALREADY_RESOLVED');

    const resolution = await db('conflict_resolution')
      .where({ conflict_id: context.conflictId })
      .first('*');
    const pendingVariant = await db('pending_variant')
      .where({ id: context.pendingVariantId })
      .first('*');
    assert(Number(resolution?.resolved_by) === context.logicUserId, 'resolved_by mismatch');
    assert(pendingVariant?.public_price_mode === 'public_price', 'price mode was not corrected');
    assert(Number(pendingVariant?.public_price_amount) === 123450, 'price amount was not corrected');
    return {
      unsafe_status: unsafe.status,
      resolved_by: resolution.resolved_by,
      concurrent_resolution_statuses: resolutionResponses
        .map((response) => response.status)
        .sort()
    };
  });

  await runCase('IMPORT-APPROVAL-APPLY', 'Taxonomy, approvals, readiness, preview, and apply complete atomically', async () => {
    const bootstrap = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/taxonomy-baseline-bootstrap`,
      { method: 'POST', body: {} }
    );
    assertOk(bootstrap);
    const approveGroups = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/pending-product-groups/bulk-approve`,
      { method: 'POST', body: { target_status: 'in_review' } }
    );
    assertOk(approveGroups);
    const approveVariants = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/pending-variants/bulk-approve`,
      { method: 'POST', body: { target_status: 'in_review' } }
    );
    assertOk(approveVariants);
    const ready = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/review-transition`,
      { method: 'POST', body: { target_status: 'ready_to_apply' } }
    );
    if (!ready.ok) {
      const readiness = await adminRequest(
        `/song-thanh/import-batches/${context.batchId}/readiness`
      );
      throw new Error(
        `${responseError(ready)}; readiness=${JSON.stringify(
          unwrap(readiness.body)
        )}`
      );
    }

    const preview = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/apply-preview`
    );
    assertOk(preview);
    const previewData = unwrap(preview.body);
    assert(
      Number(previewData?.product_groups?.will_create) === 1,
      'apply preview did not plan one group create'
    );
    assert(
      Number(previewData?.product_variants?.will_create) === 1,
      'apply preview did not plan one variant create'
    );

    const applyResponses = await Promise.all([
      adminRequest(`/song-thanh/import-batches/${context.batchId}/apply`, {
        method: 'POST',
        body: {}
      }),
      adminRequest(`/song-thanh/import-batches/${context.batchId}/apply`, {
        method: 'POST',
        body: {}
      })
    ]);
    const applied = applyResponses.find((response) => response.status === 200);
    const rejectedApply = applyResponses.find(
      (response) => response.status !== 200
    );
    assert(applied, `no concurrent apply succeeded: ${applyResponses.map((response) => response.status)}`);
    assertError(rejectedApply, 409, 'IMPORT_NOT_READY');
    const batch = await db('import_batch')
      .where({ id: context.batchId })
      .first('*');
    assert(batch?.status === 'applied' && batch?.applied_at, 'batch was not applied');
    return {
      bootstrap: unwrap(bootstrap.body),
      planned: previewData,
      applied: unwrap(applied.body)?.result,
      concurrent_apply_statuses: applyResponses
        .map((response) => response.status)
        .sort()
    };
  });

  await runCase('IMPORT-ACTOR-INVARIANTS', 'Applied official rows and imported attributes retain the business actor', async () => {
    assert(context.officialGroupId || context.batchId, 'primary import context is missing');
    const appliedBatch = await db('import_batch')
      .where({ id: context.batchId })
      .first('status');
    assert(
      appliedBatch?.status === 'applied',
      `primary batch must be applied before actor checks; status=${appliedBatch?.status}`
    );
    const groupMapping = await db('import_mapping')
      .where({
        import_batch_id: context.batchId,
        entity_type: 'product_group',
        external_code: identifiers.groupCode
      })
      .first('*');
    const variantMapping = await db('import_mapping')
      .where({
        import_batch_id: context.batchId,
        entity_type: 'product_variant',
        external_code: identifiers.variantCode
      })
      .first('*');
    context.officialGroupId = String(groupMapping?.official_id || '');
    context.officialVariantId = String(variantMapping?.official_id || '');
    assert(context.officialGroupId && context.officialVariantId, 'official mappings are missing');

    const [group, variant, attributes, categories] = await Promise.all([
      db('product_group').where({ id: context.officialGroupId }).first('*'),
      db('product_variant').where({ id: context.officialVariantId }).first('*'),
      db('variant_attribute')
        .where({ product_variant_id: context.officialVariantId })
        .whereNull('deleted_at')
        .select('*'),
      db('product_category')
        .whereIn('name', [identifiers.mainCategory, identifiers.subCategory])
        .select('*')
    ]);
    assert(group?.review_status === 'approved', 'group review status mismatch');
    assert(group?.publish_status === 'unpublished', 'group was exposed publicly');
    assert(variant?.review_status === 'approved', 'variant review status mismatch');
    assert(variant?.publish_status === 'unpublished', 'variant was exposed publicly');
    for (const [label, value] of [
      ['group.created_by', group?.created_by],
      ['group.updated_by', group?.updated_by],
      ['group.approved_by', group?.approved_by],
      ['variant.created_by', variant?.created_by],
      ['variant.updated_by', variant?.updated_by]
    ]) {
      assert(Number(value) === context.logicUserId, `${label}=${value}`);
    }
    assert(categories.length === 2, `created taxonomy rows=${categories.length}`);
    assert(
      categories.every(
        (category) =>
          Number(category.created_by) === context.logicUserId &&
          Number(category.updated_by) === context.logicUserId
      ),
      'taxonomy actor trace mismatch'
    );
    const power = attributes.find((attribute) => attribute.attribute_name === 'Power');
    assert(power, 'imported Power attribute is missing');
    assert(Number(power.created_by) === context.logicUserId, 'attribute created_by mismatch');
    return {
      product_group_id: context.officialGroupId,
      product_variant_id: context.officialVariantId,
      actor_id: context.logicUserId,
      official_visibility: 'approved/unpublished',
      imported_attributes: attributes.length
    };
  });

  await runCase('IMPORT-TERMINAL-GUARDS', 'Applied batches reject re-apply/delete and archive/restore are idempotency guarded', async () => {
    const appliedBatch = await db('import_batch')
      .where({ id: context.batchId })
      .first('status');
    assert(
      appliedBatch?.status === 'applied',
      `primary batch must be applied before terminal checks; status=${appliedBatch?.status}`
    );
    const reapply = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/apply`,
      { method: 'POST', body: {} }
    );
    assertError(reapply, 409, 'IMPORT_NOT_READY');
    const hardDelete = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}`,
      { method: 'DELETE' }
    );
    assertError(hardDelete, 409, 'IMPORT_DELETE_FORBIDDEN_APPLIED');
    const archive = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/archive`,
      { method: 'POST', body: {} }
    );
    assertOk(archive);
    const duplicateArchive = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/archive`,
      { method: 'POST', body: {} }
    );
    assertError(duplicateArchive, 409, 'IMPORT_BATCH_ALREADY_ARCHIVED');
    const restore = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/restore`,
      { method: 'POST', body: {} }
    );
    assertOk(restore);
    const duplicateRestore = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/restore`,
      { method: 'POST', body: {} }
    );
    assertError(duplicateRestore, 409, 'IMPORT_BATCH_NOT_ARCHIVED');
    const finalArchive = await adminRequest(
      `/song-thanh/import-batches/${context.batchId}/archive`,
      { method: 'POST', body: {} }
    );
    assertOk(finalArchive);
    return {
      reapply: reapply.status,
      hard_delete: hardDelete.status,
      duplicate_archive: duplicateArchive.status,
      duplicate_restore: duplicateRestore.status,
      final_state: 'archived'
    };
  });

  await runCase('IMPORT-DETERMINISTIC-REIMPORT', 'Re-import updates mapped official rows and clears stale public price for quote mode', async () => {
    assert(
      context.officialGroupId && context.officialVariantId,
      'primary official identities are required before re-import'
    );
    const fixture = writeFixture(
      'reimport-contact-for-quote.csv',
      primaryCsv('')
    );
    const intakeResponse = await intake(fixture, {
      batch_name: `QA reimport ${RUN_ID}`
    });
    assertOk(intakeResponse);
    context.secondBatchId = readBatchId(unwrap(intakeResponse.body));
    const confirmed = await adminRequest(
      `/song-thanh/import-batches/${context.secondBatchId}/confirm-mapping`,
      { method: 'POST', body: mapping }
    );
    assertOk(confirmed);
    const stats = await batchStats(context.secondBatchId);
    assert(stats.conflicts === 0, `reimport conflict count=${stats.conflicts}`);

    for (const [endpoint, body] of [
      ['taxonomy-baseline-bootstrap', {}],
      ['pending-product-groups/bulk-approve', { target_status: 'in_review' }],
      ['pending-variants/bulk-approve', { target_status: 'in_review' }],
      ['review-transition', { target_status: 'ready_to_apply' }],
      ['apply', {}]
    ]) {
      const response = await adminRequest(
        `/song-thanh/import-batches/${context.secondBatchId}/${endpoint}`,
        { method: 'POST', body }
      );
      if (!response.ok) {
        const readiness = await adminRequest(
          `/song-thanh/import-batches/${context.secondBatchId}/readiness`
        );
        throw new Error(
          `${endpoint}: ${responseError(response)}; readiness=${JSON.stringify(
            unwrap(readiness.body)
          )}`
        );
      }
    }

    const groupMapping = await db('import_mapping')
      .where({
        import_batch_id: context.secondBatchId,
        entity_type: 'product_group',
        external_code: identifiers.groupCode
      })
      .first('*');
    const variantMapping = await db('import_mapping')
      .where({
        import_batch_id: context.secondBatchId,
        entity_type: 'product_variant',
        external_code: identifiers.variantCode
      })
      .first('*');
    assert(groupMapping?.decision === 'updated_existing', 'group was not updated');
    assert(variantMapping?.decision === 'updated_existing', 'variant was not updated');
    assert(
      String(groupMapping?.official_id) === context.officialGroupId,
      'reimport changed official group identity'
    );
    assert(
      String(variantMapping?.official_id) === context.officialVariantId,
      'reimport changed official variant identity'
    );
    const variant = await db('product_variant')
      .where({ id: context.officialVariantId })
      .first('*');
    assert(
      variant?.public_price_mode === 'contact_for_quote',
      `public_price_mode=${variant?.public_price_mode}`
    );
    assert(
      variant?.public_price_amount === null,
      `stale public_price_amount=${variant?.public_price_amount}`
    );
    assert(Number(variant?.updated_by) === context.logicUserId, 'updated_by mismatch');

    const archive = await adminRequest(
      `/song-thanh/import-batches/${context.secondBatchId}/archive`,
      { method: 'POST', body: {} }
    );
    assertOk(archive);
    return {
      group_decision: groupMapping.decision,
      variant_decision: variantMapping.decision,
      public_price_mode: variant.public_price_mode,
      public_price_amount: variant.public_price_amount,
      batch_archived: true
    };
  });
} finally {
  await db.destroy();
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  rmSync(OUTSIDE_ROOT, { recursive: true, force: true });
  finish();
}

function primaryCsv(price) {
  return [
    [
      'Main Category',
      'Sub Category',
      'Product Group',
      'Variant',
      'Group Code',
      'Variant Code',
      'SKU',
      'Model Code',
      'Price',
      'Power'
    ].join(','),
    [
      identifiers.mainCategory,
      identifiers.subCategory,
      identifiers.groupName,
      identifiers.variantName,
      identifiers.groupCode,
      identifiers.variantCode,
      identifiers.sku,
      identifiers.modelCode,
      price,
      '10W'
    ].join(',')
  ].join('\n');
}

function writeFixture(filename, contents) {
  const target = path.join(FIXTURE_ROOT, filename);
  writeFileSync(target, contents, 'utf8');
  return target;
}

function intake(sourceWorkbookPath, extraBody = {}) {
  return adminRequest('/song-thanh/import-batches/intake', {
    method: 'POST',
    body: {
      source_workbook_path: sourceWorkbookPath,
      ...extraBody
    }
  });
}

async function deleteBatch(batchId) {
  const response = await adminRequest(`/song-thanh/import-batches/${batchId}`, {
    method: 'DELETE'
  });
  assertOk(response);
}

async function assertEmptyStaging(batchId) {
  const stats = await batchStats(batchId);
  assert(
    stats.raw === 0 &&
      stats.groups === 0 &&
      stats.variants === 0 &&
      stats.conflicts === 0,
    `expected empty staging, received ${JSON.stringify(stats)}`
  );
}

async function batchStats(batchId) {
  const [raw, groups, variants, conflicts] = await Promise.all([
    countRows('raw_data', batchId),
    countRows('pending_product_group', batchId),
    countRows('pending_variant', batchId),
    countRows('data_conflict', batchId)
  ]);
  return { raw, groups, variants, conflicts };
}

async function countRows(table, batchId) {
  const row = await db(table)
    .where({ import_batch_id: batchId })
    .count({ count: '*' })
    .first();
  return Number(row?.count || 0);
}

async function runCase(id, title, action) {
  const started = Date.now();
  try {
    const evidence = await withTimeout(
      Promise.resolve().then(action),
      Number(process.env.IMPORT_QA_CASE_TIMEOUT_MS || 60000),
      `${id} timed out`
    );
    results.push({
      id,
      title,
      status: 'PASS',
      duration_ms: Date.now() - started,
      evidence
    });
  } catch (error) {
    results.push({
      id,
      title,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
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
    body:
      typeof options.body === 'undefined'
        ? undefined
        : JSON.stringify(options.body)
  });
  return parseResponse(response);
}

function adminRequest(pathname, options = {}) {
  return request(pathname, {
    ...options,
    headers: {
      Authorization: `Bearer ${context.accessToken}`,
      ...(options.headers || {})
    }
  });
}

async function adminMultipart(pathname, body) {
  const response = await fetch(`${API_BASE_URL}${pathname}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${context.accessToken}`,
      'X-Forwarded-For': QA_CLIENT_IP
    },
    body
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}

function unwrap(body) {
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

function extractItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function readBatchId(data) {
  const id = data?.batch?.id || data?.batch_id || data?.id || '';
  assert(id, 'response did not include batch id');
  return String(id);
}

function errorObject(response) {
  return response?.body?.error ?? unwrap(response?.body)?.error ?? null;
}

function errorCode(response) {
  return errorObject(response)?.code ?? null;
}

function assertError(response, expectedStatus, expectedCode) {
  assert(
    response.status === expectedStatus,
    `expected ${expectedStatus}/${expectedCode}, received ${response.status}/${errorCode(
      response
    )}: ${responseError(response)}`
  );
  assert(
    errorCode(response) === expectedCode,
    `expected error ${expectedCode}, received ${errorCode(response)}`
  );
}

function assertOk(response) {
  assert(response?.ok, responseError(response));
}

function responseError(response) {
  const error = errorObject(response);
  return `${response?.status}: ${error?.code || 'REQUEST_FAILED'} - ${
    error?.message || JSON.stringify(response?.body)
  }`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSafeTarget() {
  const hostname = new URL(API_BASE_URL).hostname;
  assert(
    ['localhost', '127.0.0.1', '::1'].includes(hostname),
    `refusing non-local API target ${API_BASE_URL}`
  );
  const databaseName = String(process.env.DATABASE_NAME || '');
  assert(
    /^[A-Za-z0-9_]+_qa_[0-9]{14}$/.test(databaseName),
    `refusing mutation because DATABASE_NAME is not an isolated timestamped QA database: ${
      databaseName || '(unset)'
    }`
  );
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function finish() {
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const failed = results.filter((result) => result.status === 'FAIL');
  const lines = [
    '# Import-domain invariant QA last run',
    '',
    `Run id: \`${RUN_ID}\``,
    `Date: \`${new Date().toISOString()}\``,
    `Target: \`${API_BASE_URL}\``,
    `Database: \`${process.env.DATABASE_NAME}\``,
    '',
    '| Case | Result | Duration | Evidence |',
    '| --- | --- | ---: | --- |'
  ];
  for (const result of results) {
    lines.push(
      `| ${result.id} — ${escapeTable(result.title)} | ${result.status} | ${
        result.duration_ms
      }ms | ${escapeTable(
        result.status === 'PASS' ? compact(result.evidence) : result.error
      )} |`
    );
  }
  lines.push(
    '',
    `Result: **${results.length - failed.length}/${results.length} passed; ${failed.length} failed.**`,
    '',
    'Data impact: this matrix mutates only a timestamped isolated QA database. Applied QA batches are archived and all imported official entities remain unpublished.',
    '',
    'Generated by `node scripts/qa/import-domain-invariants-smoke.mjs`.'
  );
  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');

  console.log(`\nImport-domain invariant QA run ${RUN_ID}`);
  for (const result of results) {
    console.log(
      `${result.status} ${result.id} ${result.title} (${result.duration_ms} ms)${
        result.error ? ` - ${result.error}` : ''
      }`
    );
  }
  console.log(`Report: ${REPORT_PATH}`);
  console.log(
    `Summary: ${results.length - failed.length}/${results.length} passed, ${failed.length} failed`
  );
  if (failed.length > 0) process.exitCode = 1;
}

function compact(value) {
  if (!value) return '';
  const text = JSON.stringify(value);
  return text.length > 420 ? `${text.slice(0, 417)}...` : text;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
