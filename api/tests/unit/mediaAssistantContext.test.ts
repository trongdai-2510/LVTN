import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { answerFromEvidence } from '../../src/modules/mediaIntake/mediaAssistantAnswer';
import { buildMediaAssistantContext } from '../../src/modules/mediaIntake/mediaAssistantContext';
import type { MediaBatchRow, MediaItemRow } from '../../src/modules/mediaIntake/mediaIntakeRepository';

test('assistant includes a named file beyond the first twelve and keeps the context bounded', () => {
  const items = Array.from({ length: 25 }, (_, index) => ({
    id: `item-${index}`, source_path: index === 24 ? 'A6CLR/front.jpg' : `IMG_${index}.jpg`,
    original_filename: index === 24 ? 'front.jpg' : `IMG_${index}.jpg`,
    mime_type: 'image/jpeg', status: 'suggested',
    candidates: index === 24 ? [{ groupName: 'Đèn báo dọn phòng', variantName: 'A6CLR',
      evidence: [{ source: 'folder', field: 'modelCode', value: 'A6CLR' }] }] : [],
    local_analysis: null, error_message: null
  })) as unknown as MediaItemRow[];
  const context = buildMediaAssistantContext({ batch_name: 'Ảnh tháng 11', status: 'open' } as MediaBatchRow,
    items, 'Vì sao A6CLR/front.jpg được gợi ý?');

  assert.equal(context.batch.total_files, 25);
  assert.equal(context.items.length, 12);
  assert.equal(context.omitted_files, 13);
  assert.equal(context.items[0].id, 'item-24');
  assert.equal(context.items[0].candidates[0].evidence[0].source, 'folder');
  assert.equal(context.batch.evidence_counts.unread, 25);
  assert.equal(context.batch.evidence_counts.path_only, 1);
});

test('quick questions list unresolved files and codes from stored evidence', () => {
  const context = buildMediaAssistantContext({ batch_name: 'Ảnh tháng 11', status: 'open' } as MediaBatchRow,
    [{ id: 'one', source_path: 'IMG_001.jpg', original_filename: 'IMG_001.jpg', mime_type: 'image/jpeg',
      status: 'unmatched', candidates: [], local_analysis: { observed_codes: ['A6CLR'] }, error_message: null }] as unknown as MediaItemRow[],
    'File nào chưa rõ sản phẩm?');

  assert.match(answerFromEvidence('File nào chưa rõ sản phẩm?', context)?.answer ?? '', /IMG_001.jpg/);
  assert.match(answerFromEvidence('AI đã đọc được mã nào từ file?', context)?.answer ?? '', /A6CLR/);
});

test('assistant names a product once when group and variant names are identical', () => {
  const context = buildMediaAssistantContext({ batch_name: 'QA', status: 'open' } as MediaBatchRow,
    [{ id: 'one', source_path: 'qa-upload.jpg', original_filename: 'qa-upload.webp', mime_type: 'image/webp',
      status: 'suggested', local_analysis: { observed_codes: ['32GRc-15A'] }, error_message: null,
      candidates: [{ groupName: 'CB chống giật 15A', variantName: 'CB chống giật 15A',
        evidence: [{ source: 'content', field: 'modelCode', value: '32GRc-15A' }] }] }] as unknown as MediaItemRow[],
    'Vì sao qa-upload.jpg được gợi ý?');
  const answer = answerFromEvidence('Vì sao qa-upload.jpg được gợi ý?', context)?.answer ?? '';
  assert.match(answer, /CB chống giật 15A/);
  assert.doesNotMatch(answer, /CB chống giật 15A — CB chống giật 15A/);
});

