import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const requireFromApi = createRequire(path.join(ROOT, 'api', 'package.json'));
const ts = requireFromApi('typescript');

const API_ROOT = path.join(ROOT, 'api');
const API_SOURCE = path.join(API_ROOT, 'src');
const OUTPUT_DIR = path.join(ROOT, 'tmp', 'qa-artifacts', 'generated');
const DDL_PATH = path.join(
  ROOT,
  'database',
  'ddl',
  'song_thanh_deployment_schema_20260730.sql'
);

function walkFiles(root, predicate) {
  const files = [];
  if (!existsSync(root)) return files;

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', 'coverage'].includes(entry.name)) continue;
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute, predicate));
    else if (predicate(absolute)) files.push(absolute);
  }

  return files.sort();
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function decoratorsOf(node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
}

function decoratorInfo(decorator, sourceFile) {
  const expression = decorator.expression;
  if (ts.isCallExpression(expression)) {
    return {
      name: expression.expression.getText(sourceFile),
      args: expression.arguments.map((argument) => argument.getText(sourceFile))
    };
  }

  return { name: expression.getText(sourceFile), args: [] };
}

function stringLiteralValue(text) {
  const trimmed = String(text ?? '').trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('`') && trimmed.endsWith('`'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function joinRoute(prefix, route) {
  const parts = [prefix, route]
    .map((part) => String(part ?? '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

function inventoryControllers() {
  const endpoints = [];
  const files = walkFiles(API_SOURCE, (file) => file.endsWith('.controller.ts'));

  for (const file of files) {
    const sourceText = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    sourceFile.forEachChild((node) => {
      if (!ts.isClassDeclaration(node)) return;
      const classDecorators = decoratorsOf(node).map((decorator) =>
        decoratorInfo(decorator, sourceFile)
      );
      const controller = classDecorators.find((item) => item.name === 'Controller');
      if (!controller) return;

      const prefix = stringLiteralValue(controller.args[0] ?? '');
      const classGuards =
        classDecorators.find((item) => item.name === 'UseGuards')?.args ?? [];

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const methodDecorators = decoratorsOf(member).map((decorator) =>
          decoratorInfo(decorator, sourceFile)
        );
        const http = methodDecorators.find((item) =>
          ['Get', 'Post', 'Put', 'Patch', 'Delete'].includes(item.name)
        );
        if (!http) continue;

        const methodGuards =
          methodDecorators.find((item) => item.name === 'UseGuards')?.args ?? [];
        const permissions = (
          methodDecorators.find((item) => item.name === 'RequirePermissions')
            ?.args ?? []
        ).map(stringLiteralValue);
        const throttle =
          methodDecorators.find((item) => item.name === 'Throttle')?.args ?? [];

        endpoints.push({
          method: http.name.toUpperCase(),
          route: joinRoute(prefix, stringLiteralValue(http.args[0] ?? '')),
          controller: node.name?.getText(sourceFile) ?? '(anonymous)',
          handler: member.name.getText(sourceFile),
          file: relative(file),
          guards: [...classGuards, ...methodGuards],
          permissions,
          throttle,
          parameters: member.parameters.map((parameter) => ({
            name: parameter.name.getText(sourceFile),
            type: parameter.type?.getText(sourceFile) ?? null,
            decorators: decoratorsOf(parameter).map((decorator) =>
              decoratorInfo(decorator, sourceFile)
            )
          }))
        });
      }
    });
  }

  return endpoints.sort((left, right) =>
    `${left.route} ${left.method}`.localeCompare(`${right.route} ${right.method}`)
  );
}

function inventoryDtos() {
  const classes = [];
  const files = walkFiles(API_SOURCE, (file) => file.endsWith('.dto.ts'));

  for (const file of files) {
    const sourceText = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );

    sourceFile.forEachChild((node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const properties = node.members
        .filter((member) => ts.isPropertyDeclaration(member))
        .map((member) => ({
          name: member.name.getText(sourceFile),
          type: member.type?.getText(sourceFile) ?? null,
          optional: Boolean(member.questionToken),
          decorators: decoratorsOf(member).map((decorator) =>
            decoratorInfo(decorator, sourceFile)
          )
        }));

      classes.push({
        name: node.name.getText(sourceFile),
        file: relative(file),
        properties
      });
    });
  }

  return classes.sort((left, right) => left.name.localeCompare(right.name));
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function literalArray(node) {
  const expression = unwrapExpression(node);
  if (!expression || !ts.isArrayLiteralExpression(expression)) return [];
  return expression.elements
    .filter((element) => ts.isStringLiteralLike(element))
    .map((element) => element.text);
}

function objectProperty(object, propertyName) {
  const property = object.properties.find(
    (item) =>
      ts.isPropertyAssignment(item) &&
      item.name.getText().replace(/^['"]|['"]$/g, '') === propertyName
  );
  return property && ts.isPropertyAssignment(property)
    ? unwrapExpression(property.initializer)
    : null;
}

function inventoryPermissionSeed() {
  const file = path.join(
    API_SOURCE,
    'modules',
    'admin-permission',
    'permission-seed.ts'
  );
  const sourceText = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let permissionCodes = [];
  const roles = [];

  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      const name = declaration.name.getText(sourceFile);
      if (name === 'SEEDED_PERMISSION_CODES') {
        permissionCodes = literalArray(declaration.initializer);
      }
      if (name !== 'SEEDED_ROLES') continue;
      const array = unwrapExpression(declaration.initializer);
      if (!array || !ts.isArrayLiteralExpression(array)) continue;

      for (const element of array.elements) {
        const object = unwrapExpression(element);
        if (!object || !ts.isObjectLiteralExpression(object)) continue;
        const codeNode = objectProperty(object, 'code');
        const nameNode = objectProperty(object, 'name');
        const permissionsNode = objectProperty(object, 'permission_codes');
        roles.push({
          code: codeNode && ts.isStringLiteralLike(codeNode) ? codeNode.text : null,
          name: nameNode && ts.isStringLiteralLike(nameNode) ? nameNode.text : null,
          permission_codes: literalArray(permissionsNode)
        });
      }
    }
  });

  return { permission_codes: permissionCodes, roles };
}

function inventoryAdminPermissionConstants() {
  const file = path.join(ROOT, 'admin', 'src', 'lib', 'permissions.ts');
  if (!existsSync(file)) return [];
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/:\s*['"]([a-z_]+\.[a-z_]+)['"]/g)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort();
}

function inventoryDdl() {
  const source = readFileSync(DDL_PATH, 'utf8');
  const tables = [
    ...source.matchAll(
      /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi
    )
  ].map((match) => match[1]);
  const constraints = [
    ...source.matchAll(
      /CONSTRAINT\s+"?([a-z_][a-z0-9_]*)"?\s+(CHECK|FOREIGN\s+KEY|UNIQUE|PRIMARY\s+KEY)/gi
    )
  ].map((match) => ({ name: match[1], kind: match[2].toUpperCase() }));
  const indexes = [
    ...source.matchAll(
      /CREATE\s+(UNIQUE\s+)?INDEX(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([a-z_][a-z0-9_]*)"?\s+ON\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi
    )
  ].map((match) => ({
    name: match[2],
    table: match[3],
    unique: Boolean(match[1])
  }));
  const foreignKeys = [
    ...source.matchAll(
      /FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(([^)]+)\)/gi
    )
  ].map((match) => ({
    columns: match[1].trim(),
    references_table: match[2],
    references_columns: match[3].trim()
  }));
  const checkExpressions = [
    ...source.matchAll(/\bCHECK\s*\(((?:[^()]|\([^()]*\))*)\)/gi)
  ].map((match) => match[1].replace(/\s+/g, ' ').trim());

  return {
    source: relative(DDL_PATH),
    tables: [...new Set(tables)].sort(),
    constraints,
    indexes,
    foreign_keys: foreignKeys,
    check_expressions: checkExpressions
  };
}

function routeFromPage(appRoot, file) {
  const relativePage = path.relative(appRoot, path.dirname(file));
  const segments = relativePage
    .split(path.sep)
    .filter((segment) => segment && !segment.startsWith('('));
  return `/${segments.join('/')}`.replace(/\/+/g, '/') || '/';
}

function inventoryAppRoutes(project) {
  const appRoot = path.join(ROOT, project, 'src', 'app');
  const fallbackRoot = path.join(ROOT, project, 'app');
  const selectedRoot = existsSync(appRoot) ? appRoot : fallbackRoot;
  return walkFiles(
    selectedRoot,
    (file) => /[\\/]page\.(tsx|ts|jsx|js)$/.test(file)
  ).map((file) => ({
    route: routeFromPage(selectedRoot, file),
    file: relative(file)
  }));
}

function inventoryMigrations() {
  const root = path.join(API_ROOT, 'migrations');
  return walkFiles(root, (file) => file.endsWith('.js')).map((file) =>
    path.basename(file)
  );
}

function buildGaps(inventory) {
  const seeded = new Set(inventory.permissions.permission_codes);
  const required = new Set(
    inventory.endpoints.flatMap((endpoint) => endpoint.permissions)
  );
  const adminConstants = new Set(inventory.permissions.admin_constants);
  const adminRoutes = inventory.endpoints.filter((endpoint) =>
    endpoint.route.startsWith('/song-thanh')
  );

  return {
    required_but_not_seeded: [...required].filter((code) => !seeded.has(code)).sort(),
    seeded_but_not_required_by_controller: [...seeded]
      .filter((code) => !required.has(code))
      .sort(),
    admin_constant_but_not_seeded: [...adminConstants]
      .filter((code) => !seeded.has(code))
      .sort(),
    seeded_but_missing_admin_constant: [...seeded]
      .filter((code) => !adminConstants.has(code))
      .sort(),
    admin_endpoints_without_permission_decorator: adminRoutes
      .filter((endpoint) => endpoint.permissions.length === 0)
      .map((endpoint) => `${endpoint.method} ${endpoint.route}`)
  };
}

function escapeCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderMarkdown(inventory) {
  const lines = [
    '# Song Thanh — Generated System Inventory',
    '',
    `Generated at: \`${inventory.generated_at}\``,
    '',
    '> Đây là inventory tĩnh cấp E0, dùng để tạo ma trận test. Nó không chứng minh hành vi runtime.',
    '',
    '## Summary',
    '',
    '| Item | Count |',
    '| --- | ---: |',
    `| API endpoints | ${inventory.endpoints.length} |`,
    `| DTO classes | ${inventory.dtos.length} |`,
    `| DTO fields | ${inventory.dtos.reduce((sum, dto) => sum + dto.properties.length, 0)} |`,
    `| Seeded permissions | ${inventory.permissions.permission_codes.length} |`,
    `| Seeded roles | ${inventory.permissions.roles.length} |`,
    `| Physical DDL tables | ${inventory.database.tables.length} |`,
    `| Named constraints | ${inventory.database.constraints.length} |`,
    `| Indexes | ${inventory.database.indexes.length} |`,
    `| API migrations | ${inventory.migrations.length} |`,
    `| Admin page routes | ${inventory.apps.admin.length} |`,
    `| Public page routes | ${inventory.apps.frontend.length} |`,
    '',
    '## Static consistency gaps',
    '',
    '| Check | Values |',
    '| --- | --- |',
    `| Required by controller but not seeded | ${escapeCell(inventory.gaps.required_but_not_seeded.join(', ') || 'none')} |`,
    `| Admin constant but not seeded | ${escapeCell(inventory.gaps.admin_constant_but_not_seeded.join(', ') || 'none')} |`,
    `| Seeded but missing admin constant | ${escapeCell(inventory.gaps.seeded_but_missing_admin_constant.join(', ') || 'none')} |`,
    `| Admin endpoints without permission decorator | ${escapeCell(inventory.gaps.admin_endpoints_without_permission_decorator.join(', ') || 'none')} |`,
    '',
    '## API endpoints',
    '',
    '| Method | Route | Permission | Guards | Handler |',
    '| --- | --- | --- | --- | --- |',
    ...inventory.endpoints.map(
      (endpoint) =>
        `| ${endpoint.method} | \`${escapeCell(endpoint.route)}\` | ${escapeCell(endpoint.permissions.join(', ') || 'public / auth-only')} | ${escapeCell(endpoint.guards.join(', ') || 'none')} | \`${escapeCell(`${endpoint.controller}.${endpoint.handler}`)}\` |`
    ),
    '',
    '## DTO boundaries',
    '',
    '| DTO | Field | Type | Validators / transforms |',
    '| --- | --- | --- | --- |',
    ...inventory.dtos.flatMap((dto) =>
      dto.properties.map(
        (property) =>
          `| \`${escapeCell(dto.name)}\` | \`${escapeCell(property.name)}\` | \`${escapeCell(property.type ?? 'inferred')}\` | ${escapeCell(property.decorators.map((item) => `@${item.name}(${item.args.join(', ')})`).join('; ') || 'none')} |`
      )
    ),
    '',
    '## Seeded role matrix',
    '',
    '| Role | Permission count | Permissions |',
    '| --- | ---: | --- |',
    ...inventory.permissions.roles.map(
      (role) =>
        `| \`${escapeCell(role.code)}\` | ${role.permission_codes.length || inventory.permissions.permission_codes.length} | ${escapeCell(role.permission_codes.join(', ') || 'all seeded permissions (super-admin bootstrap)')} |`
    ),
    '',
    '## Database tables',
    '',
    inventory.database.tables.map((table) => `- \`${table}\``).join('\n'),
    '',
    '## Admin routes',
    '',
    ...inventory.apps.admin.map(
      (route) => `- \`${route.route}\` — \`${route.file}\``
    ),
    '',
    '## Public routes',
    '',
    ...inventory.apps.frontend.map(
      (route) => `- \`${route.route}\` — \`${route.file}\``
    ),
    '',
    '## Machine-readable source',
    '',
    'See `system-inventory.json` in the same directory.',
    ''
  ];

  return lines.join('\n');
}

function main() {
  const inventory = {
    generated_at: new Date().toISOString(),
    source_root: ROOT,
    endpoints: inventoryControllers(),
    dtos: inventoryDtos(),
    permissions: {
      ...inventoryPermissionSeed(),
      admin_constants: inventoryAdminPermissionConstants()
    },
    database: inventoryDdl(),
    migrations: inventoryMigrations(),
    apps: {
      admin: inventoryAppRoutes('admin'),
      frontend: inventoryAppRoutes('frontend')
    }
  };
  inventory.gaps = buildGaps(inventory);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, 'system-inventory.json');
  const markdownPath = path.join(OUTPUT_DIR, 'system-inventory.md');
  writeFileSync(jsonPath, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, renderMarkdown(inventory), 'utf8');

  console.log(
    JSON.stringify(
      {
        endpoints: inventory.endpoints.length,
        dto_classes: inventory.dtos.length,
        dto_fields: inventory.dtos.reduce(
          (sum, dto) => sum + dto.properties.length,
          0
        ),
        permissions: inventory.permissions.permission_codes.length,
        roles: inventory.permissions.roles.length,
        tables: inventory.database.tables.length,
        migrations: inventory.migrations.length,
        admin_routes: inventory.apps.admin.length,
        public_routes: inventory.apps.frontend.length,
        gaps: inventory.gaps,
        report: relative(markdownPath)
      },
      null,
      2
    )
  );
}

main();
