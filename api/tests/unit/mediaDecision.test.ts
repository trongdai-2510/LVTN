import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeMediaDecision } from '../../src/modules/mediaIntake/mediaIntakeDecision';

const groupA = '00000000-0000-4000-8000-000000000001';
const groupB = '00000000-0000-4000-8000-000000000002';

test('a PDF may be attached to two product groups while staying private', () => {
  const decision = normalizeMediaDecision({
    mode: 'attach',
    attachments: [
      { kind: 'document', product_group_id: groupA, document_type: 'datasheet' },
      { kind: 'document', product_group_id: groupB, document_type: 'datasheet' }
    ]
  }, 'application/pdf');

  assert.equal(decision.attachments.length, 2);
  assert.ok(decision.attachments.every((item) => item.kind === 'document' && item.is_public === false));
});

test('an image cannot be attached twice to one gallery', () => {
  assert.throws(() => normalizeMediaDecision({
    mode: 'attach',
    attachments: [
      { kind: 'image', product_group_id: groupA },
      { kind: 'image', product_group_id: groupA, set_thumbnail: true }
    ]
  }, 'image/webp'));
});

test('a document cannot be treated as an image or made public through this workflow', () => {
  assert.throws(() => normalizeMediaDecision({ mode: 'attach', attachments: [
    { kind: 'image', product_group_id: groupA }
  ] }, 'application/pdf'));
  assert.throws(() => normalizeMediaDecision({ mode: 'attach', attachments: [
    { kind: 'document', product_group_id: groupA, is_public: true }
  ] }, 'application/pdf'));
});

test('skip requires no target and an attachment requires a valid group id', () => {
  assert.deepEqual(normalizeMediaDecision({ mode: 'skip' }, 'image/jpeg'), { mode: 'skip', attachments: [] });
  assert.throws(() => normalizeMediaDecision({ mode: 'attach', attachments: [
    { kind: 'image', product_group_id: 'wrong' }
  ] }, 'image/jpeg'));
});
