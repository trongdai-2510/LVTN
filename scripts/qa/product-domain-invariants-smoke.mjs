import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
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
const QA_CLIENT_IP = '203.0.113.40';
const RUN_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const REPORT_PATH = path.join(
  ROOT,
  'tmp',
  'qa-artifacts',
  'product-domain-invariants-qa-last-run.md'
);
const MAX_PUBLIC_PRICE = 2_147_483_647;
const MAX_SMALLINT = 32_767;
const requireFromApi = createRequire(path.join(ROOT, 'api', 'package.json'));
const { Client: PostgresClient } = requireFromApi('pg');

const results = [];
const context = {
  accessToken: '',
  imageFileId: '',
  nonImageFileId: '',
  level1Id: '',
  level2Id: '',
  otherLevel1Id: '',
  brandId: '',
  groupId: '',
  groupSlug: '',
  draftGroupId: '',
  variantId: '',
  technicalDocumentId: '',
  extraGroupIds: []
};

assertSafeTarget();

await runCase('PROD-ENV', 'The API and isolated QA database are safe to mutate', async () => {
  const health = await request('/health');
  assert(health.status === 200, `health returned ${health.status}`);
  return { database: process.env.DATABASE_NAME, target: API_BASE_URL };
});

await runCase('PROD-AUTH', 'Super-admin can authenticate for invariant tests', async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  assert(login.ok, responseError(login));
  const session = unwrap(login.body);
  context.accessToken = String(session?.access_token || '');
  assert(context.accessToken, 'login response did not include access_token');
  return { user_id: session?.user?.id ?? null };
});

await runCase('PROD-FILE-FIXTURES', 'Active image and non-image metadata fixtures are distinct', async () => {
  requireContext('accessToken');
  const image = await adminRequest('/song-thanh/files', {
    method: 'POST',
    body: {
      original_filename: `qa-product-${RUN_ID}.png`,
      stored_path: `qa/product-invariants/${RUN_ID}.png`,
      file_size: 128,
      mime_type: 'image/png',
      storage_location: 'r2',
      purpose: 'product_image'
    }
  });
  assert(image.ok, responseError(image));
  context.imageFileId = String(record(image.body, 'file')?.id || '');

  const document = await adminRequest('/song-thanh/files', {
    method: 'POST',
    body: {
      original_filename: `qa-product-${RUN_ID}.pdf`,
      stored_path: `qa/product-invariants/${RUN_ID}.pdf`,
      file_size: 256,
      mime_type: 'application/pdf',
      storage_location: 'r2',
      purpose: 'technical_document'
    }
  });
  assert(document.ok, responseError(document));
  context.nonImageFileId = String(record(document.body, 'file')?.id || '');
  assert(context.imageFileId && context.nonImageFileId, 'file fixture ids are missing');
  return { image_file_id: context.imageFileId, non_image_file_id: context.nonImageFileId };
});

await runCase('PROD-CATEGORY-SLUG', 'Vietnamese Đ/đ is normalized in an automatic category slug', async () => {
  const response = await createCategory({
    name: `Điện Động Cơ QA ${RUN_ID}`,
    status: 'active'
  });
  assert(response.ok, responseError(response));
  const category = record(response.body, 'category');
  context.level1Id = String(category?.id || '');
  assert(context.level1Id, 'level-1 category id is missing');
  assert(
    String(category.slug).startsWith('dien-dong-co-qa-'),
    `unexpected normalized slug ${category.slug}`
  );
  return { id: category.id, slug: category.slug };
});

await runCase('PROD-CATEGORY-LEVEL-2', 'An active level-1 category accepts one level-2 child', async () => {
  requireContext('level1Id');
  const response = await createCategory({
    name: `Thiết Bị Con QA ${RUN_ID}`,
    parent_id: context.level1Id,
    status: 'active'
  });
  assert(response.ok, responseError(response));
  const category = record(response.body, 'category');
  context.level2Id = String(category?.id || '');
  assert(category?.parent_id === context.level1Id, 'level-2 parent_id was not retained');
  return { id: category.id, parent_id: category.parent_id };
});

await runCase('PROD-CATEGORY-DEPTH', 'A third category level is rejected', async () => {
  requireContext('level2Id');
  const response = await createCategory({
    name: `Cấp Ba Bị Chặn ${RUN_ID}`,
    parent_id: context.level2Id
  });
  assertError(response, 409, 'PRODUCT_CATEGORY_PARENT_LEVEL_INVALID');
  return errorEvidence(response);
});

await runCase('PROD-CATEGORY-SELF-PARENT', 'A category cannot become its own parent', async () => {
  requireContext('level1Id');
  const response = await adminRequest(`/song-thanh/product-categories/${context.level1Id}`, {
    method: 'PUT',
    body: { parent_id: context.level1Id }
  });
  assertError(response, 409, 'PRODUCT_CATEGORY_CONFLICT');
  return errorEvidence(response);
});

await runCase('PROD-CATEGORY-MOVE-WITH-CHILD', 'A level-1 category with a child cannot be moved to level 2', async () => {
  const other = await createCategory({
    name: `Danh Mục Gốc Khác ${RUN_ID}`,
    status: 'active'
  });
  assert(other.ok, responseError(other));
  context.otherLevel1Id = String(record(other.body, 'category')?.id || '');
  const response = await adminRequest(`/song-thanh/product-categories/${context.level1Id}`, {
    method: 'PUT',
    body: { parent_id: context.otherLevel1Id }
  });
  assertError(response, 409, 'PRODUCT_CATEGORY_LEVEL_LIMIT_EXCEEDED');
  return errorEvidence(response);
});

await runCase('PROD-CATEGORY-INACTIVE-PARENT', 'An inactive parent cannot accept a child', async () => {
  const inactive = await createCategory({
    name: `Danh Mục Tắt ${RUN_ID}`,
    status: 'inactive'
  });
  assert(inactive.ok, responseError(inactive));
  const inactiveId = record(inactive.body, 'category')?.id;
  const response = await createCategory({
    name: `Con Của Danh Mục Tắt ${RUN_ID}`,
    parent_id: inactiveId
  });
  assert(response.status === 404, `expected 404, received ${response.status}`);
  return errorEvidence(response);
});

await runCase('PROD-CATEGORY-ARCHIVE-CHILD-GUARD', 'A parent category with an active child cannot be archived', async () => {
  requireContext('level1Id');
  const response = await adminRequest(
    `/song-thanh/product-categories/${context.level1Id}/archive`,
    { method: 'POST', body: {} }
  );
  assertError(response, 409, 'PRODUCT_CATEGORY_ARCHIVE_BLOCKED');
  const details = errorDetails(response);
  assert(
    Number(details?.active_child_categories || 0) > 0,
    'archive error did not report active_child_categories'
  );
  return errorEvidence(response);
});

await runCase('PROD-BRAND-LEVEL', 'Brand primary_category_id accepts only a level-1 category', async () => {
  requireContext('level1Id');
  requireContext('level2Id');
  const invalid = await createBrand({
    name: `Thương Hiệu Sai Cấp ${RUN_ID}`,
    primary_category_id: context.level2Id
  });
  assertError(invalid, 409, 'BRAND_PRIMARY_CATEGORY_LEVEL_INVALID');

  const valid = await createBrand({
    name: `Thương Hiệu QA ${RUN_ID}`,
    primary_category_id: context.level1Id,
    status: 'active'
  });
  assert(valid.ok, responseError(valid));
  const brand = record(valid.body, 'brand');
  context.brandId = String(brand?.id || '');
  assert(context.brandId, 'brand id is missing');
  return { rejected_code: errorCode(invalid), brand_id: context.brandId };
});

await runCase('PROD-GROUP-CATEGORY-LEVEL', 'Product groups reject a level-1 category and accept level 2', async () => {
  const invalid = await createGroup({
    name: `Nhóm Sai Cấp ${RUN_ID}`,
    category_id: context.level1Id
  });
  assertError(invalid, 409, 'PRODUCT_GROUP_CATEGORY_LEVEL_INVALID');

  const valid = await createGroup({
    name: `Nhóm Sản Phẩm QA ${RUN_ID}`,
    category_id: context.level2Id,
    brand_id: context.brandId,
    status: 'active'
  });
  assert(valid.ok, responseError(valid));
  const group = record(valid.body, 'product_group');
  context.groupId = String(group?.id || '');
  context.groupSlug = String(group?.slug || '');
  assert(context.groupId && context.groupSlug, 'product group identity is missing');
  return { rejected_code: errorCode(invalid), group_id: context.groupId };
});

await runCase('PROD-GROUP-PUBLISH-THUMBNAIL', 'Publishing without a thumbnail is rejected first', async () => {
  const response = await updateGroup(context.groupId, {
    review_status: 'approved',
    publish_status: 'published',
    short_description: 'Mô tả ngắn hợp lệ.'
  });
  assertError(response, 409, 'PRODUCT_GROUP_PUBLISH_REQUIRES_THUMBNAIL');
  return errorEvidence(response);
});

