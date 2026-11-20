exports.up = async function up(knex) {
  await knex.schema.alterTable('brand', (table) => {
    table.uuid('primary_category_id').nullable();
    table
      .foreign('primary_category_id', 'fk_brand_primary_category')
      .references('id')
      .inTable('product_category')
      .onDelete('RESTRICT');
  });

  await knex.schema.alterTable('technical_document', (table) => {
    table.uuid('product_variant_id').nullable();
    table
      .foreign('product_variant_id', 'fk_technical_document_variant')
      .references('id')
      .inTable('product_variant')
      .onDelete('RESTRICT');
  });

  await knex.schema.alterTable('brand', (table) => {
    table.index(['primary_category_id'], 'idx_brand_primary_category');
  });

  await knex.schema.alterTable('technical_document', (table) => {
    table.index(
      ['product_group_id', 'product_variant_id'],
      'idx_technical_document_group_variant'
    );
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('technical_document', (table) => {
    table.dropIndex(
      ['product_group_id', 'product_variant_id'],
      'idx_technical_document_group_variant'
    );
  });

  await knex.schema.alterTable('brand', (table) => {
    table.dropIndex(['primary_category_id'], 'idx_brand_primary_category');
  });

  await knex.schema.alterTable('technical_document', (table) => {
    table.dropForeign(['product_variant_id'], 'fk_technical_document_variant');
    table.dropColumn('product_variant_id');
  });

  await knex.schema.alterTable('brand', (table) => {
    table.dropForeign(['primary_category_id'], 'fk_brand_primary_category');
    table.dropColumn('primary_category_id');
  });
};
