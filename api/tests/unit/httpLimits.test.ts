import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { configureHttpLimits } from '../../src/common/security/httpLimits';

test('HTTP server rejects slow headers and incomplete requests within bounded time', () => {
  const server = createServer();
  try {
    configureHttpLimits(server);
    assert.equal(server.headersTimeout, 20_000);
    assert.equal(server.requestTimeout, 120_000);
    assert.equal(server.timeout, 120_000);
    assert.equal(server.maxHeadersCount, 100);
  } finally {
    server.close();
  }
});
