const LOGIC_USER_COLUMNS = [
  'created_by',
  'updated_by',
  'approved_by',
  'assigned_to',
  'added_by',
  'resolved_by',
  'uploaded_by'
];

const SEQUENCE_NAME = 'admin_user_logic_user_id_seq';
const UNIQUE_NAME = 'uq_admin_user_logic_user_id';
const MAX_INTEGER = 2_147_483_647;

/**
 * Preserve the confirmed INTEGER contract of legacy logic-user references while
 * the standalone auth model keeps UUID primary keys.
 *
 * New bridge ids start above every existing business reference. That prevents a
 * newly created standalone user from being mistaken for an unrelated historical
 * Strapi user when legacy data contains non-null ids.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  const hasAdminUser = await knex.schema.hasTable('admin_user');
  if (!hasAdminUser) {
    throw new Error('admin_user is required before adding the logic-user bridge.');
  }

  if (await knex.schema.hasColumn('admin_user', 'logic_user_id')) {
    return;
  }

  const columns = await knex('information_schema.columns')
    .select('table_name', 'column_name')
    .where({ table_schema: 'public' })
    .whereIn('column_name', LOGIC_USER_COLUMNS);

  let highestExistingReference = 0;
  for (const column of columns) {
    const row = await knex(column.table_name)
      .max({ maximum_value: column.column_name })
      .first();
    const value =
      row?.maximum_value === null || typeof row?.maximum_value === 'undefined'
        ? 0
        : Number(row.maximum_value);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(
        `Invalid logic-user reference in ${column.table_name}.${column.column_name}.`
      );
    }
    highestExistingReference = Math.max(highestExistingReference, value);
  }

  if (highestExistingReference >= MAX_INTEGER) {
    throw new Error('No INTEGER value remains for a standalone logic-user id.');
  }

  const firstStandaloneId = highestExistingReference + 1;
  await knex.raw(`CREATE SEQUENCE ${SEQUENCE_NAME} AS INTEGER START WITH 1`);
  await knex.raw(
    `ALTER SEQUENCE ${SEQUENCE_NAME} RESTART WITH ${firstStandaloneId}`
  );

  await knex.schema.alterTable('admin_user', (table) => {
    table
      .integer('logic_user_id')
      .notNullable()
      .defaultTo(knex.raw(`nextval('${SEQUENCE_NAME}')`));
    table.unique(['logic_user_id'], { indexName: UNIQUE_NAME });
  });

  await knex.raw(
    `ALTER SEQUENCE ${SEQUENCE_NAME} OWNED BY admin_user.logic_user_id`
  );
  await knex.raw(
    "COMMENT ON COLUMN admin_user.logic_user_id IS 'INTEGER compatibility key for confirmed business logic-user references; UUID id remains the auth primary key.'"
  );
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  if (await knex.schema.hasColumn('admin_user', 'logic_user_id')) {
    await knex.schema.alterTable('admin_user', (table) => {
      table.dropUnique(['logic_user_id'], UNIQUE_NAME);
      table.dropColumn('logic_user_id');
    });
  }
  await knex.raw(`DROP SEQUENCE IF EXISTS ${SEQUENCE_NAME}`);
};
