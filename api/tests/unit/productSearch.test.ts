import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { rankProductMatches } from '../../src/modules/product-group/productSearch';

const groups = [
  { id: 'pipe', name: 'Ống luồn dây điện' },
  { id: 'clamp', name: 'Kẹp ống D20' },
  { id: 'system', name: 'Hệ thống điện' },
  { id: 'waterproof', name: 'CB chống giật' },
  { id: 'copper', name: 'Van cửa đồng' },
  { id: 'cadivi', name: 'Dây cáp điện Cadivi CVV-4×185' },
  { id: 'switch', name: 'Công tắc điện' },
  { id: 'relay', name: 'Rơ le nhiệt' },
  { id: 'mt800', name: 'Rơ le MT-800 (400-630A)' }
];
const variants = [
  { product_group_id: 'switch', variant_name: 'Công tắc 20A', sku: 'ST-20A', external_code: null, model_code: null },
  { product_group_id: 'relay', variant_name: 'Rơ le nhiệt 4-50A', sku: 'MT-63 (3)-50A', external_code: null, model_code: null }
];

test('Vietnamese search matches whole word starts, with or without accents', () => {
  assert.deepEqual(result('ống'), { ids: ['pipe', 'clamp'], mode: 'exact' });
  assert.deepEqual(result('ong'), { ids: ['pipe', 'clamp'], mode: 'exact' });
  assert.deepEqual(result('ỐNG L'), { ids: ['pipe'], mode: 'exact' });
});

test('search ranks names and SKU, accepts unordered terms and multiplication sign', () => {
  assert.deepEqual(result('cadivi cáp'), { ids: ['cadivi'], mode: 'exact' });
  assert.deepEqual(result('4x185'), { ids: ['cadivi'], mode: 'exact' });
  assert.deepEqual(result('185'), { ids: ['cadivi'], mode: 'exact' });
  assert.deepEqual(result('ST-20A'), { ids: ['switch'], mode: 'exact' });
  assert.deepEqual(result('công tắc ST-20A'), { ids: ['switch'], mode: 'exact' });
  assert.deepEqual(result('rơ le MT-63'), { ids: ['relay'], mode: 'exact' });
});

test('a typo has a near-match fallback only when no direct match exists', () => {
  assert.deepEqual(result('cavidi'), { ids: ['cadivi'], mode: 'near' });
  assert.deepEqual(result('ongg'), { ids: ['pipe', 'clamp'], mode: 'near' });
  assert.deepEqual(result('ống'), { ids: ['pipe', 'clamp'], mode: 'exact' });
});

test('search punctuation is literal and cannot match everything', () => {
  assert.deepEqual(result('.*'), { ids: [], mode: 'none' });
  assert.deepEqual(result('%'), { ids: [], mode: 'none' });
});

function result(query: string) {
  const search = rankProductMatches(groups, variants, query);
  return { ids: search.matches.map((match) => match.id), mode: search.mode };
}
