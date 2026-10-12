const { createHash } = require('node:crypto');

function supportingIndexName(tableName, columns) {
  const rawName = `st_fk_${tableName}_${columns.join('_')}_idx`;
  if (rawName.length <= 63) return rawName;

  const digest = createHash('sha256').update(rawName).digest('hex').slice(0, 8);
  return `${rawName.slice(0, 54)}_${digest}`;
}

function hasLeadingColumns(indexColumns, foreignKeyColumns) {
  return foreignKeyColumns.every(
    (column, position) => indexColumns[position] === column
  );
}

async function loadForeignKeys(knex) {
  const result = await knex.raw(`
    SELECT
      child_namespace.nspname AS schema_name,
      child_table.relname AS table_name,
      constraint_info.conname AS constraint_name,
      ARRAY(
        SELECT attribute.attname
        FROM unnest(constraint_info.conkey)
          WITH ORDINALITY AS constraint_key(attnum, position)
        JOIN pg_attribute attribute
          ON attribute.attrelid = constraint_info.conrelid
          AND attribute.attnum = constraint_key.attnum
        ORDER BY constraint_key.position
      )::text[] AS columns
    FROM pg_constraint constraint_info
    JOIN pg_class child_table ON child_table.oid = constraint_info.conrelid
    JOIN pg_namespace child_namespace ON child_namespace.oid = child_table.relnamespace
    WHERE child_namespace.nspname = 'public'
      AND constraint_info.contype = 'f'
    ORDER BY table_name, constraint_name
  `);
  return result.rows;
}

async function loadUsableIndexes(knex) {
  const result = await knex.raw(`
    SELECT
      table_namespace.nspname AS schema_name,
      table_class.relname AS table_name,
      index_class.relname AS index_name,
      ARRAY(
        SELECT attribute.attname
        FROM unnest(index_info.indkey::smallint[])
          WITH ORDINALITY AS index_key(attnum, position)
        JOIN pg_attribute attribute
          ON attribute.attrelid = index_info.indrelid
          AND attribute.attnum = index_key.attnum
        WHERE index_key.position <= index_info.indnkeyatts
          AND index_key.attnum > 0
        ORDER BY index_key.position
      )::text[] AS columns
    FROM pg_index index_info
    JOIN pg_class table_class ON table_class.oid = index_info.indrelid
    JOIN pg_class index_class ON index_class.oid = index_info.indexrelid
    JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND index_info.indisvalid
      AND index_info.indisready
      AND index_info.indislive
      AND index_info.indpred IS NULL
    ORDER BY table_name, index_name
  `);
  return result.rows;
}

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const [foreignKeys, indexes] = await Promise.all([
    loadForeignKeys(knex),
    loadUsableIndexes(knex)
  ]);
  const indexesByTable = new Map();

  for (const index of indexes) {
    const key = `${index.schema_name}.${index.table_name}`;
    const tableIndexes = indexesByTable.get(key) ?? [];
    tableIndexes.push(index);
    indexesByTable.set(key, tableIndexes);
  }

  for (const foreignKey of foreignKeys) {
    const key = `${foreignKey.schema_name}.${foreignKey.table_name}`;
    const tableIndexes = indexesByTable.get(key) ?? [];
    if (
      tableIndexes.some((index) =>
        hasLeadingColumns(index.columns, foreignKey.columns)
      )
    ) {
      continue;
    }

    const indexName = supportingIndexName(
      foreignKey.table_name,
      foreignKey.columns
    );
    const collision = await knex('pg_catalog.pg_class as index_class')
      .join(
        'pg_catalog.pg_namespace as index_namespace',
        'index_namespace.oid',
        'index_class.relnamespace'
      )
      .where({
        'index_namespace.nspname': foreignKey.schema_name,
        'index_class.relname': indexName
      })
      .first('index_class.oid');
    if (collision) {
      throw new Error(
        `Cannot create supporting index ${indexName}: that name is already in use.`
      );
    }

    const columnBindings = foreignKey.columns.map(() => '??').join(', ');
    await knex.raw(
      `CREATE INDEX ?? ON ??.?? (${columnBindings})`,
      [
        indexName,
        foreignKey.schema_name,
        foreignKey.table_name,
        ...foreignKey.columns
      ]
    );

    tableIndexes.push({
      schema_name: foreignKey.schema_name,
      table_name: foreignKey.table_name,
      index_name: indexName,
      columns: foreignKey.columns
    });
    indexesByTable.set(key, tableIndexes);
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  const foreignKeys = await loadForeignKeys(knex);
  const indexNames = new Set(
    foreignKeys.map((foreignKey) =>
      supportingIndexName(foreignKey.table_name, foreignKey.columns)
    )
  );

  for (const indexName of indexNames) {
    await knex.raw('DROP INDEX IF EXISTS ??.??', ['public', indexName]);
  }
};