await runCase('PROD-GROUP-PUBLISH-DESCRIPTION', 'Publishing without a short description is rejected', async () => {
  const prepare = await updateGroup(context.groupId, {
    thumbnail_file_id: context.imageFileId,
    short_description: null,
    review_status: 'draft',
    publish_status: 'unpublished'
  });
  assert(prepare.ok, responseError(prepare));
  const response = await updateGroup(context.groupId, {
    review_status: 'approved',
    publish_status: 'published'
  });
  assertError(response, 409, 'PRODUCT_GROUP_PUBLISH_REQUIRES_SHORT_DESCRIPTION');
  return errorEvidence(response);
});

await runCase('PROD-GROUP-PUBLISH-REVIEW', 'Publishing without approved review is rejected', async () => {
  const prepare = await updateGroup(context.groupId, {
    short_description: 'Mô tả ngắn hợp lệ.',
    review_status: 'draft',
    publish_status: 'unpublished'
  });
  assert(prepare.ok, responseError(prepare));
  const response = await updateGroup(context.groupId, {
    publish_status: 'published'
  });
  assertError(response, 409, 'PRODUCT_GROUP_PUBLISH_REQUIRES_APPROVED_REVIEW');
  return errorEvidence(response);
});

await runCase('PROD-GROUP-PUBLISH-SUCCESS', 'A complete approved active group can be published', async () => {
  const response = await updateGroup(context.groupId, {
    review_status: 'approved',
    publish_status: 'published'
  });
  assert(response.ok, responseError(response));
  const group = record(response.body, 'product_group');
  assert(group?.review_status === 'approved', 'review_status is not approved');
  assert(group?.publish_status === 'published', 'publish_status is not published');
  const publicResponse = await request(
    `/public/product-groups/${encodeURIComponent(context.groupSlug)}`
  );
  assert(publicResponse.ok, responseError(publicResponse));
  return { id: group.id, public_status: publicResponse.status };
});

await runCase('PROD-GROUP-CREATE-CATEGORY-RACE', 'Product-group creation re-checks its category after a concurrent deactivation', async () => {
  const groupName = `Group category race ${RUN_ID}`;
  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  let createPromise;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM product_category WHERE id = $1 FOR UPDATE', [context.level2Id]);
    await client.query("UPDATE product_category SET status = 'inactive' WHERE id = $1", [context.level2Id]);

    let settled = false;
    createPromise = createGroup({
      name: groupName,
      category_id: context.level2Id,
      brand_id: context.brandId,
      status: 'active'
    }).then((response) => {
      settled = true;
      return response;
    });
    await delay(350);
    assert(!settled, 'product-group creation did not wait on the held category lock');

    await client.query('COMMIT');
    committed = true;
    const response = await createPromise;
    assertError(response, 404, 'NOT_FOUND');
    const persisted = await client.query(
      'SELECT COUNT(*)::int AS total FROM product_group WHERE name = $1 AND deleted_at IS NULL',
      [groupName]
    );
    assert(Number(persisted.rows[0]?.total || 0) === 0, 'rejected group creation was persisted');

    await client.query("UPDATE product_category SET status = 'active' WHERE id = $1", [context.level2Id]);
    return { code: errorCode(response), persisted_group_count: 0 };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    if (createPromise) await createPromise.catch(() => undefined);
    await client.query("UPDATE product_category SET status = 'active' WHERE id = $1", [context.level2Id]).catch(() => undefined);
    await client.end();
  }
});

await runCase('PROD-GROUP-UPDATE-CATEGORY-RACE', 'Product-group update cannot commit against a category deactivated while validation is in flight', async () => {
  const before = await adminRequest(`/song-thanh/product-groups/${context.groupId}`);
  assert(before.ok, responseError(before));
  const originalSeoTitle = record(before.body, 'product_group')?.seo_title ?? null;
  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  let updatePromise;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM product_category WHERE id = $1 FOR UPDATE', [context.level2Id]);
    await client.query("UPDATE product_category SET status = 'inactive' WHERE id = $1", [context.level2Id]);

    let settled = false;
    updatePromise = updateGroup(context.groupId, {
      seo_title: `Must not persist ${RUN_ID}`
    }).then((response) => {
      settled = true;
      return response;
    });
    await delay(350);
    assert(!settled, 'product-group update did not wait on the held category lock');

    await client.query('COMMIT');
    committed = true;
    const response = await updatePromise;
    assertError(response, 404, 'NOT_FOUND');
    const after = await adminRequest(`/song-thanh/product-groups/${context.groupId}`);
    assert(after.ok, responseError(after));
    assert(
      (record(after.body, 'product_group')?.seo_title ?? null) === originalSeoTitle,
      'rejected group update changed seo_title'
    );

    await client.query("UPDATE product_category SET status = 'active' WHERE id = $1", [context.level2Id]);
    return { code: errorCode(response), rejected_value_retained: true };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    if (updatePromise) await updatePromise.catch(() => undefined);
    await client.query("UPDATE product_category SET status = 'active' WHERE id = $1", [context.level2Id]).catch(() => undefined);
    await client.end();
  }
});

await runCase('PROD-GROUP-RESTORE-BRAND-RACE', 'Product-group restore re-checks its brand after a concurrent deactivation', async () => {
  const created = await createGroup({
    name: `Restore brand race ${RUN_ID}`,
    category_id: context.level2Id,
    brand_id: context.brandId,
    status: 'active'
  });
  assert(created.ok, responseError(created));
  const groupId = String(record(created.body, 'product_group')?.id || '');
  assert(groupId, 'restore-race group id is missing');
  const archive = await adminRequest(`/song-thanh/product-groups/${groupId}/archive`, {
    method: 'POST',
    body: {}
  });
  assert(archive.ok, responseError(archive));

  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  let restorePromise;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM brand WHERE id = $1 FOR UPDATE', [context.brandId]);
    await client.query("UPDATE brand SET status = 'inactive' WHERE id = $1", [context.brandId]);

    let settled = false;
    restorePromise = adminRequest(`/song-thanh/product-groups/${groupId}/restore`, {
      method: 'POST',
      body: {}
    }).then((response) => {
      settled = true;
      return response;
    });
    await delay(350);
    assert(!settled, 'product-group restore did not wait on the held brand lock');

    await client.query('COMMIT');
    committed = true;
    const response = await restorePromise;
    assertError(response, 404, 'NOT_FOUND');
    const persisted = await client.query(
      'SELECT deleted_at FROM product_group WHERE id = $1',
      [groupId]
    );
    assert(persisted.rows[0]?.deleted_at, 'rejected restore cleared deleted_at');

    await client.query("UPDATE brand SET status = 'active' WHERE id = $1", [context.brandId]);
    const successfulRestore = await adminRequest(`/song-thanh/product-groups/${groupId}/restore`, {
      method: 'POST',
      body: {}
    });
    assert(successfulRestore.ok, responseError(successfulRestore));
    return { code: errorCode(response), archived_state_retained: true };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    if (restorePromise) await restorePromise.catch(() => undefined);
    await client.query("UPDATE brand SET status = 'active' WHERE id = $1", [context.brandId]).catch(() => undefined);
    await client.end();
  }
});

for (const [id, title, body, expectedCode] of [
  [
    'PROD-GROUP-INVARIANT-STATUS',
    'A published group cannot be made inactive while still published',
    { status: 'inactive' },
    'PRODUCT_GROUP_PUBLISH_REQUIRES_ACTIVE_STATUS'
  ],
  [
    'PROD-GROUP-INVARIANT-REVIEW',
    'A published group cannot be downgraded from approved review',
    { review_status: 'draft' },
    'PRODUCT_GROUP_PUBLISH_REQUIRES_APPROVED_REVIEW'
  ],
  [
    'PROD-GROUP-INVARIANT-THUMBNAIL',
    'A published group cannot lose its thumbnail',
    { thumbnail_file_id: null },
    'PRODUCT_GROUP_PUBLISH_REQUIRES_THUMBNAIL'
  ],
  [
    'PROD-GROUP-INVARIANT-DESCRIPTION',
    'A published group cannot lose its short description',
    { short_description: null },
    'PRODUCT_GROUP_PUBLISH_REQUIRES_SHORT_DESCRIPTION'
  ]
]) {
  await runCase(id, title, async () => {
    const response = await updateGroup(context.groupId, body);
    assertError(response, 409, expectedCode);
    return errorEvidence(response);
  });
}

