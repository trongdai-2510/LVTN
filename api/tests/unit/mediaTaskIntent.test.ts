import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeMediaTaskIntent } from '../../src/modules/mediaIntake/mediaTaskIntent';

test('model task hints remain proposals tied to words the admin actually sent', () => {
  const result = normalizeMediaTaskIntent({ intent: 'assign', target_text: 'ABC-100', file_name: 'made-up.jpg',
    all_files: true, needs_clarification: false }, 'Đính kèm ảnh này vào mã ABC-100');
  assert.equal(result.intent, 'assign');
  assert.equal(result.target_text, 'ABC-100');
  assert.equal(result.file_name, '');
  assert.equal(result.all_files, false);
});

test('explicit all-files instruction and a real filename survive validation', () => {
  const result = normalizeMediaTaskIntent({ intent: 'assign', target_text: 'Đèn A', file_name: 'front.jpg',
    all_files: true, needs_clarification: false }, 'Gắn toàn bộ file front.jpg cho Đèn A');
  assert.equal(result.file_name, 'front.jpg');
  assert.equal(result.all_files, true);
});

test('questions and ambiguous references cannot become confident assignments', () => {
  const question = normalizeMediaTaskIntent({ intent: 'query', target_text: 'ABC-100', file_name: '',
    all_files: false, needs_clarification: false }, 'Cho tôi xem sản phẩm nào thiếu ảnh trước khi gán');
  assert.equal(question.intent, 'query');
  const misclassified = normalizeMediaTaskIntent({ intent: 'assign', target_text: 'ABC-100' },
    'Cho tôi xem sản phẩm nào thiếu ảnh trước khi gán');
  assert.equal(misclassified.intent, 'query');
  const ambiguous = normalizeMediaTaskIntent({ intent: 'assign', target_text: 'DLV2-9N', file_name: 'front.jpg',
    all_files: false, needs_clarification: false }, 'Tôi gửi front.jpg rồi, cái bên cạnh là của mã DLV2-9N');
  assert.equal(ambiguous.needs_clarification, true);
  assert.equal(ambiguous.file_name, '');
});
