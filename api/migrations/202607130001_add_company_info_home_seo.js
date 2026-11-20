exports.up = async function up(knex) {
  await knex.schema.alterTable('company_info', (table) => {
    table.string('home_seo_title', 255).nullable();
    table.text('home_seo_description').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('company_info', (table) => {
    table.dropColumn('home_seo_description');
    table.dropColumn('home_seo_title');
  });
};
