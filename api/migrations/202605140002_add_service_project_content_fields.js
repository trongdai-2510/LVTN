exports.up = async function up(knex) {
  await knex.raw(`
    ALTER TABLE service
      ADD COLUMN IF NOT EXISTS content_html TEXT
  `);

  await knex.raw(`
    ALTER TABLE project
      ADD COLUMN IF NOT EXISTS content_html TEXT,
      ADD COLUMN IF NOT EXISTS client_name VARCHAR(200)
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`
    ALTER TABLE project
      DROP COLUMN IF EXISTS client_name,
      DROP COLUMN IF EXISTS content_html
  `);

  await knex.raw(`
    ALTER TABLE service
      DROP COLUMN IF EXISTS content_html
  `);
};
