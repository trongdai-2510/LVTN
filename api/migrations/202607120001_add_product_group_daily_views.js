const TABLE = 'product_group_daily_view';

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable(TABLE);
  if (!exists) {
    await knex.schema.createTable(TABLE, (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table
        .uuid('product_group_id')
        .notNullable()
        .references('id')
        .inTable('product_group')
        .onDelete('CASCADE');
      table.date('view_date').notNullable();
      table.integer('view_count').notNullable().defaultTo(0);
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.unique(['product_group_id', 'view_date'], {
        indexName: 'uq_product_group_daily_view_product_date'
      });
      table.check('view_count >= 0', [], 'chk_product_group_daily_view_count');
    });
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_product_group_daily_view_date
    ON ${TABLE} (view_date DESC)
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_product_group_daily_view_updated_at ON ${TABLE};
    CREATE TRIGGER trg_product_group_daily_view_updated_at
    BEFORE UPDATE ON ${TABLE}
    FOR EACH ROW EXECUTE FUNCTION st_set_updated_at()
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists(TABLE);
};