test('a filename candidate with a different observed code becomes the first review task', () => {
  const context = buildMediaAssistantContext({ batch_name: 'Ảnh mới', status: 'open' } as MediaBatchRow,
    [
      { id: 'conflict', source_path: 'ABC-100.jpg', original_filename: 'ABC-100.jpg', mime_type: 'image/jpeg',
        status: 'suggested', local_analysis: { observed_codes: ['XYZ-200'] },
        candidates: [{ groupName: 'Sản phẩm A', variantName: 'ABC-100',
          evidence: [{ source: 'filename', field: 'modelCode', value: 'ABC-100' }] }] },
      { id: 'clear', source_path: 'DEF-300.jpg', original_filename: 'DEF-300.jpg', mime_type: 'image/jpeg',
        status: 'suggested', local_analysis: { observed_codes: ['DEF-300'] },
        candidates: [{ groupName: 'Sản phẩm B', variantName: 'DEF-300',
          evidence: [{ source: 'content', field: 'modelCode', value: 'DEF-300' }] }] }
    ] as unknown as MediaItemRow[], 'File nào cần xử lý trước?');
  const priority = answerFromEvidence('File nào cần xử lý trước?', context);
  assert.equal(priority?.referenced_item_ids[0], 'conflict');
  assert.match(priority?.answer ?? '', /XYZ-200.*không khớp/);
  assert.deepEqual(context.batch.evidence_counts, { content_verified: 1, path_only: 1, conflicts: 1, unread: 0 });
  const audit = answerFromEvidence('Có mã nào mâu thuẫn không?', context);
  assert.match(audit?.answer ?? '', /1 file có mã nội dung không khớp/);
  assert.deepEqual(audit?.referenced_item_ids, ['conflict']);
  const explanation = answerFromEvidence('Vì sao ABC-100.jpg được gợi ý?', context);
  assert.match(explanation?.answer ?? '', /XYZ-200.*không khớp/);
});

test('review question identifies actual files and evidence instead of generic advice', () => {
  const context = buildMediaAssistantContext({ batch_name: 'QA', status: 'open' } as MediaBatchRow,
    [{ id: 'one', source_path: 'front.jpg', original_filename: 'front.webp', mime_type: 'image/webp',
      status: 'suggested', local_analysis: { observed_codes: ['32GRc-15A'] }, error_message: null,
      candidates: [{ groupName: 'CB chống giật 15A', variantName: 'CB chống giật 15A',
        evidence: [{ source: 'content', field: 'modelCode', value: '32GRc-15A' }] }] }] as unknown as MediaItemRow[],
    'Có gì cần kiểm tra trước khi áp dụng?');
  const answer = answerFromEvidence('Có gì cần kiểm tra trước khi áp dụng?', context);
  assert.match(answer?.answer ?? '', /front.jpg/);
  assert.match(answer?.answer ?? '', /32GRc-15A/);
  assert.deepEqual(answer?.referenced_item_ids, ['one']);
  const priority = answerFromEvidence('Em nên ưu tiên xử lý file nào và vì sao?', context);
  assert.match(priority?.answer ?? '', /front.jpg/);
  assert.match(priority?.answer ?? '', /32GRc-15A/);
});

test('assistant summarizes candidates without calling an unmatched file suggested', () => {
  const context = buildMediaAssistantContext({ batch_name: 'Ảnh mới', status: 'open' } as MediaBatchRow,
    [
      { id: 'image', source_path: 'front.jpg', original_filename: 'front.jpg', mime_type: 'image/jpeg', status: 'suggested',
        local_analysis: { observed_codes: ['ABC-100'] }, candidates: [{ groupName: 'Sản phẩm A', variantName: 'Sản phẩm A',
          evidence: [{ source: 'content', field: 'modelCode', value: 'ABC-100' }] }] },
      { id: 'unknown', source_path: 'unknown.jpg', original_filename: 'unknown.jpg', mime_type: 'image/jpeg', status: 'unmatched',
        local_analysis: { observed_codes: [] }, candidates: [] }
    ] as unknown as MediaItemRow[], 'Tóm tắt lượt này');
  const answer = answerFromEvidence('Tóm tắt lượt này: file nào cần xử lý?', context);
  assert.match(answer?.answer ?? '', /1 file có một sản phẩm được gợi ý/);
  assert.match(answer?.answer ?? '', /1 file chưa có gợi ý/);
  assert.match(answer?.answer ?? '', /unknown\.jpg/);
  assert.deepEqual(answer?.referenced_item_ids, ['unknown', 'image']);
});