await runCase('PROD-GROUP-STORAGE-BOUNDS', 'Product-group varchar and smallint boundaries fail as validation errors, not database errors', async () => {
  const acceptedText = await updateGroup(context.groupId, { seo_title: 'S'.repeat(255) });
  assert(acceptedText.ok, responseError(acceptedText));

  const overlongText = await updateGroup(context.groupId, { seo_title: 'S'.repeat(256) });
  assert(overlongText.status === 400, `256-character SEO title expected 400, received ${overlongText.status}`);

  const negativeOrder = await updateGroup(context.groupId, { sort_order: -1 });
  assert(negativeOrder.status === 400, `negative sort_order expected 400, received ${negativeOrder.status}`);

  const overflowOrder = await updateGroup(context.groupId, { sort_order: MAX_SMALLINT + 1 });
  assert(overflowOrder.status === 400, `smallint overflow expected 400, received ${overflowOrder.status}`);

  const maximumOrder = await updateGroup(context.groupId, { sort_order: MAX_SMALLINT });
  assert(maximumOrder.ok, responseError(maximumOrder));
  const reset = await updateGroup(context.groupId, { seo_title: null, sort_order: 0 });
  assert(reset.ok, responseError(reset));

  return {
    seo_title_max: 255,
    overlong_status: overlongText.status,
    negative_status: negativeOrder.status,
    overflow_status: overflowOrder.status,
    accepted_sort_order: MAX_SMALLINT
  };
});

await runCase('PROD-GROUP-STALE-WRITE', 'A stale product-group editor cannot overwrite a newer saved value', async () => {
  const before = await adminRequest(`/song-thanh/product-groups/${context.groupId}`);
  assert(before.ok, responseError(before));
  const original = record(before.body, 'product_group');
  const expectedUpdatedAt = String(original.updated_at || '');
  assert(expectedUpdatedAt, 'product-group updated_at is missing');

  const winnerValue = `Phiên mới thắng ${RUN_ID}`;
  const winner = await updateGroup(context.groupId, {
    seo_description: winnerValue,
    expected_updated_at: expectedUpdatedAt
  });
  assert(winner.ok, responseError(winner));

  const stale = await updateGroup(context.groupId, {
    seo_description: `Phiên cũ không được ghi ${RUN_ID}`,
    expected_updated_at: expectedUpdatedAt
  });
  assertError(stale, 409, 'PRODUCT_GROUP_VERSION_CONFLICT');

  const after = await adminRequest(`/song-thanh/product-groups/${context.groupId}`);
  assert(after.ok, responseError(after));
  const retained = record(after.body, 'product_group');
  assert(retained.seo_description === winnerValue, 'stale group write replaced the winner value');
  return {
    code: errorCode(stale),
    winner_retained: retained.seo_description === winnerValue
  };
});

await runCase('PROD-GROUP-ARCHIVE-RACE', 'Archiving a locked parent rejects child records that passed an earlier service check', async () => {
  const createdGroup = await createGroup({
    name: `Nhóm Race Cha Con ${RUN_ID}`,
    category_id: context.level2Id,
    brand_id: context.brandId,
    status: 'active'
  });
  assert(createdGroup.ok, responseError(createdGroup));
  const raceGroupId = String(record(createdGroup.body, 'product_group')?.id || '');
  assert(raceGroupId, 'race product group id is missing');

  const [servicesResponse, projectsResponse] = await Promise.all([
    adminRequest('/song-thanh/services?page=1&page_size=1&deleted_scope=active'),
    adminRequest('/song-thanh/projects?page=1&page_size=1&deleted_scope=active')
  ]);
  assert(servicesResponse.ok, responseError(servicesResponse));
  assert(projectsResponse.ok, responseError(projectsResponse));
  const serviceId = String(extractItems(unwrap(servicesResponse.body))[0]?.id || '');
  const projectId = String(extractItems(unwrap(projectsResponse.body))[0]?.id || '');
  assert(serviceId && projectId, 'service/project fixtures are required for relation race coverage');

  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM product_group WHERE id = $1 FOR UPDATE', [raceGroupId]);

    let settled = 0;
    const track = (promise) => promise.then((response) => {
      settled += 1;
      return response;
    });
    const pending = [
      track(createVariant({
        product_group_id: raceGroupId,
        variant_name: `Biến thể đua ${RUN_ID}`
      })),
      track(adminRequest('/song-thanh/technical-documents', {
        method: 'POST',
        body: {
          product_group_id: raceGroupId,
          document_name: `Tài liệu đua ${RUN_ID}`,
          file_id: context.nonImageFileId
        }
      })),
      track(adminRequest(`/song-thanh/product-groups/${raceGroupId}/images`, {
        method: 'PUT',
        body: { images: [{ file_id: context.imageFileId, alt_text: 'Ảnh đua' }] }
      })),
      track(adminRequest(`/song-thanh/services/${serviceId}/product-groups`, {
        method: 'POST',
        body: { product_group_id: raceGroupId }
      })),
      track(adminRequest(`/song-thanh/projects/${projectId}/product-groups`, {
        method: 'POST',
        body: { product_group_id: raceGroupId }
      }))
    ];

    await delay(350);
    assert(settled === 0, `${settled} child mutations bypassed the held product-group lock`);
    await client.query(
      'UPDATE product_group SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [raceGroupId]
    );
    await client.query('COMMIT');
    committed = true;

    const responses = await Promise.all(pending);
    for (const response of responses) {
      assertError(response, 404, 'NOT_FOUND');
    }

    const counts = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM product_variant WHERE product_group_id = $1 AND deleted_at IS NULL)::int AS variants,
        (SELECT COUNT(*) FROM technical_document WHERE product_group_id = $1 AND deleted_at IS NULL)::int AS documents,
        (SELECT COUNT(*) FROM product_image WHERE product_group_id = $1 AND deleted_at IS NULL)::int AS images,
        (SELECT COUNT(*) FROM service_product_group WHERE product_group_id = $1 AND deleted_at IS NULL)::int AS service_links,
        (SELECT COUNT(*) FROM project_product_group WHERE product_group_id = $1 AND deleted_at IS NULL)::int AS project_links`,
      [raceGroupId]
    );
    const retained = counts.rows[0];
    assert(
      Object.values(retained).every((value) => Number(value) === 0),
      `archived group retained active children: ${JSON.stringify(retained)}`
    );

    return { blocked_statuses: responses.map((response) => response.status), retained };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
});

await runCase('PROD-GROUP-SLUG-LENGTH-COLLISION', 'Automatic 255-character slugs remain within storage limits when a suffix is needed', async () => {
  const longName = 'n'.repeat(255);
  const first = await createGroup({
    name: longName,
    category_id: context.level2Id,
    brand_id: context.brandId
  });
  assert(first.ok, responseError(first));
  const second = await createGroup({
    name: longName,
    category_id: context.level2Id,
    brand_id: context.brandId
  });
  assert(second.ok, responseError(second));

  const firstGroup = record(first.body, 'product_group');
  const secondGroup = record(second.body, 'product_group');
  context.extraGroupIds.push(String(firstGroup.id), String(secondGroup.id));
  assert(String(firstGroup.slug).length === 255, 'first maximum-length slug was not retained');
  assert(String(secondGroup.slug).length <= 255, 'collision suffix exceeded the slug column');
  assert(firstGroup.slug !== secondGroup.slug, 'collision did not produce a distinct slug');

  return {
    first_length: String(firstGroup.slug).length,
    second_length: String(secondGroup.slug).length,
    second_suffix: String(secondGroup.slug).slice(-4)
  };
});

await runCase('PROD-PUBLIC-BRAND-CASCADE', 'Inactive brand hides and reactivation restores its product group', async () => {
  const disable = await adminRequest(`/song-thanh/brands/${context.brandId}`, {
    method: 'PUT',
    body: { status: 'inactive' }
  });
  assert(disable.ok, responseError(disable));
  const hidden = await request(`/public/product-groups/${encodeURIComponent(context.groupSlug)}`);
  assert(hidden.status === 404, `inactive brand should hide group; received ${hidden.status}`);
  const enable = await adminRequest(`/song-thanh/brands/${context.brandId}`, {
    method: 'PUT',
    body: { status: 'active' }
  });
  assert(enable.ok, responseError(enable));
  const visible = await request(`/public/product-groups/${encodeURIComponent(context.groupSlug)}`);
  assert(visible.ok, responseError(visible));
  return { hidden_status: hidden.status, restored_status: visible.status };
});

await runCase('PROD-PUBLIC-CATEGORY-CASCADE', 'Inactive level-1 category hides and reactivation restores descendants', async () => {
  const disable = await adminRequest(`/song-thanh/product-categories/${context.level1Id}`, {
    method: 'PUT',
    body: { status: 'inactive' }
  });
  assert(disable.ok, responseError(disable));
  const hidden = await request(`/public/product-groups/${encodeURIComponent(context.groupSlug)}`);
  assert(hidden.status === 404, `inactive level-1 should hide group; received ${hidden.status}`);
  const enable = await adminRequest(`/song-thanh/product-categories/${context.level1Id}`, {
    method: 'PUT',
    body: { status: 'active' }
  });
  assert(enable.ok, responseError(enable));
  const visible = await request(`/public/product-groups/${encodeURIComponent(context.groupSlug)}`);
  assert(visible.ok, responseError(visible));
  return { hidden_status: hidden.status, restored_status: visible.status };
});

await runCase('PROD-VARIANT-PARENT-PUBLISH', 'A variant cannot publish below an unpublished product group', async () => {
  const groupResponse = await createGroup({
    name: `Nhóm Nháp QA ${RUN_ID}`,
    category_id: context.level2Id,
    brand_id: context.brandId,
    short_description: 'Nhóm dùng để thử chặn cha.',
    thumbnail_file_id: context.imageFileId,
    status: 'active',
    review_status: 'draft',
    publish_status: 'unpublished'
  });
  assert(groupResponse.ok, responseError(groupResponse));
  context.draftGroupId = String(record(groupResponse.body, 'product_group')?.id || '');
  const response = await createVariant({
    product_group_id: context.draftGroupId,
    variant_name: `Biến Thể Dưới Nhóm Nháp ${RUN_ID}`,
    status: 'active',
    review_status: 'approved',
    publish_status: 'published'
  });
  assertError(response, 409, 'PRODUCT_VARIANT_PUBLISH_REQUIRES_PUBLIC_GROUP');
  return errorEvidence(response);
});

await runCase('PROD-VARIANT-PRICE-BRANCH', 'Price modes enforce amount presence and clear quote-only amounts', async () => {
  const missingAmount = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Giá Công Khai Thiếu ${RUN_ID}`,
    public_price_mode: 'public_price'
  });
  assertError(missingAmount, 409, 'PRODUCT_VARIANT_PRICE_BRANCH_INVALID');

  const quoteOnly = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Liên Hệ Báo Giá ${RUN_ID}`,
    public_price_mode: 'contact_for_quote',
    public_price_amount: 123456
  });
  assert(quoteOnly.ok, responseError(quoteOnly));
  const variant = record(quoteOnly.body, 'product_variant');
  assert(variant?.public_price_amount === null, 'quote-only amount was not cleared');
  return { missing_amount_code: errorCode(missingAmount), stored_amount: variant.public_price_amount };
});

await runCase('PROD-VARIANT-PRICE-BOUNDS', 'Public prices accept the integer maximum and reject values outside bounds', async () => {
  const zero = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Giá Bằng Không ${RUN_ID}`,
    public_price_mode: 'public_price',
    public_price_amount: 0
  });
  assert(zero.status === 400, `zero price expected 400, received ${zero.status}`);
  const overflow = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Giá Tràn Số ${RUN_ID}`,
    public_price_mode: 'public_price',
    public_price_amount: MAX_PUBLIC_PRICE + 1
  });
  assert(overflow.status === 400, `overflow price expected 400, received ${overflow.status}`);
  const maximum = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Giá Tối Đa ${RUN_ID}`,
    public_price_mode: 'public_price',
    public_price_amount: MAX_PUBLIC_PRICE
  });
  assert(maximum.ok, responseError(maximum));
  assert(
    Number(record(maximum.body, 'product_variant')?.public_price_amount) === MAX_PUBLIC_PRICE,
    'maximum price was not retained'
  );
  return { zero_status: zero.status, overflow_status: overflow.status, maximum: MAX_PUBLIC_PRICE };
});

