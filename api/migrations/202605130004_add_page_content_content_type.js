const PAGE_CONTENT_TABLE = 'page_content';
const CONTENT_TYPE_INDEX = 'idx_page_content_content_type';
const CONTENT_TYPE_CONSTRAINT = 'chk_page_content_content_type';

exports.up = async function up(knex) {
  const hasContentType = await knex.schema.hasColumn(PAGE_CONTENT_TABLE, 'content_type');

  if (!hasContentType) {
    await knex.schema.alterTable(PAGE_CONTENT_TABLE, (table) => {
      table.string('content_type', 20).notNullable().defaultTo('page');
    });
  }

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '${CONTENT_TYPE_CONSTRAINT}'
      ) THEN
        ALTER TABLE ${PAGE_CONTENT_TABLE}
        ADD CONSTRAINT ${CONTENT_TYPE_CONSTRAINT}
        CHECK (content_type IN ('page', 'news'));
      END IF;
    END $$;
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ${CONTENT_TYPE_INDEX}
    ON ${PAGE_CONTENT_TABLE} (content_type)
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS ${CONTENT_TYPE_INDEX}`);
  await knex.raw(`ALTER TABLE ${PAGE_CONTENT_TABLE} DROP CONSTRAINT IF EXISTS ${CONTENT_TYPE_CONSTRAINT}`);

  const hasContentType = await knex.schema.hasColumn(PAGE_CONTENT_TABLE, 'content_type');
  if (hasContentType) {
    await knex.schema.alterTable(PAGE_CONTENT_TABLE, (table) => {
      table.dropColumn('content_type');
    });
  }
};
