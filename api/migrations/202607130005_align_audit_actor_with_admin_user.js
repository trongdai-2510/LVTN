const AUDIT_LOG_TABLE = 'audit_log';

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const hasTable = await knex.schema.hasTable(AUDIT_LOG_TABLE);
  if (!hasTable) return;

  await knex.raw(`
    ALTER TABLE ${AUDIT_LOG_TABLE}
    ALTER COLUMN actor_id TYPE TEXT
    USING actor_id::text
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  const hasTable = await knex.schema.hasTable(AUDIT_LOG_TABLE);
  if (!hasTable) return;

  await knex.raw(`
    ALTER TABLE ${AUDIT_LOG_TABLE}
    ALTER COLUMN actor_id TYPE INTEGER
    USING CASE
      WHEN actor_id ~ '^[0-9]+$' THEN actor_id::integer
      ELSE NULL
    END
  `);
};
