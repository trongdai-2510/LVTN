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
const QA_CLIENT_IP = '203.0.113.40';
const RUN_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'working-notes',
  'product-domain-invariants-qa-last-run.md'
);
const MAX_PUBLIC_PRICE = 2_147_483_647;

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
  variantId: ''
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
  for (const groupId of [context.groupId, context.draftGroupId].filter(Boolean)) {
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
