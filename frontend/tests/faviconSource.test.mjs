import assert from 'node:assert/strict';
import test from 'node:test';

import { readFaviconImage, resolveManagedFaviconUrl } from '../src/lib/security/faviconSource.ts';

const fileId = '123e4567-e89b-42d3-a456-426614174000';

test('favicon fetch accepts only managed public file URLs', () => {
  assert.equal(
    resolveManagedFaviconUrl(`/public/files/${fileId}`, 'http://localhost:4000'),
    `http://localhost:4000/public/files/${fileId}`
  );

  for (const source of [
    'http://169.254.169.254/latest/meta-data/',
    '//169.254.169.254/latest/meta-data/',
    'data:image/png;base64,AAAA',
    `/public/files/${fileId}?next=http://localhost`,
    `/public/files/${fileId}/../health`,
    `/public/files/%2e%2e/health`
  ]) {
    assert.equal(resolveManagedFaviconUrl(source, 'http://localhost:4000'), null, source);
  }
});

test('favicon response rejects non-images and oversized bodies', async () => {
  await assert.rejects(
    readFaviconImage(new Response('secret', { headers: { 'content-type': 'text/plain' } })),
    /content type/
  );
  await assert.rejects(
    readFaviconImage(new Response(new Uint8Array(1_000_001), {
      headers: { 'content-type': 'image/png' }
    })),
    /size limit/
  );
  assert.equal(
    await readFaviconImage(new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { 'content-type': 'image/png' }
    })),
    'data:image/png;base64,iVBORw=='
  );
});
