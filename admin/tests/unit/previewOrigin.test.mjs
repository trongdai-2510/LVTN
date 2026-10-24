import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/lib/previewOrigin.ts');
const source = readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const module = { exports: {} };
new Function('module', 'exports', output)(module, module.exports);
const { previewOrigin } = module.exports;

test('preview messaging accepts only an explicit HTTP origin', () => {
  assert.equal(previewOrigin('https://website.example/admin-preview/brand-page'), 'https://website.example');
  assert.equal(previewOrigin('http://localhost:3000'), 'http://localhost:3000');
  for (const url of ['', '/admin-preview/brand-page', 'javascript:alert(1)', 'data:text/html,hello', 'https://user:pass@website.example']) {
    assert.equal(previewOrigin(url), null, url);
  }
});
