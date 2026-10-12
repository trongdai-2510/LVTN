import assert from 'node:assert/strict';
import test from 'node:test';

import { lockBodyScroll } from '../../src/lib/bodyScrollLock.ts';

test('overlapping scroll locks restore the original body overflow after the last release', () => {
  const priorDocument = globalThis.document;
  globalThis.document = { body: { style: { overflow: 'auto' } } };
  try {
    const releaseModal = lockBodyScroll();
    const releaseDrawer = lockBodyScroll();
    assert.equal(document.body.style.overflow, 'hidden');
    releaseModal();
    assert.equal(document.body.style.overflow, 'hidden');
    releaseDrawer();
    releaseDrawer();
    assert.equal(document.body.style.overflow, 'auto');
  } finally {
    globalThis.document = priorDocument;
  }
});
