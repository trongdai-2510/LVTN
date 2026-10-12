import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizePublicSearchSlugQuery,
  publicSearchPatterns
} from '../../src/common/text/searchnormalization';

test('public search folds Vietnamese accents and spaces to the stored slug form', () => {
  assert.equal(normalizePublicSearchSlugQuery('Đồng hồ đo nước'), 'dong-ho-do-nuoc');
  assert.equal(normalizePublicSearchSlugQuery('  TƯ VẤN  kỹ thuật  '), 'tu-van-ky-thuat');
});

test('public search preserves the original text pattern and never turns unsupported text into a match-all slug', () => {
  assert.deepEqual(publicSearchPatterns('Đong'), {
    textPattern: '%Đong%',
    textPrefixPattern: 'Đong%',
    slugQuery: 'dong',
    slugPattern: '%dong%',
    slugPrefixPattern: 'dong%'
  });
  assert.deepEqual(publicSearchPatterns('日本'), {
    textPattern: '%日本%',
    textPrefixPattern: '日本%',
    slugQuery: '日本',
    slugPattern: '%日本%',
    slugPrefixPattern: '日本%'
  });
});
