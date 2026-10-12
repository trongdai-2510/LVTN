exports.up = async function up(knex) {
  await knex.schema.alterTable('import_batch', (table) => {
    table.string('source_sheet_name', 255).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('import_batch', (table) => {
    table.dropColumn('source_sheet_name');
  });
};
