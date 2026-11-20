import assert from 'node:assert/strict';
import test from 'node:test';

import { readProductFeatures, writeProductFeatures } from '../../src/features/product-domain/productFeatures.ts';
import { buildOverviewHighlights, buildOverviewParts, partitionOverviewParts } from '../../../frontend/src/features/product-detail/overviewText.ts';

const legacy =
  'Cáp dùng cho lưới điện. Đặc Điểm Nổi Bật ' +
  'Cấu Trúc Chắc Chắn, Bền Bỉ Lõi nhôm bền. Cách điện XLPE. ' +
  'An Toàn Cao, Chống Nhiễu Lắp đặt an toàn. ' +
  'Chịu Được Môi Trường Khắc Nghiệt Chống tia UV. ' +
  'Tiết Kiệm Chi Phí, Dễ Lắp Đặt Dễ vận chuyển. ' +
  'Lựa chọn Cáp LV-ABC Mã hàng Tiết diện mm2 Dòng chịu tải A ' +
  'LV-ABC-2x16 16 96 LV-ABC-2x25 25 125 ' +
  'ĐẶC TÍNH KỸ THUẬT Điện áp 0,6/1kV.';

test('admin separates four legacy features while preserving all other product copy', () => {
  const draft = readProductFeatures(legacy);
  assert.equal(draft.source, 'legacy');
  assert.deepEqual(draft.features.map((item) => item.title), [
    'Cấu Trúc Chắc Chắn, Bền Bỉ',
    'An Toàn Cao, Chống Nhiễu',
    'Chịu Được Môi Trường Khắc Nghiệt',
    'Tiết Kiệm Chi Phí, Dễ Lắp Đặt'
  ]);
  assert.match(draft.content, /^Cáp dùng cho lưới điện\./);
  assert.match(draft.content, /Lựa chọn Cáp LV-ABC Mã hàng/);
  assert.match(draft.content, /ĐẶC TÍNH KỸ THUẬT Điện áp/);
});

test('edited admin features round-trip into the website overview without losing the catalog', () => {
  const draft = readProductFeatures(legacy);
  const edited = [
    { title: 'Dễ thi công', description: 'Gọn nhẹ và thuận tiện lắp đặt.' },
    ...draft.features.slice(0, 3)
  ];
  const saved = writeProductFeatures(draft.content, edited);
  assert.deepEqual(readProductFeatures(saved).features, edited);
  const revised = readProductFeatures(saved);
  const savedAgain = writeProductFeatures(revised.content, revised.features.slice().reverse());
  assert.equal(savedAgain.match(/\[\[PRODUCT_FEATURES_V1\]\]/g)?.length, 1);
  assert.equal(readProductFeatures(savedAgain).features[0].title, edited.at(-1).title);
  const parts = buildOverviewParts(saved);
  const partition = partitionOverviewParts(parts);
  assert.deepEqual(buildOverviewHighlights(partition.overviewParts).map((item) => item.title), edited.map((item) => item.title));
  assert.ok(partition.technicalParts.some((part) => part.kind === 'catalog'));
  assert.ok(partition.technicalParts.some((part) => part.kind === 'text' && part.title === 'ĐẶC TÍNH KỸ THUẬT'));
});

test('incomplete managed content is reported instead of silently discarding it', () => {
  const broken = 'Thông tin cũ. [[PRODUCT_FEATURES_V1]] {"title":"A"}';
  const draft = readProductFeatures(broken);
  assert.equal(draft.source, 'invalid');
  assert.equal(draft.content, broken);
});

test('new products can add and remove features without changing their other description', () => {
  const source = 'Mô tả chung.\n- Dùng ngoài trời';
  const saved = writeProductFeatures(source, [{ title: 'Dễ sử dụng', description: 'Thao tác nhanh.' }]);
  const draft = readProductFeatures(saved);
  assert.equal(draft.content, source);
  assert.deepEqual(draft.features, [{ title: 'Dễ sử dụng', description: 'Thao tác nhanh.' }]);
  assert.equal(writeProductFeatures(draft.content, []), source);
});
