import assert from 'node:assert/strict';
import test from 'node:test';

import { buildVariantPickerPlan } from '../src/features/product-detail/variant-config.ts';

function variant(id, name, temperature, highlightedTemperature) {
  return {
    id,
    model_code: id,
    variant_name: name,
    spec_groups: [{
      id: `attributes:${id}`,
      group_name: 'Thông số biến thể',
      items: [{
        id: `cct:${id}`,
        spec_name: 'Nhiệt độ màu (CCT)',
        spec_value: temperature,
        sort_order: 1
      }]
    }],
    highlight_specs: highlightedTemperature === undefined ? [] : [{
      id: `highlight:${id}`,
      display_label: 'Nhiệt độ màu (CCT)',
      display_value: highlightedTemperature,
      sort_order: 1
    }]
  };
}

test('the variant picker uses the saved CCT highlight instead of a malformed stale attribute', () => {
  const variants = [
    variant('DLBL2-9T', 'Đèn led 9W AST', '6000', '6000'),
    variant('DLBL2-9N', 'Đèn led 9W trung tính', '4000 (1', '4000')
  ];
  const plan = buildVariantPickerPlan(variants, {
    categoryName: 'Đèn LED',
    productName: 'Đèn led downlight viền bạc phi 140mm'
  });
  const temperatureGroup = plan.groups.find((group) => group.id === 'light-color');

  assert.equal(plan.mode, 'attribute');
  assert.deepEqual(temperatureGroup?.options.map((option) => option.displayValue), ['6000', '4000']);
  assert.equal(plan.items[1].groupValues['light-color']?.displayValue, '4000');
});

test('an incomplete parenthesized CCT value is never exposed as a configuration option', () => {
  const plan = buildVariantPickerPlan([
    variant('DLBL2-9T', 'Đèn led 9W AST', '6000', '6000'),
    variant('DLBL2-9N', 'Đèn led 9W trung tính', '4000 (1')
  ], { categoryName: 'Đèn LED' });

  assert.ok(plan.groups.every((group) =>
    group.options.every((option) => !option.displayValue.includes('4000 (1'))
  ));
});
