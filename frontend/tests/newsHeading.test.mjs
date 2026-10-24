import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNewsHeading } from '../src/features/news/newsHeading.ts';

test('uses the edited page title on the news landing even when a banner is present', () => {
  assert.deepEqual(resolveNewsHeading('Góc tin Song Thanh', [{ display_mode: 'image_only' }]), {
    title: 'Góc tin Song Thanh',
    tag: 'h1'
  });
  assert.deepEqual(resolveNewsHeading('Góc tin Song Thanh', [{ display_mode: 'content_overlay' }]), {
    title: 'Góc tin Song Thanh',
    tag: 'h2'
  });
});

test('uses one visible h1 when the news landing has no banner', () => {
  assert.deepEqual(resolveNewsHeading('  ', []), {
    title: 'Tin tức & Sự kiện',
    tag: 'h1'
  });
});
