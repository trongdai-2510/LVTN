/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable('media_intake_item', (table) => {
    table.jsonb('local_analysis').nullable();
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.alterTable('media_intake_item', (table) => {
    table.dropColumn('local_analysis');
  });
};
