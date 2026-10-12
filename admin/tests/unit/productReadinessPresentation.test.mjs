import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateProductReadiness } from '../../src/features/product-domain/productReadiness.ts';
import {
  getProductReadinessNotice,
  productIssueAnchor,
  sectionForProductIssue
} from '../../src/features/product-domain/productReadinessPresentation.ts';

const base = {
  name: 'Cáp điện',
  slug: 'cap-dien',
  category_id: 'category-2',
  category_level_1_id: 'category-1',
  category_level_2_id: 'category-2',
  thumbnail_file_id: 'file-1',
  short_description: 'Cáp dùng cho công trình.',
  status: 'active',
  review_status: 'approved',
  publish_status: 'unpublished'
};

test('pending review is shown ahead of optional SEO and document suggestions', () => {
  const readiness = evaluateProductReadiness({ ...base, review_status: 'pending_review' });
  const notice = getProductReadinessNotice(readiness);

  assert.equal(notice.kind, 'workflow');
  assert.equal(notice.issue?.code, 'product_publish_requires_approval');
  assert.equal(notice.issue?.title, 'Đang chờ duyệt');
  assert.equal(notice.issue?.action, 'Xem trạng thái duyệt');
  assert.match(notice.summary, /duyệt/i);
  assert.equal(sectionForProductIssue(notice.issue), 'main');
  assert.equal(productIssueAnchor(notice.issue), '#product-group-display');
});

test('a workflow-only blocker cannot be presented as a fully ready product', () => {
  const readiness = evaluateProductReadiness({
    ...base,
    review_status: 'draft',
    seo_title: 'Cáp điện',
    seo_description: 'Thiết bị điện cho công trình.'
  }, { active_variants: 1, active_images: 1, active_documents: 1 });

  assert.equal(readiness.qualityIssues.length, 0);
  assert.equal(getProductReadinessNotice(readiness).kind, 'workflow');
  assert.equal(readiness.workflowIssues[0]?.title, 'Chưa gửi duyệt');
});

test('an archived record never links to a status panel that may be absent', () => {
  const readiness = evaluateProductReadiness({
    ...base,
    deleted_at: '2026-10-10T00:00:00.000Z'
  });
  const archivedIssue = readiness.workflowIssues.find((item) => item.code === 'product_archived');

  assert.ok(archivedIssue);
  assert.equal(sectionForProductIssue(archivedIssue), 'main');
  assert.equal(productIssueAnchor(archivedIssue), '');
});

test('the main image action points to the section containing its picker', () => {
  const readiness = evaluateProductReadiness({ ...base, thumbnail_file_id: null });
  const issue = readiness.publicationIssues.find((item) => item.field === 'thumbnail_file_id');

  assert.ok(issue);
  assert.equal(sectionForProductIssue(issue), 'main');
});
