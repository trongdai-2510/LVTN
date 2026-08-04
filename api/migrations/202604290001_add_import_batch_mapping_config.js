exports.up = async function up(knex) {
  await knex.schema.alterTable('import_batch', (table) => {
    table.jsonb('selected_row_ranges').nullable();
    table.jsonb('column_mapping').nullable();
  });

  await knex.schema.alterTable('pending_product_group', (table) => {
    table.text('main_category_name').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('pending_product_group', (table) => {
    table.dropColumn('main_category_name');
  });

  await knex.schema.alterTable('import_batch', (table) => {
    table.dropColumn('column_mapping');
    table.dropColumn('selected_row_ranges');
  });
};
