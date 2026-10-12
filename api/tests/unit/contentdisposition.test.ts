import { strict as assert } from 'node:assert';
import { validateHeaderValue } from 'node:http';
import { test } from 'node:test';

import { buildContentDisposition } from '../../src/common/http/contentdisposition';

test('content disposition keeps Unicode names in filename* and an ASCII-safe fallback', () => {
  const header = buildContentDisposition(
    'inline',
    'Ảnh sản phẩm “Mẫu”\r\n2026.png'
  );

  assert.doesNotThrow(() => validateHeaderValue('Content-Disposition', header));
  assert.match(header, /^inline; filename="[\x20-\x7e]+"; filename\*=UTF-8''/);
  assert.equal(header.includes('\r'), false);
  assert.equal(header.includes('\n'), false);
  assert.match(header, /%E1%BA%A2nh%20s%E1%BA%A3n%20ph%E1%BA%A9m/);
});

test('content disposition does not fail on an empty name or an unpaired surrogate', () => {
  for (const filename of ['', '\ud800.png']) {
    const header = buildContentDisposition('attachment', filename);
    assert.doesNotThrow(() => validateHeaderValue('Content-Disposition', header));
  }
});
