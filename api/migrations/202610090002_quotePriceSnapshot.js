const QUOTE_ITEM_TABLE = 'quote_item';

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable(QUOTE_ITEM_TABLE, (table) => {
    table.integer('public_price_amount_at_request').nullable();
  });
  await knex.raw(`
    ALTER TABLE ${QUOTE_ITEM_TABLE}
      ADD CONSTRAINT quote_item_public_price_snapshot_positive
        CHECK (public_price_amount_at_request IS NULL OR public_price_amount_at_request > 0)
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE ${QUOTE_ITEM_TABLE}
      DROP CONSTRAINT IF EXISTS quote_item_public_price_snapshot_positive
  `);
  await knex.schema.alterTable(QUOTE_ITEM_TABLE, (table) => {
    table.dropColumn('public_price_amount_at_request');
  });
};
