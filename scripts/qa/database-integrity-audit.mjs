import { createRequire } from 'node:module';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const API_ROOT = path.join(ROOT, 'api');
const requireFromApi = createRequire(path.join(API_ROOT, 'package.json'));
const knexFactory = requireFromApi('knex');
const dotenv = requireFromApi('dotenv');

dotenv.config({ path: path.join(API_ROOT, '.env'), override: false });

const REPORT_PATH = path.join(
  ROOT,
  'docs',
  'working-notes',
  'database-integrity-qa-last-run.md'
);
const DDL_PATH = path.join(
  ROOT,
  'database',
  'ddl',
  'song_thanh_physical_schema_v2.sql'
);
const MIGRATIONS_DIR = path.join(API_ROOT, 'migrations');
const HOME_SECTION_TYPES = [
  'hero',
  'product_categories',
  'company_overview',
  'featured_products',
  'services',
  'projects',
  'brands',
  'trust_strip',
  'contact_cta'
];
const SEEDED_ROLE_CODES = [
  'content_admin',
  'product_admin',
  'sales_admin',
  'super_admin',
  'viewer'
];
const EXPECTED_PERMISSION_COUNT = 118;
const KNEX_TABLES = ['knex_migrations', 'knex_migrations_lock'];

const results = [];
const observations = {};

const db = knexFactory({
  client: 'pg',
  connection: {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 5432),
    database: process.env.DATABASE_NAME || 'song_thanh_cms',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    ssl: parseBoolean(process.env.DATABASE_SSL)
      ? {
          rejectUnauthorized:
            process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
        }
      : false
  },
  pool: { min: 0, max: 2 }
});

