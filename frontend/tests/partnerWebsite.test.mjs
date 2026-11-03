import test from 'node:test';
import assert from 'node:assert/strict';
import { partnerWebsite } from '../src/features/partners/partnerWebsite.ts';

test('partner links accept only ordinary HTTP URLs without embedded credentials', () => {
  assert.equal(partnerWebsite('https://example.com/'), 'https://example.com/');
  assert.equal(partnerWebsite('http://example.com'), 'http://example.com/');
  assert.equal(partnerWebsite('javascript:alert(1)'), null);
  assert.equal(partnerWebsite('https://user:secret@example.com'), null);
  assert.equal(partnerWebsite('not-a-url'), null);
});
