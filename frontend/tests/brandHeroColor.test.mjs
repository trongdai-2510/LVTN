import assert from 'node:assert/strict';
import test from 'node:test';

import { readableHeroColor, contrastAgainstWhite } from '../src/features/partners/brandHeroColor.ts';

test('keeps a readable chosen color unchanged', () => {
  assert.equal(readableHeroColor('#004AB4', '#0b1c30'), '#004ab4');
});

test('darkens a bright chosen color without replacing its hue with the fallback', () => {
  for (const [chosen, fallback] of [['#F3DD4F', '#0b1c30'], ['#10A2C6', '#334155']]) {
    const rendered = readableHeroColor(chosen, fallback);
    assert.notEqual(rendered, fallback);
    assert.ok(contrastAgainstWhite(rendered) >= 4.5);
  }
});

test('uses the fallback only for a missing or invalid color', () => {
  assert.equal(readableHeroColor(null, '#334155'), '#334155');
  assert.equal(readableHeroColor('not-a-color', '#334155'), '#334155');
});
