import 'reflect-metadata';

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  buildPublicSpecFacetGroups,
  mergeSelectedPublicSpecFacetGroups
} from '../../src/modules/public/public.service';

test('public spec facets keep canonical groups, deduplicate counts, and cap option floods', () => {
  const dimensionRows = Array.from({ length: 120 }, (_, index) => ({
    product_group_id: `group-${index}`,
    spec_name: 'Kích thước',
    spec_value: `${index + 1}x${index + 2}mm`
  }));
  dimensionRows.push({
    product_group_id: 'group-duplicate',
    spec_name: 'Kích thước',
    spec_value: '1x2mm'
  });

  const groups = buildPublicSpecFacetGroups([
    ...dimensionRows,
    {
      product_group_id: 'group-packaging',
      spec_name: 'Đóng gói',
      spec_value: 'Hộp 10 chiếc'
    }
  ]);
  const sizeGroup = groups.find((group) => group.key === 'size');

  assert.equal(groups.some((group) => group.key.startsWith('raw:')), false);
  assert.equal(sizeGroup?.options.length, 100);
  assert.equal(
    sizeGroup?.options.find((option) => option.label === '1x2mm')?.count,
    2
  );
});

test('selected legacy raw facets remain visible even when unselected raw groups are suppressed', () => {
  const selection = {
    group_key: 'raw:bao hanh',
    option_key: '24 thang',
    matchers: [{ spec_name: 'Bảo hành', spec_value: '24 tháng' }]
  };
  const groups = mergeSelectedPublicSpecFacetGroups({
    baseGroups: [],
    scopedGroups: [],
    selections: [selection]
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, selection.group_key);
  assert.equal(groups[0].label, 'Bảo hành');
  assert.equal(groups[0].options.length, 1);
  assert.equal(groups[0].options[0].label, '24 tháng');
  assert.equal(groups[0].options[0].count, 0);
});
