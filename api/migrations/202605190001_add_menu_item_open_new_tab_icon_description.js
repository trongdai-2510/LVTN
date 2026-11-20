exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE menu_item
      ADD COLUMN IF NOT EXISTS open_in_new_tab BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS icon_name VARCHAR(64),
      ADD COLUMN IF NOT EXISTS description VARCHAR(255)
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE menu_item
      DROP COLUMN IF EXISTS description,
      DROP COLUMN IF EXISTS icon_name,
      DROP COLUMN IF EXISTS open_in_new_tab
  `);
};