await runCase('PROD-VARIANT-TEXT-BOUNDS', 'Variant names and generated SKUs respect varchar storage boundaries', async () => {
  const overlong = await createVariant({
    product_group_id: context.groupId,
    variant_name: 'V'.repeat(256)
  });
  assert(overlong.status === 400, `256-character variant name expected 400, received ${overlong.status}`);

  const maximum = await createVariant({
    product_group_id: context.groupId,
    variant_name: 'V'.repeat(255)
  });
  assert(maximum.ok, responseError(maximum));
  const variant = record(maximum.body, 'product_variant');
  assert(String(variant.variant_name).length === 255, 'maximum variant name was not retained');
  assert(String(variant.sku).length <= 128, 'generated SKU exceeded varchar(128)');

  return {
    overlong_status: overlong.status,
    accepted_name_length: String(variant.variant_name).length,
    generated_sku_length: String(variant.sku).length
  };
});

await runCase('PROD-VARIANT-IDENTIFIER-UNIQUE', 'SKU, external_code, and model_code are independently unique', async () => {
  const base = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Biến Thể Mã Gốc ${RUN_ID}`,
    sku: `QA-SKU-${RUN_ID}`,
    external_code: `QA-EXT-${RUN_ID}`,
    model_code: `QA-MODEL-${RUN_ID}`,
    image_file_id: context.imageFileId
  });
  assert(base.ok, responseError(base));
  context.variantId = String(record(base.body, 'product_variant')?.id || '');

  const duplicateSku = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Trùng SKU ${RUN_ID}`,
    sku: `QA-SKU-${RUN_ID}`
  });
  assert(duplicateSku.status === 409, `duplicate SKU returned ${duplicateSku.status}`);
  const duplicateExternal = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Trùng External ${RUN_ID}`,
    external_code: `QA-EXT-${RUN_ID}`
  });
  assert(duplicateExternal.status === 409, `duplicate external_code returned ${duplicateExternal.status}`);
  const duplicateModel = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Trùng Model ${RUN_ID}`,
    model_code: `QA-MODEL-${RUN_ID}`
  });
  assert(duplicateModel.status === 409, `duplicate model_code returned ${duplicateModel.status}`);
  return {
    sku: errorCode(duplicateSku),
    external_code: errorCode(duplicateExternal),
    model_code: errorCode(duplicateModel)
  };
});

