import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
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
const QA_CLIENT_IP = '198.51.100.61';
const RUN_ID = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'working-notes',
  'content-domain-invariants-qa-last-run.md'
);

const results = [];
const context = {
  accessToken: '',
  logicUserId: null,
  imageFileId: '',
  mobileImageFileId: '',
  documentFileId: '',
  pageContentImageFileId: '',
  serviceContentImageFileId: '',
  projectContentImageFileId: '',
  menuId: '',
  otherMenuId: '',
  menuItemIds: [],
  menuParentId: '',
  menuChildId: '',
  redirectIds: [],
  bannerIds: [],
  bannerId: '',
  pageIds: [],
  pageId: '',
  pageSlug: '',
  serviceIds: [],
  serviceId: '',
  serviceSlug: '',
  projectIds: [],
  projectId: '',
  projectSlug: '',
  projectGalleryId: '',
  productGroupId: ''
};

assertSafeTarget();

await runCase('CONTENT-ENV', 'The API and isolated QA database are safe to mutate', async () => {
  const health = await request('/health');
  assert(health.status === 200, `health returned ${health.status}`);
  return { database: process.env.DATABASE_NAME, target: API_BASE_URL };
});

await runCase('CONTENT-AUTH', 'Super-admin and stable logic-user identity are available', async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  assert(login.ok, responseError(login));
  const session = unwrap(login.body);
  context.accessToken = String(session?.access_token || '');
  assert(context.accessToken, 'login response did not include access_token');

  const contacts = await adminRequest('/song-thanh/contacts?page=1&page_size=1');
  assert(contacts.ok, responseError(contacts));
  const options = unwrap(contacts.body)?.assignee_options || [];
  const current = options.find(
    (option) => String(option.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
  assert(current && Number.isSafeInteger(current.id), 'logic-user identity is missing');
  context.logicUserId = current.id;
  return { admin_user_id: session?.user?.id, logic_user_id: context.logicUserId };
});

await runCase('CONTENT-FILE-FIXTURES', 'Uploaded image and document fixtures are readable and distinguishable', async () => {
  context.imageFileId = await uploadFile('desktop.png', 'image/png', tinyPng(), 'banner');
  context.mobileImageFileId = await uploadFile('mobile.png', 'image/png', tinyPng(), 'banner');
  context.documentFileId = await uploadFile(
    'not-an-image.pdf',
    'application/pdf',
    Buffer.from('%PDF-1.4\n% QA fixture\n'),
    'technical_document'
  );
  context.pageContentImageFileId = await uploadFile('page-content.png', 'image/png', tinyPng(), 'other');
  context.serviceContentImageFileId = await uploadFile('service-content.png', 'image/png', tinyPng(), 'other');
  context.projectContentImageFileId = await uploadFile('project-content.png', 'image/png', tinyPng(), 'other');
  return {
    image_file_id: context.imageFileId,
    mobile_image_file_id: context.mobileImageFileId,
    document_file_id: context.documentFileId,
    rich_content_file_ids: [
      context.pageContentImageFileId,
      context.serviceContentImageFileId,
      context.projectContentImageFileId
    ]
  };
});

await runCase('MENU-POSITION-UNIQUENESS', 'A menu position remains globally unique', async () => {
  const list = await adminRequest('/song-thanh/menus?deleted_scope=active&page=1&page_size=100');
  assert(list.ok, responseError(list));
  const menus = extractItems(unwrap(list.body));
  assert(menus.length >= 2, 'at least two active menu fixtures are required');
  context.menuId = menus[0].id;
  context.otherMenuId = menus[1].id;

  const duplicate = await adminRequest('/song-thanh/menus', {
    method: 'POST',
    body: { name: `Duplicate menu ${RUN_ID}`, position: menus[0].position }
  });
  assertError(duplicate, 409, 'MENU_POSITION_CONFLICT');
  return { menu_id: context.menuId, other_menu_id: context.otherMenuId };
});

await runCase('MENU-LINK-BOUNDARIES', 'Menu link types enforce safe, type-specific targets', async () => {
  const invalidCases = [
    { title: 'Internal unsafe', link_type: 'internal', link_target: 'javascript:alert(1)' },
    { title: 'External unsafe', link_type: 'external', link_target: 'javascript:alert(1)' },
    { title: 'Anchor unsafe', link_type: 'anchor', link_target: '/not-an-anchor' }
  ];
  const evidence = [];
  for (const body of invalidCases) {
    const response = await createMenuItem(context.menuId, body);
    assert(response.status === 400, `${body.link_type} unsafe target returned ${response.status}`);
    evidence.push({ link_type: body.link_type, status: response.status, code: errorCode(response) });
  }

  const group = await createMenuItem(context.menuId, {
    title: `QA group ${RUN_ID}`,
    link_type: 'group',
    link_target: '/must-be-cleared'
  });
  assert(group.ok, responseError(group));
  const groupItem = newestMenuItem(group.body);
  assert(groupItem?.link_target === null, 'group link_target was not cleared');
  assert(
    groupItem?.created_by === context.logicUserId,
    `menu item created_by=${groupItem?.created_by}`
  );
  assert(
    groupItem?.updated_by === context.logicUserId,
    `menu item updated_by=${groupItem?.updated_by}`
  );
  context.menuItemIds.push(groupItem.id);
  return { invalid: evidence, group_item_id: groupItem.id };
});

await runCase('MENU-HIERARCHY', 'Menu hierarchy rejects cross-menu parents and ancestor cycles', async () => {
  const parentResponse = await createMenuItem(context.menuId, {
    title: `QA parent ${RUN_ID}`,
    link_type: 'internal',
    link_target: `/qa-parent-${RUN_ID}`
  });
  assert(parentResponse.ok, responseError(parentResponse));
  context.menuParentId =
    menuItemByTitle(parentResponse.body, `QA parent ${RUN_ID}`)?.id || '';

  const childResponse = await createMenuItem(context.menuId, {
    parent_id: context.menuParentId,
    title: `QA child ${RUN_ID}`,
    link_type: 'internal',
    link_target: `/qa-child-${RUN_ID}`
  });
  assert(childResponse.ok, responseError(childResponse));
  context.menuChildId =
    menuItemByTitle(childResponse.body, `QA child ${RUN_ID}`)?.id || '';
  context.menuItemIds.push(context.menuChildId, context.menuParentId);

  const crossMenu = await createMenuItem(context.otherMenuId, {
    parent_id: context.menuParentId,
    title: `Cross menu child ${RUN_ID}`,
    link_type: 'group'
  });
  assert(crossMenu.status === 404, `cross-menu parent returned ${crossMenu.status}`);

  const cycle = await adminRequest(`/song-thanh/menu-items/${context.menuParentId}`, {
    method: 'PUT',
    body: { parent_id: context.menuChildId }
  });
  assertError(cycle, 409, 'MENU_CONFLICT');
  return {
    parent_id: context.menuParentId,
    child_id: context.menuChildId,
    cross_menu_status: crossMenu.status,
    cycle_code: errorCode(cycle)
  };
});

await runCase('MENU-REORDER-INVARIANTS', 'Menu reorder is complete, duplicate-free, and acyclic', async () => {
  const duplicate = await reorderMenu([
    { id: context.menuParentId, parent_id: null, sort_order: 10 },
    { id: context.menuParentId, parent_id: null, sort_order: 20 }
  ]);
  assertError(duplicate, 409, 'MENU_CONFLICT');

  const missingParent = await reorderMenu([
    { id: context.menuChildId, parent_id: context.menuParentId, sort_order: 1 }
  ]);
  assertError(missingParent, 409, 'MENU_CONFLICT');

  const loop = await reorderMenu([
    { id: context.menuParentId, parent_id: context.menuChildId, sort_order: 1 },
    { id: context.menuChildId, parent_id: context.menuParentId, sort_order: 2 }
  ]);
  assertError(loop, 409, 'MENU_CONFLICT');

  const valid = await reorderMenu([
    { id: context.menuParentId, parent_id: null, sort_order: 101 },
    { id: context.menuChildId, parent_id: context.menuParentId, sort_order: 102 }
  ]);
  assert(valid.ok, responseError(valid));
  const reorderedParent = (unwrap(valid.body)?.flat_items || []).find(
    (item) => item.id === context.menuParentId
  );
  assert(
    reorderedParent?.updated_by === context.logicUserId,
    `reordered menu item updated_by=${reorderedParent?.updated_by}`
  );
  return {
    duplicate_code: errorCode(duplicate),
    missing_parent_code: errorCode(missingParent),
    loop_code: errorCode(loop)
  };
});

await runCase('MENU-ARCHIVE-RESTORE', 'Menu items preserve parent-child lifecycle dependencies', async () => {
  const blocked = await adminRequest(`/song-thanh/menu-items/${context.menuParentId}/archive`, {
    method: 'POST',
    body: {}
  });
  assertError(blocked, 409, 'MENU_ITEM_ARCHIVE_BLOCKED');

  assertOk(await archiveMenuItem(context.menuChildId));
  assertOk(await archiveMenuItem(context.menuParentId));

  const childFirst = await adminRequest(`/song-thanh/menu-items/${context.menuChildId}/restore`, {
    method: 'POST',
    body: {}
  });
  assert(childFirst.status === 404, `child restore below archived parent returned ${childFirst.status}`);

  assertOk(
    await adminRequest(`/song-thanh/menu-items/${context.menuParentId}/restore`, {
      method: 'POST',
      body: {}
    })
  );
  assertOk(
    await adminRequest(`/song-thanh/menu-items/${context.menuChildId}/restore`, {
      method: 'POST',
      body: {}
    })
  );
  return { blocked_code: errorCode(blocked), child_first_status: childFirst.status };
});

await runCase('REDIRECT-PATH-SAFETY', 'Redirects reject host escapes, traversal, fragments, and encoded slashes', async () => {
  const unsafePaths = ['//evil.example/path', '/../secret', '/safe#fragment', '/safe%2Fhidden'];
  const statuses = [];
  for (const fromPath of unsafePaths) {
    const response = await createRedirect(fromPath, `/qa-safe-${RUN_ID}`);
    assert(response.status === 400, `${fromPath} returned ${response.status}`);
    statuses.push({ from_path: fromPath, status: response.status });
  }
  return { unsafe_paths: statuses };
});

await runCase('REDIRECT-LOOP-UNIQUENESS', 'Redirect rules reject duplicates, self redirects, and multi-hop loops', async () => {
  const pathA = `/qa-redirect-a-${RUN_ID}`;
  const pathB = `/qa-redirect-b-${RUN_ID}`;
  const pathC = `/qa-redirect-c-${RUN_ID}`;
  const first = await createRedirect(pathA, pathB);
  assert(first.ok, responseError(first));
  const firstRedirect = record(first.body, 'redirect');
  context.redirectIds.push(firstRedirect.id);
  assert(
    firstRedirect.created_by === context.logicUserId,
    `redirect created_by=${firstRedirect.created_by}`
  );
  assert(
    firstRedirect.updated_by === context.logicUserId,
    `redirect updated_by=${firstRedirect.updated_by}`
  );
  const second = await createRedirect(pathB, pathC);
  assert(second.ok, responseError(second));
  context.redirectIds.push(record(second.body, 'redirect').id);

  const duplicate = await createRedirect(pathA, `/qa-other-${RUN_ID}`);
  assertError(duplicate, 409, 'REDIRECT_FROM_PATH_CONFLICT');
  const self = await createRedirect(`/qa-self-${RUN_ID}`, `/qa-self-${RUN_ID}`);
  assertError(self, 409, 'REDIRECT_CONFLICT');
  const loop = await createRedirect(pathC, pathA);
  assertError(loop, 409, 'REDIRECT_CONFLICT');
  return {
    duplicate_code: errorCode(duplicate),
    self_code: errorCode(self),
    loop_code: errorCode(loop)
  };
});

await runCase('BANNER-IMAGE-TYPE', 'Banner desktop and mobile references accept active images only', async () => {
  const invalidDesktop = await createBanner({
    title: `Invalid desktop banner ${RUN_ID}`,
    image_file_id: context.documentFileId
  });
  if (invalidDesktop.ok) context.bannerIds.push(record(invalidDesktop.body, 'banner').id);
  assert(invalidDesktop.status === 404, `non-image desktop file returned ${invalidDesktop.status}`);

  const invalidMobile = await createBanner({
    title: `Invalid mobile banner ${RUN_ID}`,
    image_file_id: context.imageFileId,
    image_mobile_file_id: context.documentFileId
  });
  if (invalidMobile.ok) context.bannerIds.push(record(invalidMobile.body, 'banner').id);
  assert(invalidMobile.status === 404, `non-image mobile file returned ${invalidMobile.status}`);
  return { desktop_status: invalidDesktop.status, mobile_status: invalidMobile.status };
});

await runCase('BANNER-LINK-SAFETY', 'Banner primary and CTA links cannot execute unsafe schemes', async () => {
  const invalidInternal = await createBanner({
    title: `Invalid link banner ${RUN_ID}`,
    image_file_id: context.imageFileId,
    link_type: 'internal',
    link_target: 'javascript:alert(1)'
  });
  if (invalidInternal.ok) context.bannerIds.push(record(invalidInternal.body, 'banner').id);
  assert(invalidInternal.status === 400, `unsafe internal banner link returned ${invalidInternal.status}`);

  const invalidCta = await createBanner({
    title: `Invalid CTA banner ${RUN_ID}`,
    image_file_id: context.imageFileId,
    cta_buttons: [{ text: 'Unsafe', url: 'javascript:alert(1)' }]
  });
  if (invalidCta.ok) context.bannerIds.push(record(invalidCta.body, 'banner').id);
  assert(invalidCta.status === 400, `unsafe CTA link returned ${invalidCta.status}`);
  return { primary_status: invalidInternal.status, cta_status: invalidCta.status };
});

await runCase('BANNER-LIFECYCLE', 'Banner restore revalidates both desktop and mobile image dependencies', async () => {
  const created = await createBanner({
    title: `Valid banner ${RUN_ID}`,
    image_file_id: context.imageFileId,
    image_mobile_file_id: context.mobileImageFileId,
    link_type: 'internal',
    link_target: `/qa-banner-${RUN_ID}`
  });
  assert(created.ok, responseError(created));
  context.bannerId = record(created.body, 'banner').id;
  const createdBanner = record(created.body, 'banner');
  assert(
    createdBanner.created_by === context.logicUserId,
    `banner created_by=${createdBanner.created_by}`
  );
  context.bannerIds.push(context.bannerId);
  assertOk(
    await adminRequest(`/song-thanh/banners/${context.bannerId}/archive`, {
      method: 'POST',
      body: {}
    })
  );
  assertOk(
    await adminRequest(`/song-thanh/files/${context.mobileImageFileId}/archive`, {
      method: 'POST',
      body: {}
    })
  );

  const blocked = await adminRequest(`/song-thanh/banners/${context.bannerId}/restore`, {
    method: 'POST',
    body: {}
  });
  assert(blocked.status === 404, `restore with archived mobile image returned ${blocked.status}`);

  assertOk(
    await adminRequest(`/song-thanh/files/${context.mobileImageFileId}/restore`, {
      method: 'POST',
      body: {}
    })
  );
  const restored = await adminRequest(`/song-thanh/banners/${context.bannerId}/restore`, {
      method: 'POST',
      body: {}
    });
  assertOk(restored);
  assert(
    record(restored.body, 'banner').updated_by === context.logicUserId,
    `restored banner updated_by=${record(restored.body, 'banner').updated_by}`
  );
  return { blocked_status: blocked.status, banner_id: context.bannerId };
});

await runCase('PAGE-PUBLISH-READINESS', 'Pages require approved review, meaningful body, and image-typed references', async () => {
  const created = await adminRequest('/song-thanh/page-contents', {
    method: 'POST',
    body: {
      title: `QA content page ${RUN_ID}`,
      slug: `qa-content-page-${RUN_ID}`,
      content_type: 'page',
      excerpt: 'QA page excerpt',
      content_html:
        `<p>Rich content QA</p><img src="/public/files/${context.pageContentImageFileId}" alt="QA">` +
        '<script>alert(1)</script>',
      featured_image_file_id: context.imageFileId
    }
  });
  assert(created.ok, responseError(created));
  const page = record(created.body, 'page_content');
  context.pageId = page.id;
  context.pageSlug = page.slug;
  context.pageIds.push(page.id);
  assert(!String(page.content_html).includes('<script'), 'stored page HTML still contains script');
  await assertRichContentUsage(
    context.pageContentImageFileId,
    'page_content',
    context.pageId
  );
  const draftFile = await request(`/public/files/${context.pageContentImageFileId}`);
  assert(draftFile.status === 404, `draft rich-content file returned ${draftFile.status}`);

  const unapproved = await updatePage({ publish_status: 'published' });
  assertError(unapproved, 409, 'PAGE_CONTENT_CONFLICT');

  const wrongFile = await updatePage({ featured_image_file_id: context.documentFileId });
  assert(wrongFile.status === 404, `page accepted non-image featured file with ${wrongFile.status}`);
  await updatePage({ featured_image_file_id: context.imageFileId });
  const wrongRichFile = await updatePage({
    content_html: `<p>Invalid rich file</p><img src="/public/files/${context.documentFileId}" alt="PDF">`
  });
  assert(
    wrongRichFile.status === 404,
    `page accepted non-image rich-content file with ${wrongRichFile.status}`
  );

  const empty = await adminRequest('/song-thanh/page-contents', {
    method: 'POST',
    body: {
      title: `Empty published page ${RUN_ID}`,
      slug: `empty-published-page-${RUN_ID}`,
      review_status: 'approved',
      publish_status: 'published'
    }
  });
  if (empty.ok) context.pageIds.push(record(empty.body, 'page_content').id);
  assert(empty.status === 409, `empty page publish returned ${empty.status}`);
  return {
    page_id: context.pageId,
    unapproved_code: errorCode(unapproved),
    wrong_file_status: wrongFile.status,
    wrong_rich_file_status: wrongRichFile.status,
    empty_status: empty.status
  };
});

await runCase('PAGE-EXTRA-BLOCK-LIMITS', 'Structured page blocks enforce count and image-reference integrity', async () => {
  const tooMany = await updatePage({
    extra_blocks: {
      blocks: Array.from({ length: 21 }, (_, index) => ({
        id: randomUUID(),
        type: 'bullet_list',
        items: [{ text: `Item ${index}` }]
      }))
    }
  });
  assert(tooMany.status === 400, `21 blocks returned ${tooMany.status}`);

  const nonImageBlock = await updatePage({
    extra_blocks: {
      blocks: [
        {
          id: randomUUID(),
          type: 'image_card',
          title: 'Image card',
          image_file_id: context.documentFileId
        }
      ]
    }
  });
  assert(nonImageBlock.status === 404, `image_card accepted a PDF with ${nonImageBlock.status}`);
  const imageBlockId = randomUUID();
  assertOk(
    await updatePage({
      extra_blocks: {
        blocks: [
          {
            id: imageBlockId,
            type: 'image_card',
            title: 'Managed image card',
            image_file_id: context.mobileImageFileId
          }
        ]
      }
    })
  );
  const activeUsages = await adminRequest(
    `/song-thanh/files/${context.mobileImageFileId}/usages?deleted_scope=active`
  );
  assert(activeUsages.ok, responseError(activeUsages));
  const fieldName = `extra_blocks.${imageBlockId}`;
  assert(
    (unwrap(activeUsages.body)?.usages || []).some(
      (usage) =>
        usage.entity_type === 'page_content' &&
        usage.entity_id === context.pageId &&
        usage.field_name === fieldName
    ),
    'active image-card file_usage was not created'
  );
  assertOk(await updatePage({ extra_blocks: { blocks: [] } }));
  const allUsages = await adminRequest(
    `/song-thanh/files/${context.mobileImageFileId}/usages?deleted_scope=all`
  );
  assert(allUsages.ok, responseError(allUsages));
  assert(
    (unwrap(allUsages.body)?.usages || []).some(
      (usage) =>
        usage.entity_type === 'page_content' &&
        usage.entity_id === context.pageId &&
        usage.field_name === fieldName &&
        usage.deleted_at
    ),
    'removed image-card file_usage was not soft-deleted'
  );
  return {
    max_block_status: tooMany.status,
    image_reference_status: nonImageBlock.status,
    managed_usage_field: fieldName
  };
});

await runCase('PAGE-ACTOR-WORKFLOW', 'Page mutations retain actor identities and separate approve from publish', async () => {
  const published = await updatePage({
    review_status: 'approved',
    publish_status: 'published'
  });
  assert(published.ok, responseError(published));
  const page = record(published.body, 'page_content');
  assert(page.created_by === context.logicUserId, `created_by=${page.created_by}`);
  assert(page.updated_by === context.logicUserId, `updated_by=${page.updated_by}`);
  assert(page.approved_by === context.logicUserId, `approved_by=${page.approved_by}`);
  const publicPage = await request(`/public/page-contents/${context.pageSlug}`);
  assert(publicPage.ok, responseError(publicPage));
  const publicFile = await request(`/public/files/${context.pageContentImageFileId}`);
  assert(publicFile.ok, responseError(publicFile));
  assert(
    publicFile.headers.get('cache-control') === 'private, no-store',
    `public file cache-control=${publicFile.headers.get('cache-control')}`
  );
  return {
    created_by: page.created_by,
    updated_by: page.updated_by,
    approved_by: page.approved_by,
    rich_content_file_status: publicFile.status
  };
});

await runCase('PAGE-MAJOR-EDIT-REVIEW', 'A major edit to published page returns it to review and hides the changed row', async () => {
  const edited = await updatePage({ title: `Major page edit ${RUN_ID}` });
  assert(edited.ok, responseError(edited));
  const page = record(edited.body, 'page_content');
  assert(page.review_status === 'pending_review', `review_status=${page.review_status}`);
  assert(page.publish_status === 'unpublished', `publish_status=${page.publish_status}`);
  const publicPage = await request(`/public/page-contents/${context.pageSlug}`);
  assert(publicPage.status === 404, `major-edited page stayed public with ${publicPage.status}`);
  const hiddenFile = await request(`/public/files/${context.pageContentImageFileId}`);
  assert(hiddenFile.status === 404, `unpublished page file stayed public with ${hiddenFile.status}`);
  return {
    review_status: page.review_status,
    publish_status: page.publish_status,
    public_status: publicPage.status,
    rich_content_file_status: hiddenFile.status
  };
});

await runCase('PAGE-MINOR-EDIT-REVIEW', 'SEO-only edits do not invalidate an approved published body', async () => {
  assertOk(
    await updatePage({ review_status: 'approved', publish_status: 'published' })
  );
  const edited = await updatePage({ seo_title: `SEO only ${RUN_ID}` });
  assert(edited.ok, responseError(edited));
  const page = record(edited.body, 'page_content');
  assert(page.review_status === 'approved', `review_status=${page.review_status}`);
  assert(page.publish_status === 'published', `publish_status=${page.publish_status}`);
  return { review_status: page.review_status, publish_status: page.publish_status };
});

await runCase('SERVICE-PUBLISH-BOUNDARIES', 'Services require description and image-typed references before publishing', async () => {
  const missing = await createService({
    title: `Incomplete service ${RUN_ID}`,
    review_status: 'approved',
    publish_status: 'published'
  });
  if (missing.ok) context.serviceIds.push(record(missing.body, 'service').id);
  assert(missing.status === 409, `incomplete service publish returned ${missing.status}`);

  const wrongFile = await createService({
    title: `Wrong image service ${RUN_ID}`,
    description: 'Complete description',
    image_file_id: context.documentFileId,
    review_status: 'approved',
    publish_status: 'published'
  });
  if (wrongFile.ok) context.serviceIds.push(record(wrongFile.body, 'service').id);
  assert(wrongFile.status === 404, `service accepted non-image file with ${wrongFile.status}`);

  const wrongRichFile = await createService({
    title: `Wrong rich image service ${RUN_ID}`,
    description: 'Complete description',
    content_html: `<p>Invalid rich file</p><img src="/public/files/${context.documentFileId}" alt="PDF">`,
    image_file_id: context.imageFileId
  });
  if (wrongRichFile.ok) context.serviceIds.push(record(wrongRichFile.body, 'service').id);
  assert(
    wrongRichFile.status === 404,
    `service accepted non-image rich-content file with ${wrongRichFile.status}`
  );

  const created = await createService({
    title: `QA service ${RUN_ID}`,
    description: 'Complete service description',
    content_html:
      `<p>Safe service</p><img src="/public/files/${context.serviceContentImageFileId}" alt="QA">` +
      '<script>alert(1)</script>',
    image_file_id: context.imageFileId,
    review_status: 'approved',
    publish_status: 'published'
  });
  assert(created.ok, responseError(created));
  const service = record(created.body, 'service');
  context.serviceId = service.id;
  context.serviceSlug = service.slug;
  context.serviceIds.push(service.id);
  assert(!String(service.content_html).includes('<script'), 'service HTML was not sanitized');
  await assertRichContentUsage(
    context.serviceContentImageFileId,
    'service',
    context.serviceId
  );
  const publicFile = await request(`/public/files/${context.serviceContentImageFileId}`);
  assert(publicFile.ok, responseError(publicFile));
  return {
    service_id: service.id,
    missing_status: missing.status,
    wrong_file_status: wrongFile.status,
    wrong_rich_file_status: wrongRichFile.status,
    rich_content_file_status: publicFile.status
  };
});

await runCase('SERVICE-ACTOR-MAJOR-EDIT', 'Service actors are retained and major edits reopen review', async () => {
  const detail = await adminRequest(`/song-thanh/services/${context.serviceId}`);
  assert(detail.ok, responseError(detail));
  const before = record(detail.body, 'service');
  assert(before.created_by === context.logicUserId, `created_by=${before.created_by}`);
  assert(before.approved_by === context.logicUserId, `approved_by=${before.approved_by}`);

  const edited = await adminRequest(`/song-thanh/services/${context.serviceId}`, {
    method: 'PUT',
    body: { description: `Major service edit ${RUN_ID}` }
  });
  assert(edited.ok, responseError(edited));
  const service = record(edited.body, 'service');
  assert(service.review_status === 'pending_review', `review_status=${service.review_status}`);
  assert(service.publish_status === 'unpublished', `publish_status=${service.publish_status}`);
  assert(service.updated_by === context.logicUserId, `updated_by=${service.updated_by}`);
  const publicService = await request(`/public/services/${context.serviceSlug}`);
  assert(publicService.status === 404, `major-edited service stayed public with ${publicService.status}`);
  const hiddenFile = await request(`/public/files/${context.serviceContentImageFileId}`);
  assert(hiddenFile.status === 404, `unpublished service file stayed public with ${hiddenFile.status}`);
  return {
    created_by: before.created_by,
    approved_by: before.approved_by,
    updated_by: service.updated_by,
    public_status: publicService.status,
    rich_content_file_status: hiddenFile.status
  };
});

await runCase('CONTENT-PRODUCT-RELATION-FIXTURE', 'An active product group is available for content relations', async () => {
  const groups = await adminRequest(
    '/song-thanh/product-groups?status=active&deleted_scope=active&page=1&page_size=100'
  );
  assert(groups.ok, responseError(groups));
  const group = extractItems(unwrap(groups.body))[0];
  assert(group?.id, 'no active product group is available');
  context.productGroupId = group.id;
  return { product_group_id: group.id };
});

await runCase('SERVICE-RELATION-LIFECYCLE', 'Service-product relation uses attach, detach, and restore without duplication', async () => {
  const attached = await adminRequest(`/song-thanh/services/${context.serviceId}/product-groups`, {
    method: 'POST',
    body: { product_group_id: context.productGroupId }
  });
  assert(attached.ok, responseError(attached));
  const attachedServiceRelation = (
    unwrap(attached.body)?.related_product_groups || []
  ).find(
    (item) => item.product_group?.id === context.productGroupId
  )?.association;
  assert(
    attachedServiceRelation?.created_by === context.logicUserId,
    `service relation created_by=${attachedServiceRelation?.created_by}`
  );
  const duplicate = await adminRequest(`/song-thanh/services/${context.serviceId}/product-groups`, {
    method: 'POST',
    body: { product_group_id: context.productGroupId }
  });
  assertError(duplicate, 409, 'SERVICE_CONFLICT');
  assertOk(
    await adminRequest(
      `/song-thanh/services/${context.serviceId}/product-groups/${context.productGroupId}`,
      { method: 'DELETE' }
    )
  );
  const attachArchived = await adminRequest(
    `/song-thanh/services/${context.serviceId}/product-groups`,
    { method: 'POST', body: { product_group_id: context.productGroupId } }
  );
  assertError(attachArchived, 409, 'SERVICE_CONFLICT');
  assertOk(
    await adminRequest(
      `/song-thanh/services/${context.serviceId}/product-groups/${context.productGroupId}/restore`,
      { method: 'POST', body: {} }
    )
  );
  return {
    duplicate_code: errorCode(duplicate),
    archived_attach_code: errorCode(attachArchived)
  };
});

await runCase('PROJECT-PUBLISH-BOUNDARIES', 'Projects enforce year, location, description, and image requirements', async () => {
  const badYear = await createProject({
    title: `Bad year project ${RUN_ID}`,
    project_year: 1899
  });
  assert(badYear.status === 400, `project_year 1899 returned ${badYear.status}`);

  const missing = await createProject({
    title: `Incomplete project ${RUN_ID}`,
    review_status: 'approved',
    publish_status: 'published'
  });
  if (missing.ok) context.projectIds.push(record(missing.body, 'project').id);
  assert(missing.status === 409, `incomplete project publish returned ${missing.status}`);

  const wrongFile = await createProject({
    title: `Wrong image project ${RUN_ID}`,
    location: 'TP.HCM',
    project_year: 2026,
    description: 'Complete description',
    image_file_id: context.documentFileId,
    review_status: 'approved',
    publish_status: 'published'
  });
  if (wrongFile.ok) context.projectIds.push(record(wrongFile.body, 'project').id);
  assert(wrongFile.status === 404, `project accepted non-image file with ${wrongFile.status}`);

  const wrongRichFile = await createProject({
    title: `Wrong rich image project ${RUN_ID}`,
    location: 'TP.HCM',
    project_year: 2026,
    description: 'Complete description',
    content_html: `<p>Invalid rich file</p><img src="/public/files/${context.documentFileId}" alt="PDF">`,
    image_file_id: context.imageFileId
  });
  if (wrongRichFile.ok) context.projectIds.push(record(wrongRichFile.body, 'project').id);
  assert(
    wrongRichFile.status === 404,
    `project accepted non-image rich-content file with ${wrongRichFile.status}`
  );

  const created = await createProject({
    title: `QA project ${RUN_ID}`,
    location: 'TP.HCM',
    project_year: 2026,
    description: 'Complete project description',
    content_html:
      `<p>Safe project</p><img src="/public/files/${context.projectContentImageFileId}" alt="QA">` +
      '<script>alert(1)</script>',
    image_file_id: context.imageFileId,
    review_status: 'approved',
    publish_status: 'published'
  });
  assert(created.ok, responseError(created));
  const project = record(created.body, 'project');
  context.projectId = project.id;
  context.projectSlug = project.slug;
  context.projectIds.push(project.id);
  assert(!String(project.content_html).includes('<script'), 'project HTML was not sanitized');
  await assertRichContentUsage(
    context.projectContentImageFileId,
    'project',
    context.projectId
  );
  const publicFile = await request(`/public/files/${context.projectContentImageFileId}`);
  assert(publicFile.ok, responseError(publicFile));
  return {
    project_id: project.id,
    bad_year_status: badYear.status,
    missing_status: missing.status,
    wrong_file_status: wrongFile.status,
    wrong_rich_file_status: wrongRichFile.status,
    rich_content_file_status: publicFile.status
  };
});

await runCase('PROJECT-GALLERY-INVARIANTS', 'Project gallery enforces image type, uniqueness, bounds, and lifecycle', async () => {
  const nonImage = await adminRequest(`/song-thanh/projects/${context.projectId}/gallery`, {
    method: 'POST',
    body: { file_id: context.documentFileId }
  });
  assert(nonImage.status === 404, `gallery accepted PDF with ${nonImage.status}`);

  const attached = await adminRequest(`/song-thanh/projects/${context.projectId}/gallery`, {
    method: 'POST',
    body: { file_id: context.mobileImageFileId, alt_text: 'QA gallery', sort_order: 32767 }
  });
  assert(attached.ok, responseError(attached));
  const gallery = record(attached.body, 'project_gallery');
  context.projectGalleryId = gallery.id;
  assert(
    gallery.created_by === context.logicUserId,
    `project gallery created_by=${gallery.created_by}`
  );

  const duplicate = await adminRequest(`/song-thanh/projects/${context.projectId}/gallery`, {
    method: 'POST',
    body: { file_id: context.mobileImageFileId }
  });
  assert(duplicate.status === 409, `duplicate gallery file returned ${duplicate.status}`);

  const saturatedDefault = await adminRequest(
    `/song-thanh/projects/${context.projectId}/gallery`,
    {
      method: 'POST',
      body: { file_id: context.imageFileId }
    }
  );
  assert(saturatedDefault.ok, responseError(saturatedDefault));
  const saturatedItem = record(saturatedDefault.body, 'project_gallery');
  assert(
    saturatedItem.sort_order === 32767,
    `automatic gallery sort_order exceeded SMALLINT: ${saturatedItem.sort_order}`
  );
  assertOk(
    await adminRequest(
      `/song-thanh/projects/${context.projectId}/gallery/${saturatedItem.id}`,
      { method: 'DELETE' }
    )
  );

  const duplicateReorder = await adminRequest(
    `/song-thanh/projects/${context.projectId}/gallery/reorder`,
    {
      method: 'POST',
      body: {
        items: [
          { id: context.projectGalleryId, sort_order: 1 },
          { id: context.projectGalleryId, sort_order: 2 }
        ]
      }
    }
  );
  assertError(duplicateReorder, 409, 'PROJECT_CONFLICT');

  assertOk(
    await adminRequest(
      `/song-thanh/projects/${context.projectId}/gallery/${context.projectGalleryId}`,
      { method: 'DELETE' }
    )
  );
  assertOk(
    await adminRequest(
      `/song-thanh/projects/${context.projectId}/gallery/${context.projectGalleryId}/restore`,
      { method: 'POST', body: {} }
    )
  );
  return {
    gallery_id: context.projectGalleryId,
    non_image_status: nonImage.status,
    duplicate_status: duplicate.status,
    saturated_default_sort_order: saturatedItem.sort_order
  };
});

await runCase('PROJECT-RELATION-LIFECYCLE', 'Project-product relation uses attach, detach, and restore without duplication', async () => {
  const attached = await adminRequest(`/song-thanh/projects/${context.projectId}/product-groups`, {
      method: 'POST',
      body: { product_group_id: context.productGroupId }
    });
  assertOk(attached);
  const attachedProjectRelation = (
    unwrap(attached.body)?.related_product_groups || []
  ).find(
    (item) => item.product_group?.id === context.productGroupId
  )?.association;
  assert(
    attachedProjectRelation?.created_by === context.logicUserId,
    `project relation created_by=${attachedProjectRelation?.created_by}`
  );
  const duplicate = await adminRequest(`/song-thanh/projects/${context.projectId}/product-groups`, {
    method: 'POST',
    body: { product_group_id: context.productGroupId }
  });
  assertError(duplicate, 409, 'PROJECT_CONFLICT');
  assertOk(
    await adminRequest(
      `/song-thanh/projects/${context.projectId}/product-groups/${context.productGroupId}`,
      { method: 'DELETE' }
    )
  );
  assertOk(
    await adminRequest(
      `/song-thanh/projects/${context.projectId}/product-groups/${context.productGroupId}/restore`,
      { method: 'POST', body: {} }
    )
  );
  return { duplicate_code: errorCode(duplicate) };
});

await runCase('PROJECT-ACTOR-MAJOR-EDIT', 'Project actors are retained and major edits reopen review', async () => {
  const detail = await adminRequest(`/song-thanh/projects/${context.projectId}`);
  assert(detail.ok, responseError(detail));
  const before = record(detail.body, 'project');
  assert(before.created_by === context.logicUserId, `created_by=${before.created_by}`);
  assert(before.approved_by === context.logicUserId, `approved_by=${before.approved_by}`);

  const edited = await adminRequest(`/song-thanh/projects/${context.projectId}`, {
    method: 'PUT',
    body: { description: `Major project edit ${RUN_ID}` }
  });
  assert(edited.ok, responseError(edited));
  const project = record(edited.body, 'project');
  assert(project.review_status === 'pending_review', `review_status=${project.review_status}`);
  assert(project.publish_status === 'unpublished', `publish_status=${project.publish_status}`);
  assert(project.updated_by === context.logicUserId, `updated_by=${project.updated_by}`);
  const publicProject = await request(`/public/projects/${context.projectSlug}`);
  assert(publicProject.status === 404, `major-edited project stayed public with ${publicProject.status}`);
  const hiddenFile = await request(`/public/files/${context.projectContentImageFileId}`);
  assert(hiddenFile.status === 404, `unpublished project file stayed public with ${hiddenFile.status}`);
  return {
    created_by: before.created_by,
    approved_by: before.approved_by,
    updated_by: project.updated_by,
    public_status: publicProject.status,
    rich_content_file_status: hiddenFile.status
  };
});

await runCase('RICH-CONTENT-RESTORE-DEPENDENCIES', 'Archived page, service, and project owners cannot be restored while a rich-content image is archived', async () => {
  const page = await assertRichContentRestoreDependency(
    `/song-thanh/page-contents/${context.pageId}`,
    context.pageContentImageFileId
  );
  const service = await assertRichContentRestoreDependency(
    `/song-thanh/services/${context.serviceId}`,
    context.serviceContentImageFileId
  );
  const project = await assertRichContentRestoreDependency(
    `/song-thanh/projects/${context.projectId}`,
    context.projectContentImageFileId
  );
  return { page, service, project };
});

await runCase('CONTENT-CLEANUP', 'All public-facing QA content is archived before downstream suites', async () => {
  const cleaned = await cleanup();
  return cleaned;
});

finish();

async function uploadFile(name, mimeType, bytes, purpose) {
  const form = new FormData();
  form.set('purpose', purpose);
  form.set('file', new Blob([bytes], { type: mimeType }), `qa-${RUN_ID}-${name}`);
  const response = await fetch(`${API_BASE_URL}/song-thanh/files/upload`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${context.accessToken}`,
      'X-Forwarded-For': QA_CLIENT_IP
    },
    body: form
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const result = {
    ok: response.ok,
    status: response.status,
    body,
    headers: response.headers
  };
  assert(result.ok, responseError(result));
  return String(record(result.body, 'file')?.id || '');
}

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4z8AAAAASUVORK5CYII=',
    'base64'
  );
}

async function assertRichContentUsage(fileId, entityType, entityId) {
  const response = await adminRequest(
    `/song-thanh/files/${fileId}/usages?deleted_scope=active`
  );
  assert(response.ok, responseError(response));
  const usage = (unwrap(response.body)?.usages || []).find(
    (item) =>
      item.entity_type === entityType &&
      item.entity_id === entityId &&
      item.field_name === 'content_html'
  );
  assert(Boolean(usage), `${entityType}.content_html file_usage was not created`);
  assert(!usage.deleted_at, `${entityType}.content_html file_usage is deleted`);
}

function createMenuItem(menuId, body) {
  return adminRequest(`/song-thanh/menus/${menuId}/items`, { method: 'POST', body });
}

function reorderMenu(items) {
  return adminRequest(`/song-thanh/menus/${context.menuId}/items/reorder`, {
    method: 'POST',
    body: { items }
  });
}

function archiveMenuItem(itemId) {
  return adminRequest(`/song-thanh/menu-items/${itemId}/archive`, {
    method: 'POST',
    body: {}
  });
}

function newestMenuItem(body) {
  const data = unwrap(body);
  const items = Array.isArray(data?.flat_items) ? data.flat_items : [];
  return items.find((item) => String(item.title || '').includes(RUN_ID)) || items.at(-1);
}

function menuItemByTitle(body, title) {
  const data = unwrap(body);
  const items = Array.isArray(data?.flat_items) ? data.flat_items : [];
  return items.find((item) => item.title === title);
}

function createRedirect(fromPath, toPath) {
  return adminRequest('/song-thanh/redirects', {
    method: 'POST',
    body: { from_path: fromPath, to_path: toPath, redirect_type: 301, status: 'active' }
  });
}

function createBanner(overrides = {}) {
  return adminRequest('/song-thanh/banners', {
    method: 'POST',
    body: {
      position: `qa-${RUN_ID}`,
      title: `QA banner ${RUN_ID}`,
      image_file_id: context.imageFileId,
      link_type: 'none',
      status: 'active',
      ...overrides
    }
  });
}

function updatePage(body) {
  return adminRequest(`/song-thanh/page-contents/${context.pageId}`, {
    method: 'PUT',
    body
  });
}

function createService(overrides = {}) {
  return adminRequest('/song-thanh/services', {
    method: 'POST',
    body: overrides
  });
}

function createProject(overrides = {}) {
  return adminRequest('/song-thanh/projects', {
    method: 'POST',
    body: overrides
  });
}

async function assertRichContentRestoreDependency(ownerRoute, fileId) {
  assertOk(
    await adminRequest(`${ownerRoute}/archive`, {
      method: 'POST',
      body: {}
    })
  );
  assertOk(
    await adminRequest(`/song-thanh/files/${fileId}/archive`, {
      method: 'POST',
      body: {}
    })
  );
  const blocked = await adminRequest(`${ownerRoute}/restore`, {
    method: 'POST',
    body: {}
  });
  assert(
    blocked.status === 404,
    `owner restored with archived rich-content image (${blocked.status})`
  );
  assertOk(
    await adminRequest(`/song-thanh/files/${fileId}/restore`, {
      method: 'POST',
      body: {}
    })
  );
  assertOk(
    await adminRequest(`${ownerRoute}/restore`, {
      method: 'POST',
      body: {}
    })
  );
  return { blocked_status: blocked.status, restored_after_file_restore: true };
}

async function cleanup() {
  const cleaned = {
    menu_items: 0,
    redirects: 0,
    banners: 0,
    pages: 0,
    services: 0,
    projects: 0
  };

  for (const itemId of [...new Set(context.menuItemIds)].filter(Boolean)) {
    const detail = await adminRequest(`/song-thanh/menus/${context.menuId}?item_deleted_scope=all`);
    const item = detail.ok
      ? (unwrap(detail.body)?.flat_items || []).find((candidate) => candidate.id === itemId)
      : null;
    if (item && !item.deleted_at) {
      const archived = await archiveMenuItem(itemId);
      if (archived.ok) cleaned.menu_items += 1;
    }
  }

  for (const [ids, basePath, key] of [
    [context.redirectIds, '/song-thanh/redirects', 'redirects'],
    [context.bannerIds, '/song-thanh/banners', 'banners'],
    [context.pageIds, '/song-thanh/page-contents', 'pages'],
    [context.serviceIds, '/song-thanh/services', 'services'],
    [context.projectIds, '/song-thanh/projects', 'projects']
  ]) {
    for (const id of [...new Set(ids)].filter(Boolean)) {
      const detail = await adminRequest(`${basePath}/${id}`).catch(() => null);
      const data = detail?.ok ? unwrap(detail.body) : null;
      const entity =
        data?.redirect || data?.banner || data?.page_content || data?.service || data?.project || data;
      if (!entity || entity.deleted_at) continue;
      const archived = await adminRequest(`${basePath}/${id}/archive`, {
        method: 'POST',
        body: {}
      });
      if (archived.ok) cleaned[key] += 1;
    }
  }
  return cleaned;
}

async function runCase(id, title, action) {
  const started = Date.now();
  try {
    const evidence = await withTimeout(
      Promise.resolve().then(action),
      Number(process.env.CONTENT_QA_CASE_TIMEOUT_MS || 20000),
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
  return { ok: response.ok, status: response.status, body, headers: response.headers };
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
    '# Content-domain invariant QA last run',
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
    'Data impact: this matrix mutates only a timestamped isolated QA database. All public-facing fixtures are archived before downstream suites.',
    '',
    'Generated by `node scripts/qa/content-domain-invariants-smoke.mjs`.'
  );
  writeFileSync(REPORT_PATH, `${lines.join('\n')}\n`, 'utf8');

  console.log(`\nContent-domain invariant QA run ${RUN_ID}`);
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
