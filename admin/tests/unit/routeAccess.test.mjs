import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/lib');

function loadModule(name, imports = {}) {
  const source = readFileSync(path.join(root, `${name}.ts`), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(
    (specifier) => {
      if (specifier in imports) return imports[specifier];
      throw new Error(`Unexpected import: ${specifier}`);
    },
    module,
    module.exports
  );
  return module.exports;
}

const permissions = loadModule('permissions');
const routeMap = loadModule('route-map', {
  '@/components/icons': new Proxy({}, { get: () => function Icon() {} }),
  './permissions': permissions
});
const routes = loadModule('route-permissions', { './permissions': permissions });

test('every permission-bound navigation link has the same direct-route guard', () => {
  const links = routeMap.sidebarGroups.flatMap((group) =>
    group.items.flatMap((item) => [item, ...(item.children ?? [])])
  );
  for (const link of links) {
    if (!link.permission) continue;
    assert.equal(routes.getRoutePermission(link.href), link.permission, link.href);
  }
});
