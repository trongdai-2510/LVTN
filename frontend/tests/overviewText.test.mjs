import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOverviewHighlights, buildOverviewParts, partitionOverviewParts, resolveOverviewCopy } from '../src/features/product-detail/overviewText.ts';

test('a flattened product catalog becomes labeled rows without changing its values', () => {
  const parts = buildOverviewParts(
    'Cáp dùng cho lưới điện trên không. Mã hàng Tiết diện mm2 Dòng chịu tải A Đường kính tổng mm Khối lượng kg/km ' +
    'Loại 2 lõi LV-ABC-2x16 16 96 15,8 135 LV-ABC-2x25 25 125 18,4 197 ' +
    'Loại 3 lõi LV-ABC-3x16 16 78 17,1 203 TỔNG QUAN Dùng cho lưới điện hạ thế.'
  );

  const catalog = parts.find((part) => part.kind === 'catalog');
  assert.ok(catalog);
  assert.deepEqual(catalog.columns, [
    'Tiết diện mm2', 'Dòng chịu tải A', 'Đường kính tổng mm', 'Khối lượng kg/km'
  ]);
  assert.deepEqual(catalog.rows[1], {
    code: 'LV-ABC-2x25', group: 'Loại 2 lõi', values: ['25', '125', '18,4', '197']
  });
  assert.equal(catalog.rows[2].group, 'Loại 3 lõi');
  assert.equal(parts.at(-1)?.kind, 'text');
  assert.equal(parts.at(-1)?.title, 'TỔNG QUAN');
});

test('an ambiguous catalog remains readable text instead of inventing columns', () => {
  const parts = buildOverviewParts('Mã hàng Tiết diện mm2 Chất liệu Dòng chịu tải A ABC-1 10 Đồng 25 ABC-2 20 Đồng 30');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].kind, 'text');
  assert.match(parts[0].blocks[0].text, /Chất liệu.*ABC-2 20 Đồng 30/);
});

test('existing line breaks and bullet items remain separate blocks', () => {
  const parts = buildOverviewParts('Mô tả ngắn.\n- Dễ lắp đặt\n- Bền bỉ\nThông số khác.');
  assert.deepEqual(parts[0].blocks, [
    { kind: 'paragraph', text: 'Mô tả ngắn.' },
    { kind: 'list', items: ['Dễ lắp đặt', 'Bền bỉ'] },
    { kind: 'paragraph', text: 'Thông số khác.' }
  ]);
});

test('a heading phrase that continues into a sentence stays intact', () => {
  const parts = buildOverviewParts('Đặc điểm nổi bật của cáp điện Cadivi VCM 1. Ruột dẫn bằng đồng mềm.');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].title, null);
  assert.match(parts[0].blocks[0].text, /^Đặc điểm nổi bật của cáp điện/);
});

test('flattened feature labels are separated without discarding their copy', () => {
  const parts = buildOverviewParts(
    'Đặc Điểm Nổi Bật Cấu Trúc Chắc Chắn, Bền Bỉ Lõi dẫn bằng nhôm. ' +
    'An Toàn Cao, Chống Nhiễu Lớp cách điện XLPE giúp giảm nguy cơ chạm chập.'
  );
  assert.deepEqual(parts[0].blocks, [
    { kind: 'subheading', text: 'Cấu Trúc Chắc Chắn, Bền Bỉ' },
    { kind: 'paragraph', text: 'Lõi dẫn bằng nhôm.' },
    { kind: 'subheading', text: 'An Toàn Cao, Chống Nhiễu' },
    { kind: 'paragraph', text: 'Lớp cách điện XLPE giúp giảm nguy cơ chạm chập.' }
  ]);
});

test('overview highlights keep feature copy separate from later technical sections', () => {
  const parts = buildOverviewParts(
    'Đặc Điểm Nổi Bật Cấu Trúc Chắc Chắn, Bền Bỉ Lõi dẫn bằng nhôm. ' +
    'An Toàn Cao, Chống Nhiễu Cách điện XLPE. ĐẶC TÍNH KỸ THUẬT Điện áp 0,6/1kV.'
  );
  assert.deepEqual(buildOverviewHighlights(parts), [
    { title: 'Cấu Trúc Chắc Chắn, Bền Bỉ', description: 'Lõi dẫn bằng nhôm.' },
    { title: 'An Toàn Cao, Chống Nhiễu', description: 'Cách điện XLPE.' }
  ]);
});

