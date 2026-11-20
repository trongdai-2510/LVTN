import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeMediaSourcePath } from '../../src/modules/mediaIntake/mediaIntakeGuardrails';

test('media source path keeps a relative folder while accepting processed image extensions', () => {
  assert.equal(
    normalizeMediaSourcePath('Brand/ABC-100/front.jpg', 'front.webp'),
    'Brand/ABC-100/front.jpg'
  );
  assert.equal(normalizeMediaSourcePath(undefined, 'front.webp'), 'front.webp');
});

test('media source path cannot claim a different filename or escape its batch', () => {
  for (const path of ['../front.jpg', '/root/front.jpg', 'C:\\front.jpg', 'folder//front.jpg', 'folder/other.jpg']) {
    assert.throws(() => normalizeMediaSourcePath(path, 'front.webp'));
  }
});
