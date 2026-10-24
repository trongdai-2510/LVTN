import assert from 'node:assert/strict';
import test from 'node:test';

import { selectHomeBannerSource } from '../src/lib/homeBannerSelection.ts';

test('custom automatic banner position is honored', () => {
  assert.deepEqual(
    selectHomeBannerSource({ mode: 'auto', position: 'homepage-hero', banner_ids: [] }),
    { mode: 'position', position: 'homepage-hero' }
  );
});

test('default automatic banners keep the page-path fallback', () => {
  assert.deepEqual(
    selectHomeBannerSource({ mode: 'auto', position: 'hero', banner_ids: [] }),
    { mode: 'default' }
  );
});

test('an empty manual selection does not silently display automatic banners', () => {
  assert.deepEqual(
    selectHomeBannerSource({ mode: 'manual', position: 'hero', banner_ids: [] }),
    { mode: 'none' }
  );
});

test('manual banner order remains the order chosen in admin', () => {
  assert.deepEqual(
    selectHomeBannerSource({ mode: 'manual', position: 'hero', banner_ids: ['banner-b', 'banner-a'] }),
    { mode: 'ids', ids: ['banner-b', 'banner-a'] }
  );
});