test('assistant compares both files and distinguishes suggestions from attachment', () => {
  const context = buildMediaAssistantContext({ batch_name: 'Ảnh mới', status: 'open' } as MediaBatchRow,
    [
      { id: 'image', source_path: 'front.jpg', original_filename: 'front.jpg', mime_type: 'image/jpeg', status: 'suggested',
        local_analysis: { observed_codes: ['ABC-100'] }, candidates: [{ groupName: 'Sản phẩm A', variantName: 'Sản phẩm A',
          evidence: [{ source: 'content', field: 'modelCode', value: 'ABC-100' }] }] },
      { id: 'pdf', source_path: 'sheet.pdf', original_filename: 'sheet.pdf', mime_type: 'application/pdf', status: 'suggested',
        local_analysis: { observed_codes: ['ABC-100'] }, candidates: [{ groupName: 'Sản phẩm A', variantName: 'Sản phẩm A',
          evidence: [{ source: 'content', field: 'modelCode', value: 'ABC-100' }] }] }
    ] as unknown as MediaItemRow[], 'Vì sao front.jpg và sheet.pdf cùng được gợi ý?');
  const comparison = answerFromEvidence('Vì sao front.jpg và sheet.pdf cùng được gợi ý?', context);
  assert.match(comparison?.answer ?? '', /front\.jpg/);
  assert.match(comparison?.answer ?? '', /sheet\.pdf/);
  assert.match(comparison?.answer ?? '', /ABC-100/);
  assert.deepEqual(comparison?.referenced_item_ids, ['image', 'pdf']);
  const shared = answerFromEvidence('File nào cùng mã ABC-100?', context);
  assert.match(shared?.answer ?? '', /front\.jpg/);
  assert.match(shared?.answer ?? '', /sheet\.pdf/);
  assert.match(shared?.answer ?? '', /chưa chứng minh.*trùng nội dung/);
  assert.deepEqual(shared?.referenced_item_ids, ['image', 'pdf']);
  assert.match(answerFromEvidence('AI có thể tự gán các file này luôn không?', context)?.answer ?? '', /Admin phải xem file/);
  assert.match(answerFromEvidence('Đã gán file nào chưa?', context)?.answer ?? '', /0 file đã gán/);
});

test('quality limits answer names actual files and separates content from filename evidence', () => {
  const context = buildMediaAssistantContext({ batch_name: 'QA', status: 'open' } as MediaBatchRow,
    [
      { id: 'image', source_path: 'qa-image.jpg', original_filename: 'qa-image.jpg', mime_type: 'image/jpeg', status: 'suggested',
        local_analysis: { observed_codes: ['32GRc-15A'] }, candidates: [{ groupName: 'CB chống giật', variantName: 'CB chống giật',
          evidence: [{ source: 'content', field: 'modelCode', value: '32GRc-15A' }] }] },
      { id: 'pdf', source_path: 'ABC-100.pdf', original_filename: 'ABC-100.pdf', mime_type: 'application/pdf', status: 'suggested',
        local_analysis: null, candidates: [{ groupName: 'Sản phẩm A', variantName: 'Sản phẩm A',
          evidence: [{ source: 'filename', field: 'modelCode', value: 'ABC-100' }] }] }
    ] as unknown as MediaItemRow[], 'Dữ liệu trong lượt này có giới hạn gì khi đánh giá chất lượng ảnh và PDF?');
  const result = answerFromEvidence('Dữ liệu trong lượt này có giới hạn gì khi đánh giá chất lượng ảnh và PDF?', context);
  assert.match(result?.answer ?? '', /qa-image\.jpg.*32GRc-15A/);
  assert.match(result?.answer ?? '', /ABC-100\.pdf.*tên file/);
  assert.match(result?.answer ?? '', /chưa đánh giá độ nét ảnh/);
  assert.deepEqual(result?.referenced_item_ids, ['image', 'pdf']);
});

