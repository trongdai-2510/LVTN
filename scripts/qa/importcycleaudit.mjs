import {
  existsSync,
  readFileSync,
  readdirSync
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..', '..');
const require = createRequire(import.meta.url);
const ts = require(path.join(workspaceRoot, 'admin', 'node_modules', 'typescript'));

const sourceRoots = [
  path.join(workspaceRoot, 'admin', 'src'),
  path.join(workspaceRoot, 'api', 'src'),
  path.join(workspaceRoot, 'frontend', 'src')
];
const sourceExtensions = ['.ts', '.tsx', '.mts', '.cts'];

const sourceFiles = sourceRoots.flatMap(collectSourceFiles).map(path.normalize);
const sourceFileSet = new Set(sourceFiles);
const graph = new Map(
  sourceFiles.map((filename) => [filename, moduleDependencies(filename)])
);
const cycles = stronglyConnectedComponents(graph).filter(
  (component) =>
    component.length > 1 ||
    (component.length === 1 && graph.get(component[0])?.includes(component[0]))
);

console.log(`Import cycle audit: ${sourceFiles.length} source files`);
if (cycles.length === 0) {
  console.log('PASS No circular source dependencies found.');
  process.exit(0);
}

console.error(`FAIL Found ${cycles.length} circular dependency group(s):`);
for (const component of cycles) {
  console.error(
    component
      .map((filename) => path.relative(workspaceRoot, filename))
      .sort()
      .join(' -> ')
  );
}
process.exit(1);

function collectSourceFiles(directory) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(filename);
    if (!entry.isFile() || entry.name.endsWith('.d.ts')) return [];
    return sourceExtensions.includes(path.extname(entry.name)) ? [filename] : [];
  });
}

function moduleDependencies(filename) {
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    false,
    filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const dependencies = new Set();

  source.forEachChild((node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const resolved = resolveSourceModule(filename, node.moduleSpecifier.text);
      if (resolved) dependencies.add(resolved);
    }
  });

  return [...dependencies];
}

function resolveSourceModule(importer, specifier) {
  let candidate;
  if (specifier.startsWith('.')) {
    candidate = path.resolve(path.dirname(importer), specifier);
  } else if (specifier.startsWith('@/')) {
    const sourceRoot = sourceRoots.find((root) => isInside(root, importer));
    if (!sourceRoot) return null;
    candidate = path.resolve(sourceRoot, specifier.slice(2));
  } else {
    return null;
  }

  const extension = path.extname(candidate);
  const withoutJavaScriptExtension = ['.js', '.jsx', '.mjs', '.cjs'].includes(extension)
    ? candidate.slice(0, -extension.length)
    : candidate;
  const possibilities = [candidate, withoutJavaScriptExtension];
  for (const base of possibilities) {
    for (const filename of [
      base,
      ...sourceExtensions.map((sourceExtension) => `${base}${sourceExtension}`),
      ...sourceExtensions.map((sourceExtension) =>
        path.join(base, `index${sourceExtension}`)
      )
    ]) {
      const normalized = path.normalize(filename);
      if (sourceFileSet.has(normalized)) {
        return normalized;
      }
    }
  }
  return null;
}

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function stronglyConnectedComponents(sourceGraph) {
  let currentIndex = 0;
  const stack = [];
  const onStack = new Set();
  const indices = new Map();
  const lowLinks = new Map();
  const components = [];

  function visit(node) {
    indices.set(node, currentIndex);
    lowLinks.set(node, currentIndex);
    currentIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const dependency of sourceGraph.get(node) ?? []) {
      if (!indices.has(dependency)) {
        visit(dependency);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(dependency)));
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return;

    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component);
  }

  for (const node of sourceGraph.keys()) {
    if (!indices.has(node)) visit(node);
  }
  return components;
}