test('legacy catalog and following technical text stay in the specifications tab', () => {
  const parts = buildOverviewParts(
    'Đặc Điểm Nổi Bật Cấu Trúc Chắc Chắn, Bền Bỉ Lõi nhôm bền. ' +
    'An Toàn Cao, Chống Nhiễu Cách điện XLPE. ' +
    'Mã hàng Tiết diện mm2 Dòng chịu tải A LV-ABC-2x16 16 96 LV-ABC-2x25 25 125 ' +
    'ĐẶC TÍNH KỸ THUẬT Điện áp 0,6/1kV. TỔNG QUAN Nhiệt độ làm việc 80°C.'
  );
  const partition = partitionOverviewParts(parts);
  assert.equal(partition.overviewParts.length, 1);
  assert.equal(partition.overviewParts[0].title, 'Đặc Điểm Nổi Bật');
  assert.deepEqual(partition.technicalParts.map((part) => part.kind === 'catalog' ? 'catalog' : part.title), [
    'catalog', 'ĐẶC TÍNH KỸ THUẬT', 'TỔNG QUAN'
  ]);
});

test('line breaks added in admin do not return an imported catalog to overview', () => {
  const parts = buildOverviewParts(
    'Đặc Điểm Nổi Bật Cấu Trúc Chắc Chắn, Bền Bỉ Lõi nhôm bền.\n' +
    'Mã hàng Tiết diện mm2 Dòng chịu tải A\n' +
    'LV-ABC-2x16 16 96\nLV-ABC-2x25 25 125\n' +
    'ĐẶC TÍNH KỸ THUẬT Điện áp 0,6/1kV.'
  );
  const partition = partitionOverviewParts(parts);
  assert.deepEqual(partition.technicalParts.map((part) => part.kind), ['catalog', 'text']);
  assert.equal(partition.overviewParts.length, 1);
  assert.equal(partition.overviewParts[0].title, 'Đặc Điểm Nổi Bật');
});

test('admin-authored paragraphs remain in overview rather than moving to specifications', () => {
  const parts = buildOverviewParts('Mô tả do admin viết.\n- Phù hợp lắp đặt ngoài trời');
  const partition = partitionOverviewParts(parts);
  assert.equal(partition.overviewParts.length, 1);
  assert.equal(partition.technicalParts.length, 0);
});

test('admin-authored multiline descriptions keep their own paragraphs and bullets', () => {
  const parts = buildOverviewParts('Đặc Điểm Nổi Bật\nChi tiết do admin viết.\n- Dễ lắp đặt');
  assert.deepEqual(parts, [{
    kind: 'text',
    title: null,
    blocks: [
      { kind: 'paragraph', text: 'Đặc Điểm Nổi Bật' },
      { kind: 'paragraph', text: 'Chi tiết do admin viết.' },
      { kind: 'list', items: ['Dễ lắp đặt'] }
    ]
  }]);
});

test('admin short description controls the visible overview independently', () => {
  assert.deepEqual(resolveOverviewCopy('  Giới thiệu do admin viết. ', 'Nội dung chi tiết.'), {
    summary: 'Giới thiệu do admin viết.',
    detail: 'Nội dung chi tiết.'
  });
  assert.deepEqual(resolveOverviewCopy('Cùng một câu.', 'Cùng một câu.'), {
    summary: 'Cùng một câu.',
    detail: ''
  });
});

test('legacy descriptions still supply a short fallback without repeating it', () => {
  const copy = resolveOverviewCopy('', 'Cáp điện dùng trên không. Thiết kế an toàn. Đặc Điểm Nổi Bật Lõi nhôm.');
  assert.equal(copy.summary, 'Cáp điện dùng trên không. Thiết kế an toàn.');
  assert.equal(copy.detail, 'Đặc Điểm Nổi Bật Lõi nhôm.');
});
