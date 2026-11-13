import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMediaMatchIndex, suggestMediaMatches } from '../../src/modules/file/mediaMatch';

const products = [
  { groupId: 'group-a', variantId: 'a100', modelCode: 'ABC-100', sku: 'STSKU-GENERATED-A' },
  { groupId: 'group-a', variantId: 'a1000', modelCode: 'ABC-1000', sku: 'REAL-1000' },
  { groupId: 'group-b', variantId: 'b200', modelCode: 'XYZ-200', sku: 'REAL-200' }
];

test('an exact model code in the filename produces a unique suggestion with evidence', () => {
  const result = suggestMediaMatches('photos/01_ABC-100_front.jpg', products);

  assert.equal(result.status, 'unique');
  assert.deepEqual(result.candidates.map((candidate) => candidate.variantId), ['a100']);
  assert.deepEqual(result.candidates[0].evidence, [
    { source: 'filename', field: 'modelCode', value: 'ABC-100' }
  ]);
});

test('a product folder can identify a generically named file', () => {
  const result = suggestMediaMatches('XYZ-200/IMG_001.jpg', products);

  assert.equal(result.status, 'unique');
  assert.deepEqual(result.candidates.map((candidate) => candidate.variantId), ['b200']);
  assert.equal(result.candidates[0].evidence[0].source, 'folder');
});

test('a shorter code does not match inside another model code', () => {
  const result = suggestMediaMatches('ABC-1000.jpg', products);

  assert.equal(result.status, 'unique');
  assert.deepEqual(result.candidates.map((candidate) => candidate.variantId), ['a1000']);
});

test('the same code on two products remains ambiguous', () => {
  const result = suggestMediaMatches('ABC-100.jpg', [
    products[0],
    { groupId: 'group-c', variantId: 'c100', modelCode: 'ABC100' }
  ]);

  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates.map((candidate) => candidate.variantId), ['a100', 'c100']);
});

test('contradictory folder and filename codes remain ambiguous', () => {
  const result = suggestMediaMatches('ABC-100/XYZ-200.jpg', products);

  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates.map((candidate) => candidate.variantId), ['b200', 'a100']);
});

test('generated import codes and generic filenames do not create suggestions', () => {
  const generated = suggestMediaMatches('STSKU-GENERATED-A.jpg', products);
  const generic = suggestMediaMatches('IMG_001.jpg', products);

  assert.equal(generated.status, 'unmatched');
  assert.deepEqual(generated.candidates, []);
  assert.equal(generic.status, 'unmatched');
  assert.deepEqual(generic.candidates, []);
});

test('a code read from file content can suggest a product with content evidence', () => {
  const match = buildMediaMatchIndex(products);
  const result = match('IMG_001.jpg', ['XYZ-200']);

  assert.equal(result.status, 'unique');
  assert.deepEqual(result.candidates.map((candidate) => candidate.variantId), ['b200']);
  assert.deepEqual(result.candidates[0].evidence, [
    { source: 'content', field: 'modelCode', value: 'XYZ-200' }
  ]);
});

test('a conflicting filename and content code stays ambiguous', () => {
  const result = buildMediaMatchIndex(products)('ABC-100.jpg', ['XYZ-200']);

  assert.equal(result.status, 'ambiguous');
  assert.deepEqual(result.candidates.map((candidate) => candidate.variantId), ['b200', 'a100']);
});
