exports.up = async function up(knex) {
  await knex.schema.table('banner', (table) => {
    table.string('description', 500).nullable();
    table.string('content_position', 16).notNullable().defaultTo('left');
    table.uuid('image_mobile_file_id').nullable();
    table.jsonb('cta_buttons').nullable();
    table.text('notes').nullable();
  });

  await knex.raw(`
    ALTER TABLE banner
    ADD CONSTRAINT chk_banner_content_position
    CHECK (content_position IN ('left', 'center', 'right'))
  `);

  await knex.raw(`
    ALTER TABLE banner
    ADD CONSTRAINT fk_banner_image_mobile
    FOREIGN KEY (image_mobile_file_id)
    REFERENCES file_metadata(id)
    ON DELETE SET NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE banner DROP CONSTRAINT IF EXISTS chk_banner_content_position`);
  await knex.raw(`ALTER TABLE banner DROP CONSTRAINT IF EXISTS fk_banner_image_mobile`);
  await knex.schema.table('banner', (table) => {
    table.dropColumn('notes');
    table.dropColumn('cta_buttons');
    table.dropColumn('image_mobile_file_id');
    table.dropColumn('content_position');
    table.dropColumn('description');
  });
};