await runCase('PROD-VARIANT-IMAGE-TYPE', 'Variant image_file_id rejects a non-image file', async () => {
  const response = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Biến Thể Gắn PDF ${RUN_ID}`,
    image_file_id: context.nonImageFileId
  });
  assert(response.status === 400, `non-image variant file expected 400, received ${response.status}`);
  return errorEvidence(response);
});

await runCase('PROD-VARIANT-SKU-CONCURRENCY', 'Concurrent automatic SKU generation produces two distinct variants', async () => {
  const body = {
    product_group_id: context.groupId,
    variant_name: `Cạnh Tranh SKU ${RUN_ID}`
  };
  const responses = await Promise.all([createVariant(body), createVariant(body)]);
  assert(
    responses.every((response) => response.ok),
    `concurrent responses were ${responses.map((response) => response.status).join(', ')}`
  );
  const skus = responses.map((response) => record(response.body, 'product_variant')?.sku);
  assert(skus.every(Boolean), 'one concurrent response did not include a SKU');
  assert(new Set(skus).size === 2, `concurrent SKUs were not unique: ${skus.join(', ')}`);
  return { statuses: responses.map((response) => response.status), skus };
});

await runCase('PROD-VARIANT-MOVE-PARENT', 'A published variant cannot move to an unpublished parent', async () => {
  const publish = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: {
      review_status: 'approved',
      publish_status: 'published'
    }
  });
  assert(publish.ok, responseError(publish));
  const response = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: { product_group_id: context.draftGroupId }
  });
  assertError(response, 409, 'PRODUCT_VARIANT_PUBLISH_REQUIRES_PUBLIC_GROUP');
  return errorEvidence(response);
});

await runCase('PROD-VARIANT-STORAGE-BOUNDS', 'Variant identifiers, ordering, and attribute columns enforce exact storage bounds', async () => {
  const acceptedIdentifier = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: { external_code: 'E'.repeat(128), sort_order: MAX_SMALLINT }
  });
  assert(acceptedIdentifier.ok, responseError(acceptedIdentifier));

  const overlongIdentifier = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: { external_code: 'E'.repeat(129) }
  });
  assert(overlongIdentifier.status === 400, `129-character external_code expected 400, received ${overlongIdentifier.status}`);

  const negativeOrder = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: { sort_order: -1 }
  });
  assert(negativeOrder.status === 400, `negative variant sort_order expected 400, received ${negativeOrder.status}`);

  const overflowOrder = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: { sort_order: MAX_SMALLINT + 1 }
  });
  assert(overflowOrder.status === 400, `variant smallint overflow expected 400, received ${overflowOrder.status}`);

  const attribute = await adminRequest(`/song-thanh/product-variants/${context.variantId}/attributes`, {
    method: 'POST',
    body: { attribute_name: 'A'.repeat(128), attribute_value: 'Giá trị biên', display_order: MAX_SMALLINT }
  });
  assert(attribute.ok, responseError(attribute));
  const attributeId = String(record(attribute.body, 'attribute')?.id || '');
  assert(attributeId, 'accepted attribute id is missing');

  const overlongAttribute = await adminRequest(`/song-thanh/product-variants/${context.variantId}/attributes`, {
    method: 'POST',
    body: { attribute_name: 'A'.repeat(129), attribute_value: 'Bị chặn' }
  });
  assert(overlongAttribute.status === 400, `129-character attribute name expected 400, received ${overlongAttribute.status}`);

  const overflowAttributeOrder = await adminRequest(`/song-thanh/product-variants/${context.variantId}/attributes`, {
    method: 'POST',
    body: { attribute_name: 'Thứ tự tràn', attribute_value: 'Bị chặn', display_order: MAX_SMALLINT + 1 }
  });
  assert(overflowAttributeOrder.status === 400, `attribute smallint overflow expected 400, received ${overflowAttributeOrder.status}`);

  const archiveAttribute = await adminRequest(
    `/song-thanh/product-variants/${context.variantId}/attributes/${attributeId}/archive`,
    { method: 'POST', body: {} }
  );
  assert(archiveAttribute.ok, responseError(archiveAttribute));

  const reset = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: { external_code: `QA-EXT-${RUN_ID}`, sort_order: 0 }
  });
  assert(reset.ok, responseError(reset));

  return {
    identifier_max: 128,
    overlong_identifier_status: overlongIdentifier.status,
    sort_order_max: MAX_SMALLINT,
    overlong_attribute_status: overlongAttribute.status,
    overflow_attribute_order_status: overflowAttributeOrder.status
  };
});

await runCase('PROD-VARIANT-STALE-WRITE', 'A stale variant editor cannot overwrite a newer saved value', async () => {
  const before = await adminRequest(`/song-thanh/product-variants/${context.variantId}`);
  assert(before.ok, responseError(before));
  const original = record(before.body, 'product_variant');
  const expectedUpdatedAt = String(original.updated_at || '');
  assert(expectedUpdatedAt, 'product-variant updated_at is missing');

  const winnerValue = `Mô tả phiên mới ${RUN_ID}`;
  const winner = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: {
      detailed_description: winnerValue,
      expected_updated_at: expectedUpdatedAt
    }
  });
  assert(winner.ok, responseError(winner));

  const stale = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
    method: 'PUT',
    body: {
      detailed_description: `Mô tả phiên cũ ${RUN_ID}`,
      expected_updated_at: expectedUpdatedAt
    }
  });
  assertError(stale, 409, 'PRODUCT_VARIANT_VERSION_CONFLICT');

  const after = await adminRequest(`/song-thanh/product-variants/${context.variantId}`);
  assert(after.ok, responseError(after));
  const retained = record(after.body, 'product_variant');
  assert(retained.detailed_description === winnerValue, 'stale variant write replaced the winner value');
  return {
    code: errorCode(stale),
    winner_retained: retained.detailed_description === winnerValue
  };
});

await runCase('PROD-VARIANT-PARENT-PUBLISH-RACE', 'Variant publication re-checks the parent after waiting for a concurrent unpublish', async () => {
  const unpublishVariant = await adminRequest(
    `/song-thanh/product-variants/${context.variantId}`,
    { method: 'PUT', body: { publish_status: 'unpublished' } }
  );
  assert(unpublishVariant.ok, responseError(unpublishVariant));

  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM product_group WHERE id = $1 FOR UPDATE', [context.groupId]);

    let publishSettled = false;
    const publishPromise = adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
      method: 'PUT',
      body: { publish_status: 'published' }
    }).then((response) => {
      publishSettled = true;
      return response;
    });
    await delay(350);
    assert(!publishSettled, 'variant publication did not wait on the held product-group lock');

    await client.query(
      "UPDATE product_group SET publish_status = 'unpublished' WHERE id = $1",
      [context.groupId]
    );
    await client.query('COMMIT');
    committed = true;

    const publish = await publishPromise;
    assertError(publish, 409, 'PRODUCT_VARIANT_PUBLISH_REQUIRES_PUBLIC_GROUP');
    const variant = await adminRequest(`/song-thanh/product-variants/${context.variantId}`);
    assert(variant.ok, responseError(variant));
    assert(
      record(variant.body, 'product_variant')?.publish_status === 'unpublished',
      'rejected publication still changed the variant publish status'
    );

    const restoreGroup = await updateGroup(context.groupId, { publish_status: 'published' });
    assert(restoreGroup.ok, responseError(restoreGroup));
    const republishVariant = await adminRequest(
      `/song-thanh/product-variants/${context.variantId}`,
      { method: 'PUT', body: { publish_status: 'published' } }
    );
    assert(republishVariant.ok, responseError(republishVariant));
    return { code: errorCode(publish), rejected_status_retained: true };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
});

await runCase('PROD-VARIANT-ANCESTOR-PUBLISH-RACE', 'Variant publication re-checks category and brand visibility under the same transaction', async () => {
  const unpublishVariant = await adminRequest(
    `/song-thanh/product-variants/${context.variantId}`,
    { method: 'PUT', body: { publish_status: 'unpublished' } }
  );
  assert(unpublishVariant.ok, responseError(unpublishVariant));

  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  let publishPromise;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM brand WHERE id = $1 FOR UPDATE', [context.brandId]);
    await client.query("UPDATE brand SET status = 'inactive' WHERE id = $1", [context.brandId]);

    let settled = false;
    publishPromise = adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
      method: 'PUT',
      body: { publish_status: 'published' }
    }).then((response) => {
      settled = true;
      return response;
    });
    await delay(350);
    assert(!settled, 'variant publication did not wait on the held brand lock');

    await client.query('COMMIT');
    committed = true;
    const response = await publishPromise;
    assertError(response, 404, 'NOT_FOUND');
    const variant = await adminRequest(`/song-thanh/product-variants/${context.variantId}`);
    assert(variant.ok, responseError(variant));
    assert(
      record(variant.body, 'product_variant')?.publish_status === 'unpublished',
      'rejected ancestor race still published the variant'
    );

    await client.query("UPDATE brand SET status = 'active' WHERE id = $1", [context.brandId]);
    const republish = await adminRequest(`/song-thanh/product-variants/${context.variantId}`, {
      method: 'PUT',
      body: { publish_status: 'published' }
    });
    assert(republish.ok, responseError(republish));
    return { code: errorCode(response), rejected_status_retained: true };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    if (publishPromise) await publishPromise.catch(() => undefined);
    await client.query("UPDATE brand SET status = 'active' WHERE id = $1", [context.brandId]).catch(() => undefined);
    await client.end();
  }
});

await runCase('PROD-PUBLIC-LIST-QUERY-BOUNDS', 'Public product search, pagination, and multi-select filters have explicit bounds', async () => {
  const overlongSearch = await request(
    `/public/product-groups?q=${encodeURIComponent('Q'.repeat(256))}`
  );
  assert(overlongSearch.status === 400, `256-character search expected 400, received ${overlongSearch.status}`);

  const overflowPage = await request(
    `/public/product-groups?page=${MAX_PUBLIC_PRICE + 1}`
  );
  assert(overflowPage.status === 400, `overflow page expected 400, received ${overflowPage.status}`);

  const tooManyBrands = Array.from(
    { length: 51 },
    (_, index) => `brand-${index}`
  ).join(',');
  const brandFilter = await request(
    `/public/product-groups?brands=${encodeURIComponent(tooManyBrands)}`
  );
  assert(brandFilter.status === 400, `51-brand filter expected 400, received ${brandFilter.status}`);

  const maximumPageSize = await request('/public/product-groups?page=1&page_size=40');
  assert(maximumPageSize.ok, responseError(maximumPageSize));
  return {
    search_status: overlongSearch.status,
    page_status: overflowPage.status,
    brand_filter_status: brandFilter.status,
    accepted_page_size: unwrap(maximumPageSize.body)?.pagination?.page_size
  };
});

await runCase('PROD-QUOTE-QUANTITY-BOUNDS', 'Quote quantities reject fractions, fraction-like text, and integer overflow', async () => {
  const baseBody = {
    full_name: 'Khách kiểm thử số lượng',
    phone: '0901234567',
    email: `quote-quantity-${RUN_ID}@example.com`
  };
  const invalidQuantities = [0, -1, 0.5, '1/2', MAX_PUBLIC_PRICE + 1];
  const rejected = [];

  for (const [index, quantity] of invalidQuantities.entries()) {
    const response = await request('/public/quote-requests', {
      method: 'POST',
      headers: { 'X-Forwarded-For': `203.0.113.${41 + index}` },
      body: {
        ...baseBody,
        items: [{
          product_group_id: context.groupId,
          product_variant_id: context.variantId,
          quantity
        }]
      }
    });
    assert(response.status === 400, `quantity ${String(quantity)} expected 400, received ${response.status}`);
    rejected.push(String(quantity));
  }

  const accepted = await request('/public/quote-requests', {
    method: 'POST',
    headers: { 'X-Forwarded-For': '203.0.113.47' },
    body: {
      ...baseBody,
      items: [{
        product_group_id: context.groupId,
        product_variant_id: context.variantId,
        quantity: MAX_PUBLIC_PRICE
      }]
    }
  });
  assert(accepted.status === 201, responseError(accepted));
  const created = unwrap(accepted.body);
  const quoteRequestId = String(created?.quote_request?.id || '');
  assert(quoteRequestId, 'boundary quote request id is missing');
  assert(
    Number(created?.items?.[0]?.quantity) === MAX_PUBLIC_PRICE,
    'maximum PostgreSQL integer quantity was not retained exactly'
  );

  const client = createDatabaseClient();
  await client.connect();
  try {
    await client.query(
      'UPDATE quote_item SET deleted_at = NOW() WHERE quote_request_id = $1 AND deleted_at IS NULL',
      [quoteRequestId]
    );
    await client.query(
      'UPDATE quote_request SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [quoteRequestId]
    );
  } finally {
    await client.end();
  }

  return { rejected, accepted_maximum: MAX_PUBLIC_PRICE };
});

await runCase('PROD-VARIANT-ARCHIVE-QUOTE-RACE', 'Variant archival re-checks quote dependencies after waiting for a concurrent quote', async () => {
  const email = `variant-archive-race-${RUN_ID}@example.com`;
  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  let quoteRequestId = '';
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM product_group WHERE id = $1 FOR UPDATE', [context.groupId]);

    let quoteSettled = false;
    const quotePromise = request('/public/quote-requests', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '203.0.113.48' },
      body: {
        full_name: 'Khách kiểm thử lưu trữ đồng thời',
        phone: '0901234567',
        email,
        items: [{
          product_group_id: context.groupId,
          product_variant_id: context.variantId,
          quantity: 1
        }]
      }
    }).then((response) => {
      quoteSettled = true;
      return response;
    });

    await delay(350);
    assert(!quoteSettled, 'quote request did not wait on the held product-group lock');

    let archiveSettled = false;
    const archivePromise = adminRequest(
      `/song-thanh/product-variants/${context.variantId}/archive`,
      { method: 'POST', body: {} }
    ).then((response) => {
      archiveSettled = true;
      return response;
    });

    await delay(350);
    assert(!archiveSettled, 'variant archive did not wait on the quote-held variant lock');
    await client.query('COMMIT');
    committed = true;

    const quote = await quotePromise;
    assert(quote.status === 201, responseError(quote));
    quoteRequestId = String(unwrap(quote.body)?.quote_request?.id || '');
    assert(quoteRequestId, 'race quote request id is missing');

    const archive = await archivePromise;
    assertError(archive, 409, 'PRODUCT_VARIANT_ARCHIVE_BLOCKED');
    const variant = await adminRequest(`/song-thanh/product-variants/${context.variantId}`);
    assert(variant.ok, responseError(variant));
    assert(!record(variant.body, 'product_variant')?.deleted_at, 'blocked archive still archived the variant');

    await client.query(
      'UPDATE quote_item SET deleted_at = NOW() WHERE quote_request_id = $1 AND deleted_at IS NULL',
      [quoteRequestId]
    );
    await client.query(
      'UPDATE quote_request SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [quoteRequestId]
    );
    return { quote_status: quote.status, archive_code: errorCode(archive) };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    if (quoteRequestId) {
      await client.query(
        'UPDATE quote_item SET deleted_at = NOW() WHERE quote_request_id = $1 AND deleted_at IS NULL',
        [quoteRequestId]
      ).catch(() => undefined);
      await client.query(
        'UPDATE quote_request SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
        [quoteRequestId]
      ).catch(() => undefined);
    }
    await client.end();
  }
});

await runCase('PROD-PUBLIC-QUOTE-VISIBILITY-RACE', 'A quote request is rolled back when its product becomes non-public while the request waits', async () => {
  const email = `quote-race-${RUN_ID}@example.com`;
  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM product_variant WHERE id = $1 FOR UPDATE', [context.variantId]);
    await client.query('SELECT id FROM product_group WHERE id = $1 FOR UPDATE', [context.groupId]);

    let settled = false;
    const quotePromise = request('/public/quote-requests', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '203.0.113.49' },
      body: {
        full_name: 'Khách kiểm thử race',
        phone: '0901234567',
        email,
        items: [{
          product_group_id: context.groupId,
          product_variant_id: context.variantId,
          quantity: 1
        }]
      }
    }).then((response) => {
      settled = true;
      return response;
    });

    await delay(350);
    assert(!settled, 'quote request bypassed the held product/variant locks');
    await client.query(
      "UPDATE product_group SET publish_status = 'unpublished' WHERE id = $1",
      [context.groupId]
    );
    await client.query('COMMIT');
    committed = true;

    const response = await quotePromise;
    assert(response.status === 404, `visibility race quote expected 404, received ${response.status}`);
    const quoteCount = await client.query(
      'SELECT COUNT(*)::int AS total FROM quote_request WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    assert(Number(quoteCount.rows[0]?.total || 0) === 0, 'rejected quote left a quote_request row');

    const restore = await updateGroup(context.groupId, { publish_status: 'published' });
    assert(restore.ok, responseError(restore));
    return { status: response.status, persisted_quote_count: 0 };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
});

await runCase('PROD-PUBLIC-QUOTE-ANCESTOR-RACES', 'Quote creation serializes against level-2, level-1, and brand visibility changes', async () => {
  const targets = [
    { table: 'product_category', id: context.level2Id, label: 'level-2-category', ip: '203.0.113.50' },
    { table: 'product_category', id: context.level1Id, label: 'level-1-category', ip: '203.0.113.51' },
    { table: 'brand', id: context.brandId, label: 'brand', ip: '203.0.113.52' }
  ];
  const evidence = [];

  for (const target of targets) {
    const email = `quote-${target.label}-${RUN_ID}@example.com`;
    const client = createDatabaseClient();
    await client.connect();
    let committed = false;
    let quotePromise;
    try {
      await client.query('BEGIN');
      await client.query(`SELECT id FROM ${target.table} WHERE id = $1 FOR UPDATE`, [target.id]);
      await client.query(`UPDATE ${target.table} SET status = 'inactive' WHERE id = $1`, [target.id]);

      let settled = false;
      quotePromise = request('/public/quote-requests', {
        method: 'POST',
        headers: { 'X-Forwarded-For': target.ip },
        body: {
          full_name: `Quote ancestor ${target.label}`,
          phone: '0901234567',
          email,
          items: [{
            product_group_id: context.groupId,
            product_variant_id: context.variantId,
            quantity: 1
          }]
        }
      }).then((response) => {
        settled = true;
        return response;
      });
      await delay(350);
      assert(!settled, `quote did not wait on the held ${target.label} lock`);

      await client.query('COMMIT');
      committed = true;
      const response = await quotePromise;
      assert(response.status === 404, `${target.label} visibility race expected 404, received ${response.status}`);
      const persisted = await client.query(
        'SELECT COUNT(*)::int AS total FROM quote_request WHERE email = $1 AND deleted_at IS NULL',
        [email]
      );
      assert(Number(persisted.rows[0]?.total || 0) === 0, `${target.label} race persisted a quote`);
      evidence.push({ target: target.label, status: response.status, persisted: 0 });
    } finally {
      if (!committed) await client.query('ROLLBACK').catch(() => undefined);
      if (quotePromise) await quotePromise.catch(() => undefined);
      await client.query(`UPDATE ${target.table} SET status = 'active' WHERE id = $1`, [target.id]).catch(() => undefined);
      await client.end();
    }
  }

  return evidence;
});

await runCase('PROD-DOCUMENT-VARIANT-MOVE-RACE', 'A document cannot keep a variant that moved groups after service validation', async () => {
  const variantResponse = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Biến thể race tài liệu ${RUN_ID}`
  });
  assert(variantResponse.ok, responseError(variantResponse));
  const variantId = String(record(variantResponse.body, 'product_variant')?.id || '');
  assert(variantId, 'document-race variant id is missing');
  const documentName = `Tài liệu race chuyển nhóm ${RUN_ID}`;

  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM product_group WHERE id = $1 FOR UPDATE', [context.draftGroupId]);

    let moveSettled = false;
    const movePromise = adminRequest(`/song-thanh/product-variants/${variantId}`, {
      method: 'PUT',
      body: { product_group_id: context.draftGroupId }
    }).then((response) => {
      moveSettled = true;
      return response;
    });
    await delay(350);
    assert(!moveSettled, 'variant move did not wait on the held target-group lock');

    let documentSettled = false;
    const documentPromise = adminRequest('/song-thanh/technical-documents', {
      method: 'POST',
      body: {
        product_group_id: context.groupId,
        product_variant_id: variantId,
        document_name: documentName,
        document_type: 'datasheet',
        file_id: context.nonImageFileId,
        is_public: true
      }
    }).then((response) => {
      documentSettled = true;
      return response;
    });
    await delay(350);
    assert(!documentSettled, 'document create did not wait on the moving variant lock');

    await client.query('COMMIT');
    committed = true;
    const move = await movePromise;
    assert(move.ok, responseError(move));
    const document = await documentPromise;
    assertError(document, 409, 'TECHNICAL_DOCUMENT_VARIANT_GROUP_MISMATCH');

    const persisted = await client.query(
      'SELECT COUNT(*)::int AS total FROM technical_document WHERE document_name = $1 AND deleted_at IS NULL',
      [documentName]
    );
    assert(Number(persisted.rows[0]?.total || 0) === 0, 'rejected race document was persisted');

    const archive = await adminRequest(`/song-thanh/product-variants/${variantId}/archive`, {
      method: 'POST',
      body: {}
    });
    assert(archive.ok, responseError(archive));
    return { move_status: move.status, document_code: errorCode(document) };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
});

