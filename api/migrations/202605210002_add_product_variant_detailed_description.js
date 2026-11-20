exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE product_variant
    ADD COLUMN IF NOT EXISTS detailed_description TEXT
  `);
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE product_variant DROP COLUMN IF EXISTS detailed_description');
};
