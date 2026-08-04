exports.up = async function up(knex) {
  await knex.schema.createTable('import_mapping_profile', (table) => {
    table
      .uuid('id')
      .primary()
      .defaultTo(knex.raw('gen_random_uuid()'));
    table.string('profile_name', 160).notNullable();
    table.string('header_signature', 1000).notNullable();
    table.jsonb('normalized_headers').notNullable();
    table.jsonb('mapping_config').notNullable();
    table.integer('usage_count').notNullable().defaultTo(0);
    table.timestamp('last_used_at', { useTz: true }).nullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  await knex.raw(`
    ALTER TABLE import_mapping_profile
    ADD CONSTRAINT chk_import_mapping_profile_name_not_blank
    CHECK (btrim(profile_name) <> '')
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX idx_import_mapping_profile_signature_active
    ON import_mapping_profile(header_signature)
    WHERE deleted_at IS NULL
  `);
};

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_import_mapping_profile_signature_active');
  await knex.schema.dropTableIfExists('import_mapping_profile');
};
