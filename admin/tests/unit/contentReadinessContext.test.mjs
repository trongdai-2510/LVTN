import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateContentReadiness, getContentReadinessContext } from '../../src/features/website-content/page-content-studio/contentReadiness.ts';

test('system-page cover art is optional when public layouts have a fallback', () => {
  for (const mode of ['about', 'products', 'projects', 'services', 'brands', 'contact', 'generic']) {
    assert.equal(getContentReadinessContext(mode).expectFeaturedImage, false, mode);
  }
  assert.equal(getContentReadinessContext('news').expectFeaturedImage, true);
});

test('missing managed page body is a publish blocker, without claiming the whole public route is empty', () => {
  const result = evaluateContentReadiness({
    title: 'Hồ sơ năng lực',
    slug: 'ho-so-nang-luc',
    content_type: 'page',
    content_html: '',
    extra_blocks: { blocks: [] },
    review_status: 'approved',
    publish_status: 'unpublished'
  }, getContentReadinessContext('capability_profile'));
  const issue = result.blockingIssues.find((item) => item.code === 'content.body.required');
  assert.equal(issue?.title, 'Hồ sơ trang chưa đủ nội dung để xuất bản');
  assert.equal(issue?.action.target, '#page-section-body');
});
