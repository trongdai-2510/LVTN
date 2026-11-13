import assert from 'node:assert/strict';
import test from 'node:test';

import { isAssignmentRequest, likelyTaskSpeech, meansAllFiles, requestedProduct, taskIsCurrent, taskProductHint, targetFromCandidates, targetFromSearch } from '../../src/features/mediaAssistant/mediaTask.ts';

const item = {
  id: 'file-1', source_path: 'ABC-100/front.jpg', mime_type: 'image/jpeg', status: 'suggested',
  candidates: [{ groupId: 'group-1', variantId: 'variant-1', groupName: 'Sản phẩm A', variantName: 'ABC-100',
    evidence: [{ source: 'filename', field: 'modelCode', value: 'ABC-100' }] }],
  local_analysis: null
};

test('extracts a product instruction that accompanies a file', () => {
  assert.equal(isAssignmentRequest('Gắn ảnh này cho sản phẩm ABC-100'), true);
  assert.equal(isAssignmentRequest('Gắn front.jpg cho ABC-100'), true);
  assert.equal(requestedProduct('Gắn ảnh này cho sản phẩm ABC-100'), 'ABC-100');
  assert.equal(requestedProduct('Đưa PDF này vào sản phẩm ABC-100'), 'ABC-100');
  assert.equal(meansAllFiles('Gắn tất cả file cho ABC-100'), true);
  assert.equal(meansAllFiles('Gắn file này cho ABC-100'), false);
  assert.equal(isAssignmentRequest('Cho tôi xem sản phẩm nào thiếu ảnh trước khi gán'), false);
  assert.equal(isAssignmentRequest('Đính kèm ảnh này vào mã ABC-100'), true);
  assert.equal(isAssignmentRequest('Làm sao gắn ảnh cho sản phẩm?'), false);
  assert.equal(likelyTaskSpeech('Đính kèm ảnh này vào mã ABC-100'), true);
  assert.equal(taskProductHint({ intent: 'assign', target_text: 'model ABC-100', file_name: '', all_files: false, needs_clarification: false }, ''), 'ABC-100');
});

test('uses a unique project match and never infers an unresolved target', () => {
  const task = targetFromCandidates(item, 'ABC-100');
  assert.equal(task?.attachment.product_variant_id, 'variant-1');
  assert.equal(targetFromCandidates(item, 'XYZ-200'), null);
  const search = targetFromSearch({ ...item, candidates: [] }, 'ABC-100', [
    { id: 'group-1', name: 'Sản phẩm A', search_match: { field: 'model_code', value: 'ABC-100' } }
  ]);
  assert.equal(search?.attachment.product_group_id, 'group-1');
  assert.equal(targetFromSearch(item, 'ABC-100', [
    { id: 'group-1', name: 'Sản phẩm A', search_match: { field: 'model_code', value: 'ABC-100' } },
    { id: 'group-2', name: 'Sản phẩm B', search_match: { field: 'model_code', value: 'ABC-100' } }
  ]), null);
});

test('a conflicting code blocks an unsolicited assignment proposal', () => {
  const conflicting = { ...item, local_analysis: { observed_codes: ['XYZ-200'] } };
  assert.equal(targetFromCandidates(conflicting, ''), null);
  assert.match(targetFromCandidates(conflicting, 'ABC-100')?.warning ?? '', /XYZ-200/);
});

test('a proposal expires when AI reads new evidence for the same file', () => {
  const task = targetFromCandidates(item, 'ABC-100');
  assert.ok(task);
  assert.equal(taskIsCurrent(task, { items: [item] }), true);
  assert.equal(taskIsCurrent(task, { items: [{ ...item, local_analysis: { observed_codes: ['XYZ-200'] } }] }), false);
  assert.equal(taskIsCurrent(task, { items: [{ ...item, local_analysis: { observed_codes: [], visible_text: [] } }] }), false);
  assert.equal(taskIsCurrent(task, { items: [{ ...item, status: 'applied' }] }), false);
});
