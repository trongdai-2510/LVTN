import assert from 'node:assert/strict';
import test from 'node:test';

import { PublicApiError } from '../src/lib/api/public-fetcher.ts';

test('public request errors do not display raw API text', () => {
  const error = new PublicApiError('internal_column must satisfy constraint', 400,
    'VALIDATION_ERROR', { field: 'internal_column' });
  assert.doesNotMatch(error.message, /internal_column|constraint|VALIDATION_ERROR/);
  assert.equal(error.status, 400);
  assert.equal(error.code, 'VALIDATION_ERROR');
});