async function main() {
  await runCase('DB-CONNECTION', 'PostgreSQL connection is usable', async () => {
    const result = await db.raw('SELECT current_database() AS database, current_user AS user');
    return result.rows[0];
  });

  await runCase(
    'DB-TABLE-SET',
    'Runtime table set equals baseline plus ordered migrations and Knex metadata',
    async () => {
      const expected = deriveExpectedTables();
      const rows = await db('information_schema.tables')
        .select('table_name')
        .where({
          table_schema: 'public',
          table_type: 'BASE TABLE'
        })
        .orderBy('table_name', 'asc');
      const actual = rows.map((row) => row.table_name);
      const expectedSet = new Set(expected);
      const actualSet = new Set(actual);
      const missing = expected.filter((table) => !actualSet.has(table));
      const unexpected = actual.filter((table) => !expectedSet.has(table));
      assert(missing.length === 0, `missing tables: ${missing.join(', ')}`);
      assert(
        unexpected.length === 0,
        `unexpected tables: ${unexpected.join(', ')}`
      );
      observations.tables = actual;
      return { count: actual.length, missing, unexpected };
    }
  );

  await runCase(
    'DB-MIGRATION-SET',
    'Every migration file is applied exactly once and no unknown migration is recorded',
    async () => {
      const files = migrationFiles();
      const rows = await db('knex_migrations')
        .select('name')
        .orderBy('id', 'asc');
      const applied = rows.map((row) => row.name);
      const appliedSet = new Set(applied);
      const filesSet = new Set(files);
      const pending = files.filter((file) => !appliedSet.has(file));
      const unknown = applied.filter((file) => !filesSet.has(file));
      const duplicate = applied.filter(
        (file, index) => applied.indexOf(file) !== index
      );
      assert(pending.length === 0, `pending migrations: ${pending.join(', ')}`);
      assert(unknown.length === 0, `unknown migrations: ${unknown.join(', ')}`);
      assert(
        duplicate.length === 0,
        `duplicate migration rows: ${duplicate.join(', ')}`
      );
      return { files: files.length, applied: applied.length };
    }
  );

  await runCase(
    'DB-CONSTRAINT-VALIDATION',
    'All public constraints are validated',
    async () => {
      const result = await db.raw(`
        SELECT c.conname, c.contype, c.conrelid::regclass::text AS table_name
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public' AND NOT c.convalidated
        ORDER BY table_name, c.conname
      `);
      assert(
        result.rows.length === 0,
        `not-valid constraints: ${result.rows
          .map((row) => `${row.table_name}.${row.conname}`)
          .join(', ')}`
      );
      return { invalid_constraints: 0 };
    }
  );

  await runCase(
    'DB-INDEX-VALIDITY',
    'All public indexes are valid, ready and live',
    async () => {
      const result = await db.raw(`
        SELECT
          i.indexrelid::regclass::text AS index_name,
          i.indrelid::regclass::text AS table_name,
          i.indisvalid,
          i.indisready,
          i.indislive
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND (NOT i.indisvalid OR NOT i.indisready OR NOT i.indislive)
        ORDER BY table_name, index_name
      `);
      assert(
        result.rows.length === 0,
        `invalid indexes: ${result.rows
          .map((row) => `${row.table_name}.${row.index_name}`)
          .join(', ')}`
      );
      return { invalid_indexes: 0 };
    }
  );

  await runCase(
    'DB-FK-ORPHANS',
    'No foreign-key relation contains orphan rows',
    async () => {
      const foreignKeys = await loadForeignKeys();
      const orphans = [];
      for (const foreignKey of foreignKeys) {
        const joins = foreignKey.child_columns.map(
          (childColumn, index) =>
            `c.${quoteIdentifier(childColumn)} = p.${quoteIdentifier(
              foreignKey.parent_columns[index]
            )}`
        );
        const childPresent = foreignKey.child_columns
          .map((column) => `c.${quoteIdentifier(column)} IS NOT NULL`)
          .join(' OR ');
        const parentMissing = foreignKey.parent_columns
          .map((column) => `p.${quoteIdentifier(column)} IS NULL`)
          .join(' AND ');
        const query = `
          SELECT COUNT(*)::int AS count
          FROM ${quoteQualifiedIdentifier(foreignKey.child_table)} c
          LEFT JOIN ${quoteQualifiedIdentifier(foreignKey.parent_table)} p
            ON ${joins.join(' AND ')}
          WHERE (${childPresent}) AND (${parentMissing})
        `;
        const result = await db.raw(query);
        const count = Number(result.rows[0]?.count ?? 0);
        if (count > 0) {
          orphans.push({
            constraint: foreignKey.constraint_name,
            child_table: foreignKey.child_table,
            parent_table: foreignKey.parent_table,
            count
          });
        }
      }
      assert(orphans.length === 0, `orphan FKs: ${JSON.stringify(orphans)}`);
      return { foreign_keys_checked: foreignKeys.length, orphan_rows: 0 };
    }
  );

  await runCase(
    'DB-AUTH-SEED',
    'Standalone admin roles and permission catalog match the runtime contract',
    async () => {
      const [permissionCountRow, roleRows] = await Promise.all([
        db('admin_permission').count('* as count').first(),
        db('admin_role')
          .select('code')
          .whereNull('deleted_at')
          .orderBy('code', 'asc')
      ]);
      const permissionCount = Number(permissionCountRow?.count ?? 0);
      const roles = roleRows.map((row) => row.code);
      assert(
        permissionCount === EXPECTED_PERMISSION_COUNT,
        `expected ${EXPECTED_PERMISSION_COUNT} permissions, got ${permissionCount}`
      );
      assert(
        JSON.stringify(roles) === JSON.stringify(SEEDED_ROLE_CODES),
        `role drift: ${roles.join(', ')}`
      );
      return { permissions: permissionCount, roles };
    }
  );

  await runCase(
    'DB-HOME-SECTION-SEED',
    'Home-section singleton types are complete and unique',
    async () => {
      const rows = await db('home_section')
        .select('section_type')
        .orderBy('section_type', 'asc');
      const actual = rows.map((row) => row.section_type);
      const expected = [...HOME_SECTION_TYPES].sort();
      assert(
        JSON.stringify(actual) === JSON.stringify(expected),
        `home sections: expected ${expected.join(', ')}, got ${actual.join(', ')}`
      );
      return { section_count: actual.length, section_types: actual };
    }
  );

  await runCase(
    'DB-DEAD-PERMISSION-TABLE',
    'Legacy permission table is absent',
    async () => {
      const row = await db('information_schema.tables')
        .where({ table_schema: 'public', table_name: 'permission' })
        .first();
      assert(!row, 'legacy permission table still exists');
      return { absent: true };
    }
  );

  await runCase(
    'DB-REFRESH-TOKEN-HASH',
    'Refresh sessions never persist a raw token-shaped value',
    async () => {
      const rows = await db('admin_refresh_session')
        .select('id', 'token_hash')
        .limit(500);
      const malformed = rows.filter(
        (row) => !/^[a-f0-9]{64}$/i.test(String(row.token_hash ?? ''))
      );
      assert(
        malformed.length === 0,
        `non-HMAC refresh token rows: ${malformed.map((row) => row.id).join(', ')}`
      );
      return { rows_checked: rows.length };
    }
  );

  await collectSchemaObservations();
  writeReport();
  printSummary();
  if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1;
}

