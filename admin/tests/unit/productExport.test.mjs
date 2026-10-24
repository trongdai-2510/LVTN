import assert from 'node:assert/strict';
import test from 'node:test';

import { indexProductDocuments, pairProductVariants } from '../../src/features/import-workspace/productExport.ts';

test('product export joins by group ID when names repeat and keeps groups without variants', () => {
  const groups = [
    { id: 'group-1', name: 'Cùng tên' },
    { id: 'group-2', name: 'Cùng tên' },
    { id: 'group-3', name: 'Không có biến thể' }
  ];
  const variants = [
    { id: 'variant-2', product_group_id: 'group-2', model_code: 'MA-2' },
    { id: 'variant-1', product_group_id: 'group-1', model_code: 'MA-1' },
    { id: 'variant-3', product_group_id: 'group-1', model_code: 'MA-3' },
    { id: 'orphan', product_group_id: 'group-4', model_code: 'MA-4' }
  ];

  assert.deepEqual(
    pairProductVariants(groups, variants).map(({ group, variant }) => [group.id, variant?.model_code ?? null]),
    [['group-1', 'MA-1'], ['group-1', 'MA-3'], ['group-2', 'MA-2'], ['group-3', null]]
  );
});

test('product documents include shared files and only files for the matching variant', () => {
  const documents = [
    { product_group_id: 'group-1', product_variant_id: null, document_name: 'Chung' },
    { product_group_id: 'group-1', product_variant_id: 'variant-1', document_name: 'Riêng 1' },
    { product_group_id: 'group-1', product_variant_id: 'variant-2', document_name: 'Riêng 2' },
    { product_group_id: 'group-2', product_variant_id: 'variant-1', document_name: 'Nhóm khác' }
  ];
  const forRow = indexProductDocuments(documents);
  assert.deepEqual(forRow('group-1', 'variant-1').map((item) => item.document_name), ['Chung', 'Riêng 1']);
  assert.deepEqual(forRow('group-1', 'variant-2').map((item) => item.document_name), ['Chung', 'Riêng 2']);
  assert.deepEqual(forRow('group-2', 'variant-1').map((item) => item.document_name), ['Nhóm khác']);
});
