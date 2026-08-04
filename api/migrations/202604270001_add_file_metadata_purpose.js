const PURPOSES = [
  'product_image',
  'brand_logo',
  'banner',
  'technical_document',
  'import_file',
  'website_config',
  'other'
];

exports.up = async function up(knex) {
  await knex.schema.alterTable('file_metadata', (table) => {
    table.text('purpose').notNullable().defaultTo('other');
  });

  await knex.raw(
    `ALTER TABLE file_metadata ADD CONSTRAINT chk_file_metadata_purpose CHECK (purpose IN (${PURPOSES.map((value) => `'${value}'`).join(', ')}))`
  );

  await knex.raw(`
    UPDATE file_metadata AS fm
    SET purpose = CASE
      WHEN EXISTS (
        SELECT 1
        FROM file_usage fu
        WHERE fu.file_id = fm.id
          AND fu.deleted_at IS NULL
          AND fu.entity_type = 'import_batch'
          AND fu.field_name = 'source_file_id'
      ) THEN 'import_file'
      WHEN EXISTS (
        SELECT 1
        FROM file_usage fu
        WHERE fu.file_id = fm.id
          AND fu.deleted_at IS NULL
          AND fu.entity_type = 'technical_document'
          AND fu.field_name = 'file_id'
      ) THEN 'technical_document'
      WHEN EXISTS (
        SELECT 1
        FROM file_usage fu
        WHERE fu.file_id = fm.id
          AND fu.deleted_at IS NULL
          AND fu.entity_type = 'banner'
          AND fu.field_name = 'image_file_id'
      ) THEN 'banner'
      WHEN EXISTS (
        SELECT 1
        FROM file_usage fu
        WHERE fu.file_id = fm.id
          AND fu.deleted_at IS NULL
          AND fu.entity_type = 'brand'
          AND fu.field_name = 'logo_file_id'
      ) THEN 'brand_logo'
      WHEN EXISTS (
        SELECT 1
        FROM file_usage fu
        WHERE fu.file_id = fm.id
          AND fu.deleted_at IS NULL
          AND fu.entity_type = 'company_info'
          AND fu.field_name IN ('logo_file_id', 'favicon_file_id')
      ) THEN 'website_config'
      WHEN EXISTS (
        SELECT 1
        FROM file_usage fu
        WHERE fu.file_id = fm.id
          AND fu.deleted_at IS NULL
          AND (
            (fu.entity_type = 'product_group' AND fu.field_name IN ('thumbnail_file_id', 'seo_og_image_file_id'))
            OR (fu.entity_type = 'product_category' AND fu.field_name = 'icon_file_id')
          )
      ) THEN 'product_image'
      ELSE 'other'
    END
  `);
};

exports.down = async function down(knex) {
  await knex.raw('ALTER TABLE file_metadata DROP CONSTRAINT IF EXISTS chk_file_metadata_purpose');
  await knex.schema.alterTable('file_metadata', (table) => {
    table.dropColumn('purpose');
  });
};