function deriveExpectedTables() {
  const ddl = readFileSync(DDL_PATH, 'utf8');
  const tables = new Set([
    ...ddl.matchAll(
      /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi
    )
  ].map((match) => match[1]));

  for (const file of migrationFiles()) {
    const fullSource = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // A migration file contains both directions. Runtime history applies only
    // exports.up; parsing exports.down as well would immediately undo every
    // create/drop in the derived expected set.
    const source = fullSource.split(/\bexports\.down\s*=/, 1)[0];
    for (const match of source.matchAll(
      /(?:createTable|createTableIfNotExists)\(\s*['"]([a-z_][a-z0-9_]*)['"]/gi
    )) {
      tables.add(match[1]);
    }
    for (const match of source.matchAll(
      /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi
    )) {
      tables.add(match[1]);
    }
    for (const match of source.matchAll(
      /(?:dropTable|dropTableIfExists)\(\s*['"]([a-z_][a-z0-9_]*)['"]/gi
    )) {
      tables.delete(match[1]);
    }
    for (const match of source.matchAll(
      /DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi
    )) {
      tables.delete(match[1]);
    }
  }

  for (const table of KNEX_TABLES) tables.add(table);
  return [...tables].sort();
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort();
}

async function loadForeignKeys() {
  const result = await db.raw(`
    SELECT
      c.conname AS constraint_name,
      c.conrelid::regclass::text AS child_table,
      c.confrelid::regclass::text AS parent_table,
      ARRAY(
        SELECT a.attname
        FROM unnest(c.conkey) WITH ORDINALITY AS key(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid AND a.attnum = key.attnum
        ORDER BY key.ord
      )::text[] AS child_columns,
      ARRAY(
        SELECT a.attname
        FROM unnest(c.confkey) WITH ORDINALITY AS key(attnum, ord)
        JOIN pg_attribute a
          ON a.attrelid = c.confrelid AND a.attnum = key.attnum
        ORDER BY key.ord
      )::text[] AS parent_columns
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND c.contype = 'f'
    ORDER BY child_table, constraint_name
  `);
  return result.rows;
}

async function collectSchemaObservations() {
  const [columns, triggers, tableSizes] = await Promise.all([
    db('information_schema.columns')
      .select('table_name', 'column_name')
      .where({ table_schema: 'public' }),
    db.raw(`
      SELECT event_object_table AS table_name, trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `),
    db.raw(`
      SELECT
        schemaname || '.' || relname AS table_name,
        n_live_tup::bigint AS estimated_rows
      FROM pg_stat_user_tables
      ORDER BY relname
    `)
  ]);
  const columnsByTable = new Map();
  for (const column of columns) {
    const set = columnsByTable.get(column.table_name) ?? new Set();
    set.add(column.column_name);
    columnsByTable.set(column.table_name, set);
  }
  const businessTables = [...columnsByTable.keys()].filter(
    (table) => !KNEX_TABLES.includes(table)
  );
  observations.tables_without_deleted_at = businessTables
    .filter((table) => !columnsByTable.get(table).has('deleted_at'))
    .sort();
  observations.tables_without_created_at = businessTables
    .filter((table) => !columnsByTable.get(table).has('created_at'))
    .sort();
  observations.tables_without_updated_at = businessTables
    .filter((table) => !columnsByTable.get(table).has('updated_at'))
    .sort();
  const triggeredTables = new Set(
    triggers.rows.map((row) => row.table_name)
  );
  observations.updated_at_tables_without_trigger = businessTables
    .filter(
      (table) =>
        columnsByTable.get(table).has('updated_at') &&
        !triggeredTables.has(table)
    )
    .sort();
  observations.estimated_rows = tableSizes.rows;
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function quoteQualifiedIdentifier(identifier) {
  return String(identifier)
    .split('.')
    .map(quoteIdentifier)
    .join('.');
}

async function runCase(id, name, callback) {
  const started = Date.now();
  try {
    const evidence = await callback();
    results.push({
      id,
      name,
      status: 'PASS',
      duration_ms: Date.now() - started,
      evidence
    });
  } catch (error) {
    results.push({
      id,
      name,
      status: 'FAIL',
      duration_ms: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function writeReport() {
  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const passed = results.filter((result) => result.status === 'PASS').length;
  const failed = results.length - passed;
  const lines = [
    '# Database integrity QA — last run',
    '',
    `Date: \`${new Date().toISOString()}\``,
    '',
    `Database: \`${process.env.DATABASE_NAME || 'song_thanh_cms'}\``,
    '',
    `Summary: **${passed}/${results.length} passed**, **${failed} failed**.`,
    '',
    '| ID | Status | Duration | Check | Evidence / error |',
    '| --- | --- | ---: | --- | --- |',
    ...results.map(
      (result) =>
        `| ${result.id} | ${result.status} | ${result.duration_ms} ms | ${escapeCell(result.name)} | ${escapeCell(result.status === 'PASS' ? JSON.stringify(result.evidence) : result.error)} |`
    ),
    '',
    '## Schema observations (not silently treated as pass/fail)',
    '',
    `- Tables without \`deleted_at\`: ${escapeCell(observations.tables_without_deleted_at?.join(', ') || 'none')}`,
    `- Tables without \`created_at\`: ${escapeCell(observations.tables_without_created_at?.join(', ') || 'none')}`,
    `- Tables without \`updated_at\`: ${escapeCell(observations.tables_without_updated_at?.join(', ') || 'none')}`,
    `- Tables with \`updated_at\` but no DB update trigger: ${escapeCell(observations.updated_at_tables_without_trigger?.join(', ') || 'none')}`,
    '',
    'The expected table set is derived deterministically from the locked v2 baseline, then every migration is applied in filename order, then Knex metadata tables are added. This makes post-baseline standalone-auth and home-page schema changes visible without pretending they existed in v2.',
    ''
  ];
  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
}

function printSummary() {
  const passed = results.filter((result) => result.status === 'PASS').length;
  for (const result of results) {
    console.log(
      `${result.status} ${result.id} ${result.name}${
        result.status === 'FAIL' ? ` — ${result.error}` : ''
      }`
    );
  }
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Summary: ${passed}/${results.length} passed`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
