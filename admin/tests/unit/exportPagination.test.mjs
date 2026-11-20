import assert from 'node:assert/strict';
import test from 'node:test';

import { collectExportPages } from '../../src/features/import-workspace/exportPagination.ts';

test('collectExportPages returns every row when the last page is within the limit', async () => {
  const requestedPages = [];
  const rows = await collectExportPages({
    maxPages: 3,
    pageSize: 2,
    fetchPage: async (page) => {
      requestedPages.push(page);
      return {
        items: page === 1 ? ['a', 'b'] : ['c'],
        pageCount: 2,
        total: 3
      };
    }
  });

  assert.deepEqual(requestedPages, [1, 2]);
  assert.deepEqual(rows, ['a', 'b', 'c']);
});

test('collectExportPages rejects oversized exports before creating a partial file', async () => {
  const requestedPages = [];
  await assert.rejects(
    collectExportPages({
      maxPages: 2,
      pageSize: 2,
      fetchPage: async (page) => {
        requestedPages.push(page);
        return { items: ['a', 'b'], pageCount: 3, total: 6 };
      }
    }),
    /không tạo file.*thiếu dữ liệu/i
  );
  assert.deepEqual(requestedPages, [1]);
});

test('collectExportPages rejects a truncated response even within the page limit', async () => {
  await assert.rejects(
    collectExportPages({
      maxPages: 2,
      pageSize: 2,
      fetchPage: async () => ({ items: ['a'], pageCount: 1, total: 2 })
    }),
    /không tạo file.*thiếu dữ liệu/i
  );
});
