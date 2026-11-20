const BRAND_TABLE = 'brand';
const PRODUCT_GROUP_TABLE = 'product_group';
const VIEW_COUNT_INDEX = 'idx_product_group_view_count';

exports.up = async function up(knex) {
  const hasViewCountColumn = await knex.schema.hasColumn(PRODUCT_GROUP_TABLE, 'view_count');
  if (!hasViewCountColumn) {
    await knex.schema.alterTable(PRODUCT_GROUP_TABLE, (table) => {
      table.integer('view_count').notNullable().defaultTo(0);
    });
  }

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS ${VIEW_COUNT_INDEX}
    ON ${PRODUCT_GROUP_TABLE} (view_count DESC, created_at DESC)
    WHERE deleted_at IS NULL
  `);

  const now = knex.fn.now();
  const existingBrand = await knex(BRAND_TABLE)
    .where({ slug: 'mpe' })
    .first('id', 'deleted_at', 'status');

  let mpeBrandId = existingBrand?.id ?? null;

  if (!mpeBrandId) {
    const insertedRows = await knex(BRAND_TABLE)
      .insert({
        name: 'MPE',
        slug: 'mpe',
        primary_category_id: null,
        logo_file_id: null,
        description: null,
        website_url: null,
        sort_order: 0,
        status: 'active',
        created_at: now,
        updated_at: now,
        deleted_at: null
      })
      .returning('id');

    mpeBrandId = typeof insertedRows[0] === 'object' ? insertedRows[0].id : insertedRows[0];
  } else if (existingBrand.deleted_at || existingBrand.status !== 'active') {
    await knex(BRAND_TABLE)
      .where({ id: mpeBrandId })
      .update({
        status: 'active',
        deleted_at: null,
        updated_at: now
      });
  }

  if (mpeBrandId) {
    await knex(PRODUCT_GROUP_TABLE)
      .whereNull('deleted_at')
      .whereNull('brand_id')
      .update({
        brand_id: mpeBrandId,
        updated_at: now
      });
  }
};

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS ${VIEW_COUNT_INDEX}`);

  const hasViewCountColumn = await knex.schema.hasColumn(PRODUCT_GROUP_TABLE, 'view_count');
  if (hasViewCountColumn) {
    await knex.schema.alterTable(PRODUCT_GROUP_TABLE, (table) => {
      table.dropColumn('view_count');
    });
  }
};