test('assistant follows one referenced file without guessing another', () => {
  const items = Array.from({ length: 20 }, (_, index) => ({
    id: `file-${index}`, source_path: `photo-${index}.jpg`, original_filename: `photo-${index}.jpg`,
    mime_type: 'image/jpeg', status: 'unmatched', local_analysis: { observed_codes: [] }, candidates: []
  })) as unknown as MediaItemRow[];
  const batch = { batch_name: 'Ảnh mới', status: 'open' } as MediaBatchRow;
  const focused = buildMediaAssistantContext(batch, items, 'Còn file đó thì sao?', ['file-19']);
  assert.equal(focused.items[0].id, 'file-19');
  assert.deepEqual(focused.focus_files, ['photo-19.jpg']);
  assert.deepEqual(answerFromEvidence('Còn file đó thì sao?', focused)?.referenced_item_ids, ['file-19']);
  assert.match(answerFromEvidence('Còn gì cần kiểm tra về file đó?', focused)?.answer ?? '', /photo-19\.jpg/);
  assert.match(answerFromEvidence('Sao vậy?', focused)?.answer ?? '', /photo-19\.jpg/);
  assert.match(answerFromEvidence('Tiếp theo làm gì?', focused)?.answer ?? '', /photo-19\.jpg/);

  const unknown = buildMediaAssistantContext(batch, items.slice(0, 2), 'Còn file đó thì sao?');
  assert.match(answerFromEvidence('Còn file đó thì sao?', unknown)?.answer ?? '', /chưa biết bạn đang nói tới file nào/);
  assert.match(answerFromEvidence('Sao vậy?', unknown)?.answer ?? '', /chưa biết bạn đang nói tới file nào/);
  const twoFocused = buildMediaAssistantContext(batch, items.slice(0, 2), 'Còn file đó thì sao?', ['file-0', 'file-1']);
  assert.match(answerFromEvidence('Còn file đó thì sao?', twoFocused)?.answer ?? '', /chưa biết bạn đang nói tới file nào/);
});

test('assistant distinguishes skipped files and refuses unverified specifications', () => {
  const context = buildMediaAssistantContext({ batch_name: 'Ảnh mới', status: 'applied' } as MediaBatchRow,
    [{ id: 'one', source_path: 'front.pdf', original_filename: 'front.pdf', mime_type: 'application/pdf',
      status: 'skipped', local_analysis: { observed_codes: ['ABC-100'], description: 'Chữ AI đọc được: 15A' },
      candidates: [{ groupName: 'Sản phẩm A', variantName: 'Sản phẩm A',
        evidence: [{ source: 'content', field: 'modelCode', value: 'ABC-100' }] }] }] as unknown as MediaItemRow[],
    'Những file đã bỏ qua có bị gán vào sản phẩm không?');
  const skipped = answerFromEvidence('Những file đã bỏ qua có bị gán vào sản phẩm không?', context);
  assert.match(skipped?.answer ?? '', /1 file đã được bỏ qua/);
  assert.match(skipped?.answer ?? '', /không gán file/);
  assert.doesNotMatch(skipped?.answer ?? '', /chưa có một sản phẩm rõ ràng/);
  const power = answerFromEvidence('Sản phẩm trong front.pdf có công suất bao nhiêu?', context);
  assert.match(power?.answer ?? '', /chưa có thông số kỹ thuật đã xác thực/);
  assert.doesNotMatch(power?.answer ?? '', /15A/);
  const pages = answerFromEvidence('front.pdf có bao nhiêu trang?', context);
  assert.match(pages?.answer ?? '', /chưa lưu tổng số trang/);
  const focused = buildMediaAssistantContext({ batch_name: 'Ảnh mới', status: 'applied' } as MediaBatchRow,
    [{ id: 'one', source_path: 'front.pdf', original_filename: 'front.pdf', mime_type: 'application/pdf',
      status: 'skipped', local_analysis: { observed_codes: [] }, candidates: [] }] as unknown as MediaItemRow[],
    'Cần kiểm tra gì về file đó?', ['one']);
  assert.match(answerFromEvidence('Cần kiểm tra gì về file đó?', focused)?.answer ?? '', /đã được bỏ qua/);
  assert.match(answerFromEvidence('Tiếp theo làm gì?', focused)?.answer ?? '', /đã được bỏ qua/);
});
