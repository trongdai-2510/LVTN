import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

import ts from 'typescript';

const source = readFileSync(
  new URL('../src/features/product-detail/ProductQuickSpecs.tsx', import.meta.url),
  'utf8'
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS }
}).outputText;
const componentModule = { exports: {} };
new Function('require', 'module', 'exports', compiled)(
  createRequire(import.meta.url),
  componentModule,
  componentModule.exports
);
const { buildQuickSpecs } = componentModule.exports;

test('all saved highlight specs stay in order on the public product page', () => {
  const highlights = Array.from({ length: 17 }, (_, index) => ({
    id: `highlight-${index}`,
    display_label: `Thông số ${index + 1}`,
    display_value: String(index + 1)
  }));

  const items = buildQuickSpecs([], highlights, [], [], 6);

  assert.equal(items.length, 17);
  assert.deepEqual(items.map((item) => item.value), highlights.map((item) => item.display_value));
});
