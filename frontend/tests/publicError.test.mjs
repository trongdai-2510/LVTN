import assert from 'node:assert/strict';
import test from 'node:test';

import { PublicApiError, publicFetcher } from '../src/lib/api/public-fetcher.ts';

test('public request errors do not display raw API text', () => {
  const error = new PublicApiError('internal_column must satisfy constraint', 400,
    'VALIDATION_ERROR', { field: 'internal_column' });
  assert.doesNotMatch(error.message, /internal_column|constraint|VALIDATION_ERROR/);
  assert.equal(error.status, 400);
  assert.equal(error.code, 'VALIDATION_ERROR');
});

test('network failures do not retain a raw cause in public errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('private network detail'); };
  try {
    await assert.rejects(publicFetcher('/public/test'), (error) => {
      assert.ok(error instanceof PublicApiError);
      assert.equal(error.code, 'PUBLIC_API_UNAVAILABLE');
      assert.equal(error.details, null);
      assert.doesNotMatch(JSON.stringify(error), /private network detail/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