await runCase('PROD-DOCUMENT-RELATION-AND-BOUNDS', 'Technical documents cannot retain a variant from another group and enforce storage bounds', async () => {
  const created = await adminRequest('/song-thanh/technical-documents', {
    method: 'POST',
    body: {
      product_group_id: context.groupId,
      product_variant_id: context.variantId,
      document_name: `Tài liệu biên ${RUN_ID}`,
      document_type: 'datasheet',
      file_id: context.nonImageFileId,
      version: 'V'.repeat(32),
      is_public: true,
      sort_order: MAX_SMALLINT
    }
  });
  assert(created.ok, responseError(created));
  const document = record(created.body, 'technical_document');
  context.technicalDocumentId = String(document?.id || '');
  assert(context.technicalDocumentId, 'technical document id is missing');

  const publicBeforeUnpublish = await request(
    `/public/product-groups/${encodeURIComponent(context.groupSlug)}`
  );
  assert(publicBeforeUnpublish.ok, responseError(publicBeforeUnpublish));
  const documentsBeforeUnpublish = unwrap(publicBeforeUnpublish.body)?.technical_documents ?? [];
  assert(
    documentsBeforeUnpublish.some((item) => String(item?.id || '') === context.technicalDocumentId),
    'public variant document was missing while its variant was public'
  );

  const unpublishVariant = await adminRequest(
    `/song-thanh/product-variants/${context.variantId}`,
    { method: 'PUT', body: { publish_status: 'unpublished' } }
  );
  assert(unpublishVariant.ok, responseError(unpublishVariant));
  const publicAfterUnpublish = await request(
    `/public/product-groups/${encodeURIComponent(context.groupSlug)}`
  );
  assert(publicAfterUnpublish.ok, responseError(publicAfterUnpublish));
  const documentsAfterUnpublish = unwrap(publicAfterUnpublish.body)?.technical_documents ?? [];
  assert(
    !documentsAfterUnpublish.some((item) => String(item?.id || '') === context.technicalDocumentId),
    'document for an unpublished variant leaked through the public product detail'
  );
  const blockedVariantMove = await adminRequest(
    `/song-thanh/product-variants/${context.variantId}`,
    { method: 'PUT', body: { product_group_id: context.draftGroupId } }
  );
  assertError(
    blockedVariantMove,
    409,
    'PRODUCT_VARIANT_MOVE_BLOCKED_BY_DOCUMENTS'
  );
  const republishVariant = await adminRequest(
    `/song-thanh/product-variants/${context.variantId}`,
    { method: 'PUT', body: { publish_status: 'published' } }
  );
  assert(republishVariant.ok, responseError(republishVariant));
  const publicAfterRepublish = await request(
    `/public/product-groups/${encodeURIComponent(context.groupSlug)}`
  );
  assert(publicAfterRepublish.ok, responseError(publicAfterRepublish));
  const documentsAfterRepublish = unwrap(publicAfterRepublish.body)?.technical_documents ?? [];
  assert(
    documentsAfterRepublish.some((item) => String(item?.id || '') === context.technicalDocumentId),
    'public variant document did not return after the variant was republished'
  );

  const mismatchedGroup = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}`,
    { method: 'PUT', body: { product_group_id: context.draftGroupId } }
  );
  assertError(mismatchedGroup, 409, 'TECHNICAL_DOCUMENT_VARIANT_GROUP_MISMATCH');

  const overlongVersion = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}`,
    { method: 'PUT', body: { version: 'V'.repeat(33) } }
  );
  assert(overlongVersion.status === 400, `33-character document version expected 400, received ${overlongVersion.status}`);

  const negativeOrder = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}`,
    { method: 'PUT', body: { sort_order: -1 } }
  );
  assert(negativeOrder.status === 400, `negative document sort_order expected 400, received ${negativeOrder.status}`);

  const overflowOrder = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}`,
    { method: 'PUT', body: { sort_order: MAX_SMALLINT + 1 } }
  );
  assert(overflowOrder.status === 400, `document smallint overflow expected 400, received ${overflowOrder.status}`);

  const detail = await adminRequest(`/song-thanh/technical-documents/${context.technicalDocumentId}`);
  assert(detail.ok, responseError(detail));
  const retained = record(detail.body, 'technical_document');
  assert(retained.product_group_id === context.groupId, 'rejected mismatch changed product_group_id');
  assert(retained.product_variant_id === context.variantId, 'rejected mismatch changed product_variant_id');

  return {
    mismatch_code: errorCode(mismatchedGroup),
    retained_group_id: retained.product_group_id,
    public_document_lifecycle: 'visible-hidden-visible',
    version_max: 32,
    overlong_version_status: overlongVersion.status,
    sort_order_max: MAX_SMALLINT
  };
});

