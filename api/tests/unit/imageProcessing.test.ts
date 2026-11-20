import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { processImageBuffer } from '../../src/modules/file/image-processor';

const sharp: typeof import('sharp').default = require('sharp');

test('processable uploads are converted to WebP instead of silently retaining the original', async () => {
  const source = await sharp({
    create: { width: 240, height: 160, channels: 3, background: '#dddddd' }
  }).png().toBuffer();

  const processed = await processImageBuffer(source, '.png');

  assert.ok(processed);
  assert.equal(processed.extension, '.webp');
  assert.equal(processed.mimeType, 'image/webp');
  assert.equal((await sharp(processed.buffer).metadata()).format, 'webp');
});
