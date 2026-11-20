const TABLE = "site_daily_view";

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable(TABLE);
  if (!exists) {
    await knex.schema.createTable(TABLE, (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.date("view_date").notNullable().unique("uq_site_daily_view_date");
      table.bigInteger("view_count").notNullable().defaultTo(0);
      table
        .timestamp("created_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      table
        .timestamp("updated_at", { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now());
      table.check("view_count >= 0", [], "chk_site_daily_view_count");
    });
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_site_daily_view_date
    ON ${TABLE} (view_date DESC)
  `);

  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_site_daily_view_updated_at ON ${TABLE};
    CREATE TRIGGER trg_site_daily_view_updated_at
    BEFORE UPDATE ON ${TABLE}
    FOR EACH ROW EXECUTE FUNCTION st_set_updated_at()
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists(TABLE);
};