await runCase('PROD-DOCUMENT-STALE-LIFECYCLE', 'Document update, archive, and restore reject stale versions without partial file-usage changes', async () => {
  const before = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}`
  );
  assert(before.ok, responseError(before));
  const original = record(before.body, 'technical_document');
  const initialUpdatedAt = String(original.updated_at || '');
  assert(initialUpdatedAt, 'technical-document updated_at is missing');

  const winnerVersion = `winner-${RUN_ID}`;
  const winner = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}`,
    {
      method: 'PUT',
      body: { version: winnerVersion, expected_updated_at: initialUpdatedAt }
    }
  );
  assert(winner.ok, responseError(winner));
  const winnerRecord = record(winner.body, 'technical_document');
  const winnerUpdatedAt = String(winnerRecord.updated_at || '');

  const staleUpdate = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}`,
    {
      method: 'PUT',
      body: { version: `loser-${RUN_ID}`, expected_updated_at: initialUpdatedAt }
    }
  );
  assertError(staleUpdate, 409, 'TECHNICAL_DOCUMENT_VERSION_CONFLICT');

  const staleArchive = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}/archive`,
    { method: 'POST', body: { expected_updated_at: initialUpdatedAt } }
  );
  assertError(staleArchive, 409, 'TECHNICAL_DOCUMENT_VERSION_CONFLICT');

  const activeDetail = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}`
  );
  assert(activeDetail.ok, responseError(activeDetail));
  const activeRecord = record(activeDetail.body, 'technical_document');
  assert(activeRecord.deleted_at === null, 'stale archive changed deleted_at');
  assert(activeRecord.version === winnerVersion, 'stale update replaced document version');

  const archive = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}/archive`,
    { method: 'POST', body: { expected_updated_at: winnerUpdatedAt } }
  );
  assert(archive.ok, responseError(archive));
  const archivedRecord = record(archive.body, 'technical_document');
  const archivedUpdatedAt = String(archivedRecord.updated_at || '');
  assert(archivedRecord.deleted_at, 'document was not archived');

  const staleRestore = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}/restore`,
    { method: 'POST', body: { expected_updated_at: winnerUpdatedAt } }
  );
  assertError(staleRestore, 409, 'TECHNICAL_DOCUMENT_VERSION_CONFLICT');

  const restore = await adminRequest(
    `/song-thanh/technical-documents/${context.technicalDocumentId}/restore`,
    { method: 'POST', body: { expected_updated_at: archivedUpdatedAt } }
  );
  assert(restore.ok, responseError(restore));
  const restoredRecord = record(restore.body, 'technical_document');
  assert(restoredRecord.deleted_at === null, 'document was not restored');
  assert(restoredRecord.version === winnerVersion, 'document version changed across lifecycle');

  return {
    update_code: errorCode(staleUpdate),
    archive_code: errorCode(staleArchive),
    restore_code: errorCode(staleRestore),
    winner_retained: restoredRecord.version === winnerVersion
  };
});

await runCase('PROD-GALLERY-VARIANT-MOVE-RACE', 'Gallery replacement rejects a variant that moved groups after service validation', async () => {
  const variantResponse = await createVariant({
    product_group_id: context.groupId,
    variant_name: `Biến thể race thư viện ảnh ${RUN_ID}`
  });
  assert(variantResponse.ok, responseError(variantResponse));
  const variantId = String(record(variantResponse.body, 'product_variant')?.id || '');
  assert(variantId, 'gallery-race variant id is missing');

  const client = createDatabaseClient();
  await client.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM product_group WHERE id = $1 FOR UPDATE', [context.draftGroupId]);

    let moveSettled = false;
    const movePromise = adminRequest(`/song-thanh/product-variants/${variantId}`, {
      method: 'PUT',
      body: { product_group_id: context.draftGroupId }
    }).then((response) => {
      moveSettled = true;
      return response;
    });
    await delay(350);
    assert(!moveSettled, 'gallery-race variant move did not wait on the target-group lock');

    let gallerySettled = false;
    const galleryPromise = replaceGallery([{
      file_id: context.imageFileId,
      product_variant_id: variantId,
      alt_text: `Ảnh race ${RUN_ID}`
    }]).then((response) => {
      gallerySettled = true;
      return response;
    });
    await delay(350);
    assert(!gallerySettled, 'gallery replacement did not wait on the moving variant lock');

    await client.query('COMMIT');
    committed = true;
    const move = await movePromise;
    assert(move.ok, responseError(move));
    const gallery = await galleryPromise;
    assertError(gallery, 404, 'NOT_FOUND');

    const persisted = await client.query(
      'SELECT COUNT(*)::int AS total FROM product_image WHERE product_variant_id = $1 AND deleted_at IS NULL',
      [variantId]
    );
    assert(Number(persisted.rows[0]?.total || 0) === 0, 'rejected gallery race persisted an image relation');

    const archive = await adminRequest(`/song-thanh/product-variants/${variantId}/archive`, {
      method: 'POST',
      body: {}
    });
    assert(archive.ok, responseError(archive));
    return { move_status: move.status, gallery_code: errorCode(gallery) };
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
});

await runCase('PROD-GALLERY-FILE-TYPE', 'Product gallery rejects active non-image metadata', async () => {
  const response = await replaceGallery([
    { file_id: context.nonImageFileId, alt_text: 'Không phải hình ảnh' }
  ]);
  assert(response.status === 400, `non-image gallery file expected 400, received ${response.status}`);
  return errorEvidence(response);
});

await runCase('PROD-GALLERY-DEDUPE', 'Gallery keeps the first duplicate file entry', async () => {
  const response = await replaceGallery([
    { file_id: context.imageFileId, alt_text: 'Ảnh đầu tiên' },
    { file_id: context.imageFileId, alt_text: 'Ảnh trùng phải bỏ' }
  ]);
  assert(response.ok, responseError(response));
  const items = extractItems(unwrap(response.body));
  assert(items.length === 1, `expected one deduplicated image, received ${items.length}`);
  assert(items[0]?.alt_text === 'Ảnh đầu tiên', 'gallery did not keep the first duplicate');
  return { item_count: items.length, alt_text: items[0].alt_text };
});

await runCase('PROD-GALLERY-MAX', 'Gallery rejects the 81st requested image before deduplication', async () => {
  const response = await replaceGallery(
    Array.from({ length: 81 }, (_, index) => ({
      file_id: context.imageFileId,
      alt_text: `Ảnh ${index + 1}`
    }))
  );
  assert(response.status === 400, `81 gallery images expected 400, received ${response.status}`);
  const details = errorDetails(response);
  assert(Number(details?.limit) === 80, `expected limit=80, received ${details?.limit}`);
  return errorEvidence(response);
});

await runCase('PROD-CLEANUP', 'Product fixtures are archived before downstream suites run', async () => {
  const cleaned = [];
  if (context.technicalDocumentId) {
    const archivedDocument = await adminRequest(
      `/song-thanh/technical-documents/${context.technicalDocumentId}/archive`,
      { method: 'POST', body: {} }
    );
    assert(archivedDocument.ok, responseError(archivedDocument));
  }

  for (const groupId of [context.groupId, context.draftGroupId, ...context.extraGroupIds].filter(Boolean)) {
    const variantsResponse = await adminRequest(
      `/song-thanh/product-variants?product_group_id=${encodeURIComponent(groupId)}&page=1&page_size=100&deleted_scope=active`
    );
    assert(variantsResponse.ok, responseError(variantsResponse));
    const variants = extractItems(unwrap(variantsResponse.body));
    for (const variant of variants) {
      const archived = await adminRequest(
        `/song-thanh/product-variants/${variant.id}/archive`,
        { method: 'POST', body: {} }
      );
      assert(archived.ok, responseError(archived));
    }

    if (groupId === context.groupId) {
      const gallery = await adminRequest(
        `/song-thanh/product-groups/${groupId}/images`,
        { method: 'PUT', body: { images: [] } }
      );
      assert(gallery.ok, responseError(gallery));
    }

    const archivedGroup = await adminRequest(
      `/song-thanh/product-groups/${groupId}/archive`,
      { method: 'POST', body: {} }
    );
    assert(archivedGroup.ok, responseError(archivedGroup));
    cleaned.push({ group_id: groupId, variants_archived: variants.length });
  }
  return { cleaned };
});

finish();

async function runCase(id, title, action) {
  const started = Date.now();
  try {
    const evidence = await withTimeout(
      Promise.resolve().then(action),
      Number(process.env.PRODUCT_QA_CASE_TIMEOUT_MS || 20000),
      `${id} timed out`
    );
    results.push({ id, title, status: 'PASS', duration_ms: Date.now() - started, evidence });
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

async function createCategory(body) {
  return adminRequest('/song-thanh/product-categories', { method: 'POST', body });
}

async function createBrand(body) {
  return adminRequest('/song-thanh/brands', { method: 'POST', body });
}

async function createGroup(body) {
  return adminRequest('/song-thanh/product-groups', { method: 'POST', body });
}

async function updateGroup(id, body) {
  requireContext('groupId');
  return adminRequest(`/song-thanh/product-groups/${id}`, { method: 'PUT', body });
}

async function createVariant(body) {
  return adminRequest('/song-thanh/product-variants', { method: 'POST', body });
}

async function replaceGallery(images) {
  return adminRequest(`/song-thanh/product-groups/${context.groupId}/images`, {
    method: 'PUT',
    body: { images }
  });
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
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
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

function unwrap(body) {
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

function record(body, key) {
  const data = unwrap(body);
  return data?.[key] ?? data;
}

function extractItems(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function errorObject(response) {
  return response?.body?.error ?? unwrap(response?.body)?.error ?? null;
}

function errorCode(response) {
  return errorObject(response)?.code ?? null;
}

function errorDetails(response) {
  return errorObject(response)?.details ?? null;
}

function errorEvidence(response) {
  return {
    status: response.status,
    code: errorCode(response),
    details: errorDetails(response)
  };
}

function assertError(response, expectedStatus, expectedCode) {
  assert(
    response.status === expectedStatus,
    `expected ${expectedStatus}/${expectedCode}, received ${response.status}/${errorCode(response)}: ${responseError(response)}`
  );
  assert(
    errorCode(response) === expectedCode,
    `expected error ${expectedCode}, received ${errorCode(response)}`
  );
}

function responseError(response) {
  const error = errorObject(response);
  return `${response.status}: ${error?.code || 'REQUEST_FAILED'} - ${
    error?.message || JSON.stringify(response.body)
  }`;
}

function requireContext(key) {
  assert(context[key], `required QA context ${key} is missing`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createDatabaseClient() {
  return new PostgresClient({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 5432),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    `refusing mutation because DATABASE_NAME is not an isolated timestamped QA database: ${databaseName || '(unset)'}`
  );
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
  const lines = [
    '# Product-domain invariant QA last run',
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
      `| ${result.id} — ${escapeTable(result.title)} | ${result.status} | ${result.duration_ms}ms | ${escapeTable(
        result.status === 'PASS' ? compact(result.evidence) : result.error
      )} |`
    );
  }
  const failed = results.filter((result) => result.status === 'FAIL');
  lines.push(
    '',
    `Result: **${results.length - failed.length}/${results.length} passed; ${failed.length} failed.**`,
    '',
    'This suite mutates only a timestamped `_qa_YYYYMMDDHHMMSS` database created by the isolated runner.',
    '',
    'Generated by `node scripts/qa/product-domain-invariants-smoke.mjs`.'
  );
  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');

  console.log(`\nProduct-domain invariant QA run ${RUN_ID}`);
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
  return text.length > 320 ? `${text.slice(0, 317)}...` : text;
}

function escapeTable(value) {
  return String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}
