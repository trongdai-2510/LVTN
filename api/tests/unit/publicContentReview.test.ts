import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { reopenPublishedContentAfterMajorEdit } from '../../src/common/workflow/public-content-review';

const current = {
  content_html: '<p>Nội dung cũ</p>',
  review_status: 'approved',
  publish_status: 'published'
};

test('an ordinary save reopens review and hides a materially changed published row', () => {
  const mutation: { content_html: string; review_status?: string; publish_status?: string } = {
    content_html: '<p>Nội dung mới</p>'
  };
  reopenPublishedContentAfterMajorEdit(current, mutation, ['content_html']);
  assert.deepEqual(mutation, {
    content_html: '<p>Nội dung mới</p>',
    review_status: 'pending_review',
    publish_status: 'unpublished'
  });
});

test('an explicit approve-and-publish request stays published after a material edit', () => {
  const mutation = {
    content_html: '<p>Nội dung mới</p>',
    review_status: 'approved',
    publish_status: 'published'
  };
  reopenPublishedContentAfterMajorEdit(current, mutation, ['content_html']);
  assert.equal(mutation.review_status, 'approved');
  assert.equal(mutation.publish_status, 'published');
});

test('a Super Admin save keeps a materially changed published row public', () => {
  const mutation: { content_html: string; review_status?: string; publish_status?: string } = {
    content_html: '<p>Nội dung mới</p>'
  };
  reopenPublishedContentAfterMajorEdit(current, mutation, ['content_html'], true);
  assert.deepEqual(mutation, { content_html: '<p>Nội dung mới</p>' });
});
