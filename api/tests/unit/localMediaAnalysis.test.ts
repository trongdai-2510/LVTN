import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeLocalAnalysisOutput, pdfTextForPrompt, verifyLocalAnalysisOutput } from '../../src/modules/mediaIntake/localMediaAnalysis';

test('PDF prompt stays bounded and retains a labelled model from later text', () => {
  const content = `${'Thông tin catalogue chung.\n'.repeat(220)}\nMã sản phẩm: ABC-100\nThông số khác`;
  const selected = pdfTextForPrompt(content);
  assert.ok(selected.length <= 2400);
  assert.match(selected, /Mã sản phẩm: ABC-100/);
});

test('file reading shows observed text and avoids contradictory model uncertainty', () => {
  const result = normalizeLocalAnalysisOutput({
    observed_codes: ['32GRc-15A'],
    visible_text: ['32GRc-15A', '15A', '2P'],
    description: 'Thiết bị công suất 15A, hai pha',
    uncertainty: 'Không có mã model rõ ràng trong ảnh, chỉ có mã 32GRc-15A'
  }, 1);
  assert.deepEqual(result.observed_codes, ['32GRc-15A']);
  assert.match(result.description, /32GRc-15A/);
  assert.doesNotMatch(result.description, /công suất|hai pha/);
  assert.doesNotMatch(result.uncertainty, /Không có mã/);
  assert.equal(result.analyzed_pages, 1);
});

test('file reading retains a specific uncertainty when it does not contradict the observed code', () => {
  const result = normalizeLocalAnalysisOutput({
    observed_codes: ['ABC-100'], visible_text: ['ABC-100'],
    uncertainty: 'Ảnh bị cắt ở góc phải.'
  }, 0);
  assert.equal(result.uncertainty, 'Ảnh bị cắt ở góc phải.');
});

test('file without an observed code avoids unsupported model explanations', () => {
  const result = normalizeLocalAnalysisOutput({
    observed_codes: [], visible_text: ['CATALOGUE THU NGHIEM'],
    uncertainty: 'Không có tiêu đề hoặc thông tin thương hiệu.'
  }, 0);
  assert.deepEqual(result.observed_codes, []);
  assert.match(result.uncertainty, /chưa đọc được mã model\/SKU/);
  assert.doesNotMatch(result.uncertainty, /không có tiêu đề/i);
});

test('image display hides unverified OCR prose and rejects codes absent from its transcription', () => {
  const raw = normalizeLocalAnalysisOutput({
    observed_codes: ['ABC-100'], visible_text: ['Tối đa 6 cụm chữ', 'Ranger'],
    description: 'Sản phẩm công suất lớn', uncertainty: ''
  }, 0);
  const result = verifyLocalAnalysisOutput(raw, 'image/jpeg', '');
  assert.deepEqual(result.observed_codes, []);
  assert.deepEqual(result.visible_text, []);
  assert.match(result.description, /chưa xác minh được mã/);
  assert.doesNotMatch(result.description, /Ranger|công suất/);
});

test('image code remains a tentative suggestion when repeated in visible text', () => {
  const raw = normalizeLocalAnalysisOutput({
    observed_codes: ['32GRc-15A'], visible_text: ['Mã 32GRc-15A'], uncertainty: ''
  }, 0);
  const result = verifyLocalAnalysisOutput(raw, 'image/jpeg', '', '32GRc-15A');
  assert.deepEqual(result.observed_codes, ['32GRc-15A']);
  assert.deepEqual(result.visible_text, ['32GRc-15A']);
  assert.match(result.description, /cần xem file để xác nhận/);
});

test('independent OCR rejects a visually hallucinated code', () => {
  const raw = normalizeLocalAnalysisOutput({
    observed_codes: ['R-1000'], visible_text: ['R-1000'], uncertainty: ''
  }, 0);
  const result = verifyLocalAnalysisOutput(raw, 'image/jpeg', '', 'COALS\nASL Wp Oi');
  assert.deepEqual(result.observed_codes, []);
  assert.deepEqual(result.visible_text, []);
});

test('PDF code must also occur in extracted PDF text when available', () => {
  const raw = normalizeLocalAnalysisOutput({
    observed_codes: ['ABC-100', 'FAKE-42'], visible_text: ['ABC-100', 'FAKE-42']
  }, 1);
  const result = verifyLocalAnalysisOutput(raw, 'application/pdf', 'Mã sản phẩm: ABC-100\nThông số kỹ thuật');
  assert.deepEqual(result.observed_codes, ['ABC-100']);
  assert.match(result.description, /Mã sản phẩm: ABC-100/);
  assert.doesNotMatch(result.description, /FAKE-42/);
});

test('electrical measurements are not treated as product codes', () => {
  const result = normalizeLocalAnalysisOutput({ observed_codes: [
    '32GRc-15A', '2P / 30mA / 1.5kA', '15A, 2P, 30mA', '30mA', 'A96/400VX'
  ] }, 0);
  assert.deepEqual(result.observed_codes, ['32GRc-15A', 'A96/400VX']);
});

test('PDF model output keeps only the code after a product label', () => {
  const raw = normalizeLocalAnalysisOutput({
    observed_codes: ['Ma san pham: 32GRc-15A', '15A, 2P, 30mA'],
    visible_text: ['Ma san pham: 32GRc-15A', '15A, 2P, 30mA']
  }, 1);
  const result = verifyLocalAnalysisOutput(raw, 'application/pdf', 'Ma san pham: 32GRc-15A\nCB chong giat 15A, 2P, 30mA');
  assert.deepEqual(result.observed_codes, ['32GRc-15A']);
});
