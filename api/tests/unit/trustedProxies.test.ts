import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import express = require('express');

import { parseTrustedProxies } from '../../src/config/env';

test('proxy trust is disabled unless explicit IP ranges are configured', () => {
  assert.deepEqual(parseTrustedProxies(undefined), []);
  assert.deepEqual(parseTrustedProxies(''), []);
  assert.deepEqual(parseTrustedProxies('127.0.0.1, 10.0.0.0/24, ::1/128'), [
    '127.0.0.1',
    '10.0.0.0/24',
    '::1/128'
  ]);
});

test('proxy trust rejects hop counts, catch-all ranges and malformed addresses', () => {
  for (const value of ['1', 'true', '0.0.0.0/0', '::/0', '127.0.0.1/33', 'not-a-proxy']) {
    assert.throws(() => parseTrustedProxies(value), /TRUSTED_PROXY_CIDRS/);
  }
});

test('a direct HTTP client cannot override its address with X-Forwarded-For', async () => {
  const app = express();
  const trustedProxies = parseTrustedProxies(undefined);
  app.set('trust proxy', trustedProxies.length > 0 ? trustedProxies : false);
  app.get('/ip', (request, response) => response.json({ ip: request.ip }));
  const server = app.listen(0, '127.0.0.1');

  try {
    await once(server, 'listening');
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/ip`, {
      headers: { 'X-Forwarded-For': '198.51.100.99' }
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ip, '127.0.0.1');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
