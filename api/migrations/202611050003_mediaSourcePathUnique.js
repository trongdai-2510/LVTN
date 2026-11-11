/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.raw(`
    CREATE UNIQUE INDEX uq_media_intake_item_batch_path
    ON media_intake_item (batch_id, source_path)
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS uq_media_intake_item_batch_path');
};
